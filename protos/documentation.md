# ZephyrV2 gRPC and Protocol Buffers Implementation Guide

## Directory Structure
```
protos/
├── models/          # Data models shared across services
│   ├── user.proto
│   ├── note.proto
│   └── common.proto
├── services/        # Service definitions
│   ├── auth/
│   ├── notes/
│   └── ai/
└── common/          # Shared types and utilities
    ├── error.proto
    └── metadata.proto
```

## Protocol Buffer Guidelines

### 1. Model Definitions
- Each entity gets its own proto file
- Use common fields across models for consistency:
  - `id`: UUID string
  - `created_at`: int64 (Unix timestamp)
  - `updated_at`: int64 (Unix timestamp)
  - `metadata`: map<string, string>
- Version all messages using comments

### 2. Field Numbering Convention
- 1-15: Frequently used fields (1 byte)
- 16-2047: Less frequent fields (2 bytes)
- Skip numbers for future use
- Never reuse field numbers

### 3. Service Design Principles
- Define unary and streaming methods appropriately
- Use meaningful request/response message names
- Include metadata fields for tracing and logging
- Define timeout and retry policies

## Cross-Service Communication

### 1. Service Registry
- Service discovery mechanism
- Health checking
- Load balancing configuration
- Version management

### 2. Communication Patterns
- Synchronous: Direct gRPC calls
- Asynchronous: Event streaming
- Bulk Operations: Bidirectional streaming
- Caching Strategy

## Language-Specific Implementations

### 1. Go (API Gateway)
```go
// Example package structure
gateway/
├── internal/
│   ├── pb/          // Generated protobuf code
│   ├── services/    // Service implementations
│   └── handlers/    // gRPC handlers
└── pkg/
    └── client/      // Client libraries
```

### 2. Rust (Compute Service)
```rust
// Example package structure
compute/
├── src/
│   ├── generated/   // Generated protobuf code
│   ├── services/    // Service implementations
│   └── handlers/    // gRPC handlers
└── build.rs        // Proto compilation setup
```

### 3. Elixir (Realtime Service)
```elixir
# Example package structure
realtime/
├── lib/
│   ├── generated/   # Generated protobuf code
│   ├── services/    # Service implementations
│   └── handlers/    # gRPC handlers
└── mix.exs
```

## Data Consistency

### 1. Database Schema Alignment
- Proto definitions match database schema
- Consistent field types across systems
- Migration strategy for schema changes
- Version control for models

### 2. Type Mapping
| Proto Type | PostgreSQL | Go | Rust | Elixir |
|------------|------------|------|-------|---------|
| string | TEXT/VARCHAR | string | String | String |
| int64 | BIGINT | int64 | i64 | integer |
| timestamp | TIMESTAMPTZ | time.Time | DateTime | DateTime |
| map | JSONB | map[string]string | HashMap | Map |

## Error Handling

### 1. Standard Error Codes
- Use standard gRPC error codes
- Include detailed error messages
- Add metadata for debugging
- Maintain error consistency across services

### 2. Error Response Structure
```protobuf
message Error {
  string code = 1;
  string message = 2;
  map<string, string> details = 3;
}
```

## Security

### 1. Authentication
- JWT token validation
- Service-to-service authentication
- TLS configuration
- Rate limiting

### 2. Authorization
- Role-based access control
- Service-level permissions
- Resource-level permissions
- Audit logging

## Development Workflow

### 1. Proto Generation
```bash
# Example generation script structure
scripts/
├── generate-protos.sh
├── lint-protos.sh
└── validate-protos.sh
```

### 2. Testing Strategy
- Unit tests for generated code
- Integration tests for services
- Load testing for performance
- Contract testing

## Monitoring & Observability

### 1. Metrics to Track
- Request latency
- Error rates
- Stream statistics
- Resource usage

### 2. Logging Strategy
- Correlation IDs
- Structured logging
- Log levels
- Log aggregation

## Version Control & Deployment

### 1. Version Control
- Semantic versioning for protos
- Backward compatibility rules
- Breaking change management
- Documentation requirements

### 2. Deployment Strategy
- Service deployment order
- Version compatibility checks
- Rollback procedures
- Health checks

## Best Practices

### 1. Proto Design
- Keep messages focused and small
- Use enums for fixed values
- Comment all fields and messages
- Follow naming conventions

### 2. Service Design
- Define service boundaries clearly
- Plan for scalability
- Consider failure modes
- Document timeout values

### 3. Performance Considerations
- Message size optimization
- Streaming vs unary selection
- Batch operation design
- Connection pooling

## Future Considerations

### 1. Scalability
- Horizontal scaling strategy
- Load balancing configuration
- Connection management
- Resource allocation

### 2. Evolution
- API versioning strategy
- Deprecation policy
- Breaking change management
- Migration tooling
