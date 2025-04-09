# Fotis Backend Knowledge

## Project Overview
- Google Photos-style media viewer backend
- Express.js server with MongoDB database
- Supports local and SFTP media sources
- Handles media indexing and thumbnail generation

## Key Components
- **Express Server**: Runs on port 3001 (default)
- **MongoDB**: Required for storing media metadata and source configurations
- **Services**:
  - Indexer: Scans and indexes media from configured sources
  - SFTP: Handles remote media source connections
  - Thumbnails: Generates thumbnails for images/videos
  - ThumbnailGenerator: Scheduled service for async thumbnail generation

## Environment Variables
- MONGO_URI: MongoDB connection string
- PORT: Server port (defaults to 3001)
- VERBOSE: Set to '1' for debug logging
- THUMB_BATCH_SIZE: Number of thumbnails to process per run (default: 10)
- THUMB_MAX_ATTEMPTS: Maximum generation attempts per thumbnail (default: 3)
- THUMB_CPU_COOLDOWN: Base cooldown time between thumbnails in ms (default: 2000)
- THUMB_CPU_USAGE_LIMIT: CPU usage percentage to trigger throttling (default: 80)
- THUMB_THROTTLE_MULTIPLIER: Cooldown multiplier when CPU is high (default: 2)

## API Routes
- /media: Media listing and thumbnail endpoints
- /admin: Source management and indexing control
- /admin/thumbnails: Thumbnail generation management

## Development Guidelines
- Use logger.js for consistent logging (debug, error, info levels)
- Handle MongoDB connection in startServer()
- Always include error handlers in routes
- Keep error responses consistent: { error: 'message' }

## Common Operations
- Media indexing happens asynchronously
- Thumbnail generation runs every 5 minutes
- Source configurations are stored in MongoDB
- CPU usage is monitored and throttled during thumbnail generation

## Dependencies
- express: Web server framework
- mongodb: Database driver
- sharp: Image processing
- ssh2-sftp-client: SFTP connections
- dotenv: Environment configuration
- node-cron: Scheduled tasks