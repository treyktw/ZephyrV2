Let me expand the todo list incorporating SingleStore's vector capabilities:

Currently Have:
- Basic frame extraction
- Simple metadata storage
- Video processing pipeline
- File organization

Need to Add With SingleStore Integration:

Go Service (Processing):
- Frame indexing during extraction
- Generate embeddings for frame content
- OCR processing with text embeddings
- Enhanced metadata with vector data
- Frame relationship tracking in SingleStore
- Quality metrics calculation
- Store frame vectors in SingleStore
- Frame content analysis with ML models
- Real-time vector indexing of frames
- Batch processing optimization

Rust Service (Gateway):
- Vector similarity search endpoints
- Semantic search capabilities
- Timestamp to vector mapping
- AI query vector conversion
- Optimized vector retrieval
- Combined metadata + vector queries
- Vector cache management
- Performance-optimized search

SingleStore Specific:
- Vector column setup for frames
- Hybrid queries (SQL + Vector)
- Embedding storage optimization
- Frame relationship indices
- Timestamp to vector mapping
- Metadata to vector linking
- Real-time vector updates
- Search optimization

Frontend:
- Semantic search interface
- Frame similarity exploration
- Vector-based content browsing
- Frame relationship visualization
- AI query interface with vector search
- Intelligent frame preview
- Content similarity display

AI Query Flow with SingleStore:
1. Go processes frames → generates embeddings → stores in SingleStore
2. User queries video content
3. Query converted to vector
4. SingleStore performs similarity search
5. Rust retrieves relevant frames
6. AI processes frames and context
7. Frontend displays results

SingleStore helps by:
- Fast vector similarity search
- Combined vector + traditional queries
- Efficient embedding storage
- Real-time vector operations
- Scalable vector processing
- Complex relationship tracking
- Unified storage solution
