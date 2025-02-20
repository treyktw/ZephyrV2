// src/middleware/rate_limit.rs
use std::future::{ready, Ready};
use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform}, web, Error
};
use futures_util::future::LocalBoxFuture;
use crate::services::rate_limit::RateLimiter;

pub struct RateLimitMiddleware;

impl Default for RateLimitMiddleware {
    fn default() -> Self {
        RateLimitMiddleware
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimitMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = RateLimitMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RateLimitMiddlewareService { service }))
    }
}

pub struct RateLimitMiddlewareService<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for RateLimitMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let rate_limiter = req.app_data::<web::Data<RateLimiter>>().cloned();
        let ip = req.connection_info()
            .realip_remote_addr()
            .unwrap_or("unknown")
            .to_string();
        let path = req.path().to_owned();
        let method = req.method().to_string();
        let fut = self.service.call(req);

        Box::pin(async move {
            if let Some(rate_limiter) = rate_limiter {
                let limit_type = if path == "/api/videos" && method == "POST" {
                    "upload"
                } else {
                    "request"
                };

                rate_limiter.check_rate_limit(&ip, limit_type).await?;
            }

            fut.await
        })
    }
}
