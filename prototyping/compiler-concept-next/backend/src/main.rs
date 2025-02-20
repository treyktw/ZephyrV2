use actix_web::{web, App, HttpResponse, HttpServer};
use anyhow::{Context, Result};
use backoff::ExponentialBackoff;
use bb8_redis::redis::AsyncCommands;
use bb8_redis::{bb8, RedisConnectionManager};
use bollard::container::{
    Config, CreateContainerOptions, RemoveContainerOptions, StartContainerOptions, StatsOptions,
};
use bollard::exec::{CreateExecOptions, StartExecResults};
use bollard::Docker;
use dotenv::dotenv;
use futures_util::StreamExt;
use governor::state::{InMemoryState, NotKeyed};
use governor::{Quota, RateLimiter};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::future::Future;
use std::num::NonZeroU32;
use std::prelude::v1::{None, Some};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

// Constants
const CONTAINER_MEMORY_LIMIT: i64 = 512 * 1024 * 1024; // 512MB
const MAX_CONTAINERS_PER_LANGUAGE: usize = 5;
const EXECUTION_TIMEOUT: u64 = 10; // seconds
const CACHE_DURATION: u64 = 3600; // 1 hour

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CompileRequest {
    code: String,
    language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CompileResponse {
    output: String,
    error: Option<String>,
    execution_time: f64,
    cached: bool,
}

struct ContainerPool {
    docker: Docker,
    redis_pool: bb8::Pool<RedisConnectionManager>,
    rate_limiter: Arc<RateLimiter<NotKeyed, InMemoryState, governor::clock::DefaultClock>>,
    container_map: Arc<Mutex<HashMap<String, Vec<String>>>>, // language -> container_ids
}

impl ContainerPool {
    fn prepare_typescript_command(&self, code: &str) -> Vec<String> {
        // Create a basic TypeScript program structure
        let wrapped_code = format!(
            r#"import {{ createRequire }} from 'module';
    const require = createRequire(import.meta.url);

    // Main execution block
    async function runCode() {{
        try {{
            {}
        }} catch (error) {{
            console.error('Runtime error:', error);
        }}
    }}

    runCode().catch(error => console.error('Execution error:', error));"#,
            code
        );

        // Write to a file and execute with proper escaping
        vec![
            "bash".to_string(),
            "-c".to_string(),
            format!(
                r#"cat > /workspace/script.ts << 'EOL'
    {}
    EOL
    ts-node --esm /workspace/script.ts"#,
                wrapped_code
            ),
        ]
    }

    fn prepare_rust_command(&self, code: &str) -> Vec<String> {
        let wrapped_code = if !code.contains("fn main") {
            format!(
                r#"
                    fn main() {{
                        {}
                    }}
                    "#,
                code
            )
        } else {
            code.to_string()
        };

        vec![
            "sh".to_string(),
            "-c".to_string(),
            format!(
                r#"echo '{}' > /workspace/main.rs && rustc -O /workspace/main.rs && ./main"#,
                wrapped_code.replace("'", "\\'")
            ),
        ]
    }

    fn prepare_c_command(&self, code: &str) -> Vec<String> {
        let wrapped_code = if !code.contains("main") {
            format!(
                r#"
                    #include <stdio.h>
                    #include <stdlib.h>
                    #include <string.h>
                    #include <math.h>

                    int main() {{
                        {}
                        return 0;
                    }}
                    "#,
                code
            )
        } else {
            code.to_string()
        };

        vec![
            "sh".to_string(),
            "-c".to_string(),
            format!(
                r#"echo '{}' > /workspace/main.c && gcc -O2 -o main main.c && ./main"#,
                wrapped_code.replace("'", "\\'")
            ),
        ]
    }

    fn prepare_cpp_command(&self, code: &str) -> Vec<String> {
        let wrapped_code = if !code.contains("main") {
            format!(
                r#"
                    #include <iostream>
                    #include <string>
                    #include <vector>
                    #include <algorithm>
                    using namespace std;

                    int main() {{
                        {}
                        return 0;
                    }}
                    "#,
                code
            )
        } else {
            code.to_string()
        };

        vec![
            "sh".to_string(),
            "-c".to_string(),
            format!(
                r#"echo '{}' > /workspace/main.cpp && g++ -O2 -std=c++17 -o main main.cpp && ./main"#,
                wrapped_code.replace("'", "\\'")
            ),
        ]
    }

    fn prepare_csharp_command(&self, code: &str) -> Vec<String> {
        let wrapped_code = if !code.contains("class Program") {
            format!(
                r#"
                    using System;
                    using System.Collections.Generic;
                    using System.Linq;
                    using System.Threading.Tasks;

                    public class Program
                    {{
                        public static void Main()
                        {{
                            try
                            {{
                                {}
                            }}
                            catch (Exception ex)
                            {{
                                Console.WriteLine($"Runtime error: {{ex.Message}}");
                            }}
                        }}
                    }}
                    "#,
                code
            )
        } else {
            code.to_string()
        };

        vec![
            "sh".to_string(),
            "-c".to_string(),
            format!(
                r#"echo '{}' > /workspace/Program.cs && dotnet run --no-restore"#,
                wrapped_code.replace("'", "\\'")
            ),
        ]
    }

    fn prepare_zig_command(&self, code: &str) -> Vec<String> {
        let wrapped_code = if !code.contains("pub fn main") {
            format!(
                r#"
                    const std = @import("std");

                    pub fn main() !void {{
                        const stdout = std.io.getStdOut().writer();
                        {{
                            {}
                        }}
                    }}
                    "#,
                code
            )
        } else {
            code.to_string()
        };

        vec![
            "sh".to_string(),
            "-c".to_string(),
            format!(
                r#"echo '{}' > /workspace/main.zig && zig build-exe main.zig -O ReleaseSmall && ./main"#,
                wrapped_code.replace("'", "\\'")
            ),
        ]
    }

    async fn process_exec_output(
        &self,
        output: impl futures_util::Stream<
                Item = Result<bollard::container::LogOutput, bollard::errors::Error>,
            > + Unpin,
    ) -> Result<String> {
        let mut stdout = String::new();
        let mut stderr = String::new();

        tokio::pin!(output);

        while let Some(chunk) = output.next().await {
            match chunk? {
                bollard::container::LogOutput::StdOut { message } => {
                    stdout.push_str(&String::from_utf8_lossy(&message));
                }
                bollard::container::LogOutput::StdErr { message } => {
                    stderr.push_str(&String::from_utf8_lossy(&message));
                }
                _ => {}
            }
        }

        if !stderr.is_empty() {
            // Format compiler/runtime errors nicely
            let error_message = stderr
                .lines()
                .filter(|line| !line.trim().is_empty())
                .collect::<Vec<_>>()
                .join("\n");
            Ok(format!("Error:\n{}", error_message))
        } else if stdout.is_empty() {
            Ok("Code executed successfully with no output.".to_string())
        } else {
            Ok(stdout)
        }
    }

    async fn new(docker: Docker, redis_url: &str) -> Result<Self> {
        let manager = RedisConnectionManager::new(redis_url)?;
        let redis_pool = bb8::Pool::builder().max_size(15).build(manager).await?;

        let rate_limiter = RateLimiter::direct(Quota::per_second(NonZeroU32::new(10).unwrap()));

        Ok(Self {
            docker,
            redis_pool,
            rate_limiter: Arc::new(rate_limiter),
            container_map: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    async fn get_cached_result(
        &self,
        code: &str,
        language: &str,
    ) -> Result<Option<CompileResponse>> {
        let mut conn = self.redis_pool.get().await?;
        let cache_key = format!("compile:{}:{}", language, sha256::digest(code));

        match conn.get::<&str, Option<String>>(&cache_key).await {
            Ok(Some(cached)) => {
                let mut response: CompileResponse = serde_json::from_str(&cached)?;
                response.cached = true;
                Ok(Some(response))
            }
            Ok(None) => Ok(None),
            Err(e) => {
                warn!("Redis error: {}", e);
                Ok(None)
            }
        }
    }

    async fn cache_result(
        &self,
        code: &str,
        language: &str,
        result: &CompileResponse,
    ) -> Result<()> {
        let mut conn = self.redis_pool.get().await?;
        let cache_key = format!("compile:{}:{}", language, sha256::digest(code));
        let cache_value = serde_json::to_string(result)?;

        let _: () = conn
            .set_ex(&cache_key, cache_value, CACHE_DURATION)
            .await
            .context("Failed to cache result")?;
        Ok(())
    }

    async fn get_or_create_container(&self, language: &str) -> Result<String> {
        let mut container_map = self.container_map.lock().await;
        let container_ids = container_map
            .entry(language.to_string())
            .or_insert_with(Vec::new);

        // Remove any terminated containers
        let futures = container_ids.iter().map(|id| {
            let docker = self.docker.clone();
            let id_clone = id.clone();
            async move {
                match docker.inspect_container(&id_clone, None).await {
                    Ok(info) => (
                        id_clone,
                        info.state.map_or(false, |s| s.running.unwrap_or(false)),
                    ),
                    Err(_) => (id_clone, false),
                }
            }
        });

        let results = futures::future::join_all(futures).await;
        container_ids.retain(|id| {
            results
                .iter()
                .find(|(container_id, _)| container_id == id)
                .map(|(_, running)| *running)
                .unwrap_or(false)
        });

        // Reuse existing container if available
        if let Some(container_id) = container_ids.first() {
            return Ok(container_id.clone());
        }

        // Create new container if under limit
        if container_ids.len() < MAX_CONTAINERS_PER_LANGUAGE {
            let container_id = self.create_container(language).await?;
            container_ids.push(container_id.clone());
            Ok(container_id)
        } else {
            // Reuse oldest container
            Ok(container_ids[0].clone())
        }
    }

    async fn create_container(&self, language: &str) -> Result<String> {
        let config = self.get_container_config(language)?;
        let options = Some(CreateContainerOptions {
            name: format!("compiler-{}-{}", language, uuid::Uuid::new_v4()),
            platform: None,
        });

        let container = self
            .docker
            .create_container(options, config)
            .await
            .context("Failed to create container")?;

        Ok(container.id)
    }

    fn get_container_config(&self, language: &str) -> Result<Config<String>> {
        let mut env = HashMap::new();
        env.insert("LANGUAGE".to_string(), language.to_string());

        let config = Config {
            image: Some(format!("compiler-{}", language)),
            cmd: Some(vec![
                "/bin/sh".to_string(),
                "-c".to_string(),
                "tail -f /dev/null".to_string(),
            ]),
            env: Some(env.iter().map(|(k, v)| format!("{}={}", k, v)).collect()),
            working_dir: Some("/workspace".to_string()),
            host_config: Some(bollard::service::HostConfig {
                memory: Some(CONTAINER_MEMORY_LIMIT),
                memory_swap: Some(CONTAINER_MEMORY_LIMIT),
                cpu_period: Some(100000),
                cpu_quota: Some(50000), // 50% CPU
                ..Default::default()
            }),
            ..Default::default()
        };

        Ok(config)
    }

    async fn execute_with_retry<F, Fut, T>(&self, operation: F) -> Result<T>
    where
        F: Fn() -> Fut,
        Fut: Future<Output = Result<T>> + Send,
        T: 'static,
    {
        let backoff = ExponentialBackoff::default();
        backoff::future::retry(backoff, || async {
            operation().await.map_err(|e| {
                warn!("Operation failed, retrying: {}", e);
                backoff::Error::transient(e)
            })
        })
        .await
    }
    async fn execute_code(&self, container_id: &str, code: &str, language: &str) -> Result<String> {
        // Start monitoring container resources
        let monitor_handle = {
            let docker = self.docker.clone();
            let container_id = container_id.to_string();
            tokio::spawn(async move {
                loop {
                    let mut stats_stream = docker.stats(
                        &container_id,
                        Some(StatsOptions {
                            stream: false,
                            one_shot: true,
                        }),
                    );

                    if let Some(Ok(stats)) = stats_stream.next().await {
                        if let Some(usage) = stats.memory_stats.usage {
                            if usage > CONTAINER_MEMORY_LIMIT as u64 {
                                warn!("Container {} exceeding memory limit", container_id);
                                if let Err(e) = docker
                                    .remove_container(
                                        &container_id,
                                        Some(RemoveContainerOptions {
                                            force: true,
                                            ..Default::default()
                                        }),
                                    )
                                    .await
                                {
                                    error!("Failed to cleanup container: {}", e);
                                }
                                break;
                            }
                        }
                    }
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
            })
        };

        // Start the container if not running
        self.docker
            .start_container(container_id, None::<StartContainerOptions<String>>)
            .await?;

        let language = language.to_string();
        let code = code.to_string();
        tracing::debug!("Preparing to execute command for language: {}", language);

        let docker = self.docker.clone();
        let container_id = container_id.to_string();
        let result = self
            .execute_with_retry(move || {
                let language = language.clone();
                let code = code.clone();
                let container_id = container_id.clone();
                let docker = docker.clone();
                Box::pin(async move {
                    let exec_cmd = self.prepare_execution_command(&language, &code)?;
                    tracing::debug!("Executing command: {:?}", exec_cmd);

                    // Create exec instance
                    let exec = docker
                        .create_exec(
                            &container_id,
                            CreateExecOptions {
                                cmd: Some(exec_cmd),
                                attach_stdout: Some(true),
                                attach_stderr: Some(true),
                                working_dir: Some("/workspace".to_string()),
                                ..Default::default()
                            },
                        )
                        .await?;

                    let output = if let StartExecResults::Attached { mut output, .. } =
                        docker.start_exec(&exec.id, None).await?
                    {
                        self.process_exec_output(&mut output).await
                    } else {
                        Err(anyhow::anyhow!("Failed to start exec instance"))
                    };

                    output
                })
            })
            .await;

        // Clean up monitoring
        monitor_handle.abort();

        result
    }

    fn prepare_execution_command(&self, language: &str, code: &str) -> Result<Vec<String>> {
        let cmd = match language {
            "javascript" => vec!["node".to_string(), "-e".to_string(), code.to_string()],
            "python" => vec!["python3".to_string(), "-c".to_string(), code.to_string()],
            "typescript" => self.prepare_typescript_command(code),
            "rust" => self.prepare_rust_command(code),
            "c" => self.prepare_c_command(code),
            "cpp" => self.prepare_cpp_command(code),
            "csharp" => self.prepare_csharp_command(code),
            "zig" => self.prepare_zig_command(code),
            _ => return Err(anyhow::anyhow!("Unsupported language: {}", language)),
        };
        Ok(cmd)
    }

    async fn collect_execution_output(&self, exec_id: &str) -> Result<String> {
        if let StartExecResults::Attached { mut output, .. } =
            self.docker.start_exec(exec_id, None).await?
        {
            let mut stdout = String::new();
            let mut stderr = String::new();

            match tokio::time::timeout(std::time::Duration::from_secs(EXECUTION_TIMEOUT), async {
                while let Some(Ok(chunk)) = output.next().await {
                    match chunk {
                        bollard::container::LogOutput::StdOut { message } => {
                            stdout.push_str(&String::from_utf8_lossy(&message));
                        }
                        bollard::container::LogOutput::StdErr { message } => {
                            stderr.push_str(&String::from_utf8_lossy(&message));
                        }
                        _ => {}
                    }
                }
            })
            .await
            {
                Ok(_) => {
                    if !stderr.is_empty() {
                        Ok(format!("Error: {}", stderr))
                    } else if stdout.is_empty() {
                        Ok("Code executed successfully with no output.".to_string())
                    } else {
                        Ok(stdout)
                    }
                }
                Err(_) => Err(anyhow::anyhow!(
                    "Execution timed out after {} seconds",
                    EXECUTION_TIMEOUT
                )),
            }
        } else {
            Err(anyhow::anyhow!("Failed to start exec instance"))
        }
    }

    async fn cleanup_container(&self, container_id: &str) -> Result<()> {
        let mut container_map = self.container_map.lock().await;
        for containers in container_map.values_mut() {
            containers.retain(|id| id != container_id);
        }

        self.docker
            .remove_container(
                container_id,
                Some(RemoveContainerOptions {
                    force: true,
                    ..Default::default()
                }),
            )
            .await?;

        Ok(())
    }
}
// Implementation of Drop for ContainerPool
impl Drop for ContainerPool {
    fn drop(&mut self) {
        let docker = self.docker.clone();
        let container_map = self.container_map.clone();

        tokio::spawn(async move {
            let map = container_map.lock().await;
            for containers in map.values() {
                for container_id in containers {
                    if let Err(e) = docker
                        .remove_container(
                            container_id,
                            Some(RemoveContainerOptions {
                                force: true,
                                ..Default::default()
                            }),
                        )
                        .await
                    {
                        error!("Failed to cleanup container {}: {}", container_id, e);
                    }
                }
            }
        });
    }
}

async fn compile(pool: web::Data<ContainerPool>, req: web::Json<CompileRequest>) -> HttpResponse {
    // Rate limiting check
    if pool.rate_limiter.check().is_err() {
        return HttpResponse::TooManyRequests().json(CompileResponse {
            output: String::new(),
            error: Some("Rate limit exceeded. Please try again later.".to_string()),
            execution_time: 0.0,
            cached: false,
        });
    }

    let start_time = Instant::now();
    tracing::debug!(
        "Received compile request for {} code:\n{}",
        req.language,
        req.code
    );

    // Check cache first
    match pool.get_cached_result(&req.code, &req.language).await {
        Ok(Some(cached_response)) => {
            info!("Cache hit for {} code", req.language);
            return HttpResponse::Ok().json(cached_response);
        }
        Err(e) => warn!("Cache error: {}", e),
        _ => {}
    }

    let result = async {
        let container_id = pool.get_or_create_container(&req.language).await?;
        tracing::debug!("Using container: {}", container_id);

        let output = pool
            .execute_code(&container_id, &req.code, &req.language)
            .await?;
        tracing::debug!("Execution output: {}", output);

        let response = CompileResponse {
            output,
            error: None,
            execution_time: start_time.elapsed().as_secs_f64(),
            cached: false,
        };

        // Cache successful results
        if response.error.is_none() {
            if let Err(e) = pool.cache_result(&req.code, &req.language, &response).await {
                warn!("Failed to cache result: {}", e);
            }
        }

        Ok::<_, anyhow::Error>(response)
    }
    .await;

    match result {
        Ok(response) => {
            tracing::debug!("Successfully compiled code in {:?}", start_time.elapsed());
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            error!("Compilation error: {}", e);
            HttpResponse::InternalServerError().json(CompileResponse {
                output: String::new(),
                error: Some(e.to_string()),
                execution_time: start_time.elapsed().as_secs_f64(),
                cached: false,
            })
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    let ports = [3001, 3002, 3003, 3004, 3005];
    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

    let docker = Docker::connect_with_local_defaults().expect("Failed to connect to Docker");
    let pool = ContainerPool::new(docker, &redis_url)
        .await
        .expect("Failed to create container pool");
    let pool = web::Data::new(pool);

    let mut server = None;
    let mut bound_port = None;

    for port in ports {
        let pool = pool.clone();
        match HttpServer::new(move || {
            App::new()
                .app_data(pool.clone())
                .wrap(
                    actix_cors::Cors::default()
                        .allow_any_header()
                        .allow_any_method()
                        .allow_any_origin(),
                )
                .route("/compile", web::post().to(compile))
        })
        .bind(format!("{}:{}", host, port))
        {
            Ok(s) => {
                info!("Successfully bound to port {}", port);
                server = Some(s);
                bound_port = Some(port);
                break;
            }
            Err(e) => {
                warn!("Failed to bind to port {}: {}", port, e);
            }
        }
    }

    let server = server.ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::AddrInUse,
            "Could not bind to any of the specified ports",
        )
    })?;

    info!("Starting server at http://{}:{}", host, bound_port.unwrap());
    server.run().await
}
