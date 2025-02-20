# Video Analysis System - Full Documentation

## Current Implementation

### Architecture Overview
```
Frontend (Next.js) → Redis Queue → Go Processor → Frame Extraction
                  ↳ Local Storage  → Rust Gateway (Future Integration Point)
                  ↳ Data Directory Storage
```

### Current File Structure
```
Project Root/
├── frontend/
│   └── videos/                  # Original files with original names
├── data/
│   └── videos/
│       └── [uuid]/             # Processing directory
│           ├── original.mp4
│           ├── metadata.json
│           └── frames/         # Extracted frames
└── [service directories]
```

### Service Roles & Features

1. Frontend (Next.js)
- File upload handling
- UUID generation
- File organization
- Redis metadata updates
- Processing queue management
- Local storage management

2. Redis Implementation
```json
// Video Metadata (Key: video:[id])
{
    "id": "uuid",
    "filename": "original-name.mp4",
    "status": "uploading|processing|complete|error",
    "created_at": timestamp,
    "updated_at": timestamp
}

// Processing Queue & Status Management
video_queue: [video_id1, video_id2, ...]
video:[id]:processing: {status, progress, frames_processed, last_update}
```

3. Go Processor
- Redis queue monitoring
- FFmpeg integration
- Frame extraction
- Progress tracking
- Status updates
- Error handling

## Future Implementation (TODO)

### Enhanced Architecture
```
Frontend → Redis Queue → Go Processor → SingleStore
       ↓                               ↓
    Local Storage   ←   Rust Gateway   ←   AI Query System
```

### Enhanced File Structure
```
Project Root/
├── frontend/
│   ├── videos/                  # Original files
│   └── cache/                   # Client-side cache
├── data/
│   └── videos/
│       └── [uuid]/
│           ├── original.mp4
│           ├── metadata.json
│           ├── frames/          # Extracted frames
│           ├── vectors/         # Frame embeddings
│           ├── analysis/        # ML outputs
│           └── ocr/            # Text extraction
└── [service directories]
```

### Service Enhancements

1. Go Service Additions:
- Frame indexing system
- Embedding generation
- OCR processing
- ML model integration
- SingleStore integration
- Batch processing
- Quality metrics
- Real-time vector indexing

2. Rust Service Implementation:
- Vector similarity endpoints
- Semantic search
- Timestamp mapping
- AI query handling
- Cache management
- Performance optimization
- Search functionality

3. SingleStore Integration:
- Vector column setup
- Hybrid query system
- Embedding storage
- Relationship tracking
- Real-time updates
- Search optimization
- Metadata linking

4. Frontend Enhancements:
- Semantic search UI
- Frame exploration
- Vector visualization
- AI query interface
- Progress tracking
- Content similarity display

### AI Query Flow
1. Upload & Processing:
   ```
   Upload → Frame Extraction → Vector Generation → SingleStore Storage
   ```

2. Query Processing:
   ```
   User Query → Vector Conversion → Similarity Search → Frame Retrieval → AI Processing → Display
   ```

### Performance Considerations
- Load balanced deployment
- Concurrent processing
- Cache optimization
- Vector search performance
- Frame access patterns
- Storage optimization

### Next Steps
1. Implement Rust gateway
2. Set up SingleStore
3. Integrate vector processing
4. Develop AI query system
5. Enhance frontend interface
6. Optimize performance
7. Add monitoring
8. Implement security
