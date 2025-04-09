# 🖼️ Thumbnail Generation Scheduling Specification

## Overview

This document outlines the design for asynchronous thumbnail generation in the Fotis POC backend. The system will use a scheduled job to process pending thumbnails, ensuring efficient resource usage and reliable thumbnail creation.

## Core Components

### 1. Media Document Schema Updates

```javascript
{
  sourceId: ObjectId,
  path: String,
  type: String,
  hash: String,
  size: Number,
  size_human: String,
  timestamp: Date,
  lastUpdated: Date,
  
  // New fields
  has_thumb: Boolean,         // Indicates if thumbnail exists
  thumb_pending: Boolean,     // Indicates if thumbnail generation is queued
  thumb_attempts: Number,     // Number of generation attempts
  thumb_path: String,         // Path to thumbnail file (if exists)
  thumb_size: Number,         // Size of thumbnail in bytes
  thumb_size_human: String    // Human-readable thumbnail size
}
```

### 2. Thumbnail Generation History Schema

```javascript
{
  mediaId: ObjectId,
  sourceId: ObjectId,
  timestamp: Date,
  status: String,        // 'success' | 'failed'
  error: String,         // Error message if failed
  duration: Number,      // Processing time in milliseconds
  input_size: Number,    // Original file size
  output_size: Number,   // Thumbnail size
  attempt: Number        // Which attempt this was
}
```

## Implementation Details

### 1. Indexing Process Changes

- During indexing, set initial thumbnail fields:
  ```javascript
  {
    has_thumb: false,
    thumb_pending: true,
    thumb_attempts: 0
  }
  ```
- Remove immediate thumbnail generation from indexer
- Trigger thumbnail generation job after indexing completes

### 2. Scheduled Job (node-cron)

```javascript
// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  if (isGenerating) return; // Ensure single instance
  await generatePendingThumbnails();
});
```

### 3. Thumbnail Generation Process

1. **Lock Acquisition**
   - Set global flag to prevent concurrent runs
   - Use MongoDB transaction for document locking

2. **Batch Processing**
   ```javascript
   const batch = await media.find({
     has_thumb: false,
     thumb_pending: true,
     thumb_attempts: { $lt: 3 }  // Max 3 attempts
   }).limit(10);
   ```

3. **Processing Loop with CPU Throttling**
   - Process one file at a time
   - Enforce cooling period between thumbnails
   - Update history after each attempt
   - Handle errors gracefully
   - Update media document status

4. **Cleanup**
   - Release locks
   - Reset global flag
   - Log completion statistics

### 4. Error Handling

- Track failed attempts in media document
- Stop retrying after 3 failures
- Log detailed error information
- Maintain generation history

## API Endpoints

### 1. Manual Trigger
```
POST /admin/thumbnails/generate
Body: { sourceId?: string }  // Optional: process specific source
```

### 2. Status Check
```
GET /admin/thumbnails/status
Response: {
  isGenerating: boolean,
  pendingCount: number,
  failedCount: number,
  lastRunTime: Date,
  cpuUsage: number,         // Current CPU usage percentage
  cooldownActive: boolean   // Whether throttling is active
}
```

### 3. History Query
```
GET /admin/thumbnails/history
Query: {
  sourceId?: string,
  status?: string,
  from?: Date,
  to?: Date
}
```

## Configuration

```env
# Batch Processing
THUMB_BATCH_SIZE=10           # Number of thumbnails to process per run
THUMB_MAX_ATTEMPTS=3          # Maximum generation attempts per file
THUMB_GENERATION_INTERVAL=5   # Minutes between runs
THUMB_TIMEOUT=30000          # Millisecond timeout per thumbnail

# CPU Protection
THUMB_CPU_COOLDOWN=2000      # Milliseconds to wait between processing files
THUMB_CPU_USAGE_LIMIT=80     # Maximum CPU usage percentage before throttling
THUMB_CPU_CHECK_INTERVAL=5000 # How often to check CPU usage (ms)
THUMB_THROTTLE_MULTIPLIER=2   # Multiply cooldown by this when CPU is high

# Image Processing
THUMB_WIDTH=300              # Thumbnail width in pixels
THUMB_HEIGHT=300             # Thumbnail height in pixels
THUMB_QUALITY=80             # JPEG quality (0-100)
```

## CPU Protection Mechanism

The thumbnail generation service includes a sophisticated CPU protection system:

1. **Regular CPU Monitoring**
   - Check CPU usage at configured intervals
   - Calculate moving average to avoid spikes
   - Log when throttling activates/deactivates

2. **Dynamic Throttling**
   ```javascript
   // Example throttling logic
   const cpuUsage = await getCPUUsage();
   const baseCooldown = process.env.THUMB_CPU_COOLDOWN;
   
   if (cpuUsage > process.env.THUMB_CPU_USAGE_LIMIT) {
     // Increase cooldown when CPU is high
     await sleep(baseCooldown * THUMB_THROTTLE_MULTIPLIER);
   } else {
     // Normal cooldown
     await sleep(baseCooldown);
   }
   ```

3. **Adaptive Behavior**
   - Increase cooldown period when CPU stays high
   - Return to normal cooldown when CPU stabilizes
   - Log throttling events for monitoring

## Monitoring & Logging

- Log each generation attempt
- Track success/failure rates
- Monitor processing times
- Alert on high failure rates
- Track disk space usage
- Monitor CPU usage and throttling events
- Log cooldown periods and their impact

## Future Enhancements

1. **Priority Queue**
   - Allow certain files to be processed first
   - Based on access patterns or manual flags

2. **Resource Management**
   - CPU/Memory usage limits
   - Disk space checks
   - Network bandwidth consideration
   - Advanced CPU throttling algorithms

3. **Cleanup Jobs**
   - Remove unused thumbnails
   - Clean up old history records
   - Compact storage space

4. **Performance Optimizations**
   - Parallel processing (configurable)
   - Adaptive batch sizes
   - Smart retry intervals
   - Machine learning for optimal throttling

5. **Advanced Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Health check endpoints
   - Resource usage analytics