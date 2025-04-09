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

## Environment Variables
- MONGO_URI: MongoDB connection string
- PORT: Server port (defaults to 3001)
- VERBOSE: Set to '1' for debug logging

## API Routes
- /media: Media listing and thumbnail endpoints
- /admin: Source management and indexing control

## Development Guidelines
- Use logger.js for consistent logging (debug, error, info levels)
- Handle MongoDB connection in startServer()
- Always include error handlers in routes
- Keep error responses consistent: { error: 'message' }

## Common Operations
- Media indexing happens asynchronously
- Thumbnail generation is on-demand
- Source configurations are stored in MongoDB

## Dependencies
- express: Web server framework
- mongodb: Database driver
- sharp: Image processing
- ssh2-sftp-client: SFTP connections
- dotenv: Environment configuration