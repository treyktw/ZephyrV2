// src/services/redis.rs
use redis::aio::MultiplexedConnection;
use redis::Client;
use std::sync::Arc;
use tokio::sync::Mutex;
use anyhow::Result;

pub struct RedisPool {
    client: Client,
    connections: Arc<Mutex<Vec<MultiplexedConnection>>>,
    pool_size: usize,
}

impl RedisPool {
    pub fn new(redis_url: &str, pool_size: usize) -> Result<Self> {
        let client = Client::open(redis_url)?;
        Ok(Self {
            client,
            connections: Arc::new(Mutex::new(Vec::with_capacity(pool_size))),
            pool_size,
        })
    }

    pub async fn get_conn(&self) -> Result<MultiplexedConnection> {
        let mut connections = self.connections.lock().await;
        if let Some(conn) = connections.pop() {
            Ok(conn)
        } else if connections.len() < self.pool_size {
            Ok(self.client.get_multiplexed_tokio_connection().await?)
        } else {
            // Wait for a connection to become available
            drop(connections);
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            Box::pin(self.get_conn()).await
        }
    }
}
