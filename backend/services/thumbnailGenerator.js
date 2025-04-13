const cron = require('node-cron');
const os = require('os');
const path = require('path');
const logger = require('../utils/logger');
const ThumbnailService = require('./thumbnails');
const fs = require('fs').promises;
const { formatBytes } = require('../utils/fileUtils');
const { ObjectId } = require('mongodb');
const SftpService = require('./sftp');

class ThumbnailGenerationService {
  constructor(db, config = {}) {
    this.db = db;
    this.thumbnailService = new ThumbnailService();
    this.sftpService = new SftpService();
    this.isGenerating = false;
    this.batchSize = config.batchSize || parseInt(process.env.THUMB_BATCH_SIZE, 10) || 10;
    this.maxAttempts = config.maxAttempts || parseInt(process.env.THUMB_MAX_ATTEMPTS, 10) || 3;
    this.cpuCooldown = config.cpuCooldown || parseFloat(process.env.THUMB_CPU_COOLDOWN) || 1;
    this.cpuUsageLimit = config.cpuUsageLimit || parseInt(process.env.THUMB_CPU_USAGE_LIMIT, 10) || 80;
    this.throttleMultiplier = config.throttleMultiplier || parseInt(process.env.THUMB_THROTTLE_MULTIPLIER, 10) || 2;
    this.concurrentLimit = config.concurrentLimit || parseInt(process.env.THUMB_CONCURRENT_LIMIT, 10) || 1;
    this.sftpConnections = {};

    // Performance tracking
    this.processedCount = 0;
    this.processingStartTime = null;
    this.lastProcessedTime = null;
    this.currentWorkRatio = 0; // thumbs/sec
  }

  async start() {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.debug('[DEBUG] Cron job triggered thumbnail generation. (DISABLED)');
     // await this.generatePendingThumbnails();
    });
    logger.info('Thumbnail generation service started');
    console.debug('[DEBUG] Thumbnail generation service cron schedule set.');
  }

  async getCPUUsage() {
    return new Promise((resolve) => {
        const startUsage = process.cpuUsage();
        const startCpus = os.cpus();

        setTimeout(() => {
            const endUsage = process.cpuUsage(startUsage);
            const endCpus = os.cpus();
            let totalIdle = 0;
            let totalTick = 0;

            startCpus.forEach((cpu, i) => {
                const endCpu = endCpus[i];
                const idleDifference = endCpu.times.idle - cpu.times.idle;
                const totalDifference = (endCpu.times.user - cpu.times.user) +
                                        (endCpu.times.nice - cpu.times.nice) +
                                        (endCpu.times.sys - cpu.times.sys) +
                                        (endCpu.times.irq - cpu.times.irq) +
                                        idleDifference;
                totalIdle += idleDifference;
                totalTick += totalDifference;
            });

            const usagePercentage = totalTick === 0 ? 0 : (1 - totalIdle / totalTick) * 100;
            resolve(usagePercentage);
        }, 100);
    });
  }

  async sleep(ms) {
    console.debug(`[DEBUG] Sleeping for ${ms}ms...`);
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generatePendingThumbnails(filters = {}) {
    if (this.isGenerating) {
      logger.debug('Thumbnail generation already in progress, skipping run.');
      console.debug('[DEBUG] Thumbnail generation already in progress, skipping run.');
      return;
    }

    // Build base query
    const baseQuery = {
      has_thumb: false,
      thumb_pending: true,
      thumb_attempts: { $lt: this.maxAttempts }
    };

    // Add sourceId filter if provided
    if (filters.sourceId) {
      baseQuery.sourceId = new ObjectId(filters.sourceId);
      console.debug(`[DEBUG] Adding sourceId filter: ${filters.sourceId}`);
    }

    // Add year filter if provided
    if (filters.year) {
      const numericYear = parseInt(filters.year, 10);
      const startDate = new Date(numericYear, 0, 1);
      const endDate = new Date(numericYear, 11, 31, 23, 59, 59, 999);
      baseQuery.timestamp = { $gte: startDate, $lte: endDate };
      console.debug(`[DEBUG] Adding year filter: ${filters.year}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }

    console.debug('[DEBUG] Starting generatePendingThumbnails FULL run.');
    this.isGenerating = true;
    this.processingStartTime = Date.now();
    this.processedCount = 0;
    const overallStartTime = Date.now();
    let totalProcessedCount = 0;
    let totalSuccessCount = 0;
    let totalFailureCount = 0;
    let batchNumber = 0;

    try {
      while (true) {
        batchNumber++;
        const batchStartTime = Date.now();
        let batchProcessedCount = 0;
        let batchSuccessCount = 0;
        let batchFailureCount = 0;

        const totalPendingBeforeBatch = await this.db.collection('media').countDocuments(baseQuery);
        console.debug(`[DEBUG] Batch #${batchNumber}: Total pending items BEFORE fetching batch: ${totalPendingBeforeBatch}, baseQuery: ${JSON.stringify(baseQuery)}`);

        if (totalPendingBeforeBatch === 0) {
            console.debug(`[DEBUG] Batch #${batchNumber}: No more pending items found. Exiting loop.`);
            break;
        }

        console.debug(`[DEBUG] Batch #${batchNumber}: Fetching batch of up to ${this.batchSize} pending thumbnails (attempts < ${this.maxAttempts}).`);
        const batch = await this.db.collection('media').find(baseQuery).limit(this.batchSize).toArray();

        if (batch.length === 0) {
          console.debug(`[DEBUG] Batch #${batchNumber}: Fetched batch is empty, although count was > 0. Exiting loop.`);
          break;
        }

        logger.debug(`Batch #${batchNumber}: Processing ${batch.length} pending thumbnails`);
        console.debug(`[DEBUG] Batch #${batchNumber}: Found ${batch.length} items in batch:`, batch.map(m => ({ id: m._id, path: m.path, attempts: m.thumb_attempts })));

        console.debug(`[DEBUG] Batch #${batchNumber}: Processing batch of ${batch.length} items`);

          // Process items in parallel with concurrency limit
        for (let i = 0; i < batch.length; i += this.concurrentLimit) {
          const chunk = batch.slice(i, i + this.concurrentLimit);
          const promises = chunk.map(async (media) => {
            try {
              console.debug(`[DEBUG] Processing media ${media._id}`);
              // Get source configuration
              const source = await this.db.collection('sources').findOne({ _id: new ObjectId(media.sourceId) });
              if (!source) {
                throw new Error(`Source not found for media: ${media._id}`);
              }

              let inputPath = media.path;
              let needsCleanup = false;

              // Handle SFTP sources
              if (source.type === 'sftp') {
                const source = await this.db.collection('sources').findOne({ _id: media.sourceId });
                if (!source) throw new Error(`Source not found: ${media.sourceId}`);

                if (!this.sftpConnections[source._id]) {
                  this.sftpConnections[source._id] = this.sftpService;
                  await this.sftpConnections[source._id].connect({
                    host: source.config.host,
                    port: source.config.port,
                    username: source.config.user,
                    password: source.config.pass
                  });
                }

                await this.sftpConnections[source._id].ensureTempDir();
                inputPath = await this.sftpConnections[source._id].downloadFile(media.path);
                needsCleanup = true;
                console.debug(`[DEBUG] Downloaded SFTP file to ${inputPath}`);
              }

                // Generate thumbnail based on media type
                let outputPath;
                if (!media.type) {
                  console.warn(`[WARN] Media type not defined for ${media._id}, attempting to detect from path`);
                  const ext = path.extname(media.path).toLowerCase();
                  media.type = ext.match(/\.(jpg|jpeg|png|gif)$/) ? 'image' : 'video';
                }
                
                if (media.type === 'image' || media.type.startsWith('image/')) {
                  outputPath = await this.thumbnailService.generateImageThumbnail(inputPath, media.hash);
                } else if (media.type === 'video' || media.type.startsWith('video/')) {
                  outputPath = await this.thumbnailService.generateVideoThumbnail(inputPath, media.hash);
                } else {
                  throw new Error(`Unsupported media type: ${media.type}`);
                }

              // Cleanup temp file if needed
              if (needsCleanup) {
                try {
                  await this.sftpConnections[source._id].cleanupTempFile(inputPath);
                } catch (cleanupError) {
                  console.warn(`[WARN] Failed to cleanup temp file ${inputPath}:`, cleanupError);
                }
              }

              // Update database
              await this.db.collection('media').updateOne(
                { _id: media._id },
                { $set: { has_thumb: true, thumb_pending: false }, $inc: { thumb_attempts: 1 } }
              );

              // Record history
              await this.db.collection('thumbnail_history').insertOne({
                mediaId: media._id,
                sourceId: media.sourceId,
                timestamp: new Date(),
                status: 'success',
                duration: Date.now() - this.lastProcessedTime
              });

              this.processedCount++;
              this.processedCount++;
              this.lastProcessedTime = Date.now();
              console.debug(`[DEBUG] Successfully generated thumbnail for ${media._id}`);
              return true;
            } catch (error) {
              console.error(`[ERROR] Failed to process thumbnail for ${media._id}:`, error);


              // Update failure in database
              await this.db.collection('media').updateOne(
                { _id: media._id },
                { $set: { thumb_pending: false }, $inc: { thumb_attempts: 1 } }
              );

              // Record failure in history
              await this.db.collection('thumbnail_history').insertOne({
                mediaId: media._id,
                sourceId: media.sourceId,
                timestamp: new Date(),
                status: 'error',
                error: error.message,
                duration: Date.now() - this.lastProcessedTime
              });
              return false;
            }
          });

          // Wait for all promises in chunk to complete
          await Promise.all(promises);

          // Apply CPU cooldown after each chunk if needed
          if (this.cpuCooldown > 0) {
            await this.sleep(this.cpuCooldown * 1000);
          }
        }

        console.debug(`[DEBUG] Finished processing loop for Batch #${batchNumber}. Batch Results: ${batchSuccessCount} success, ${batchFailureCount} failures. Duration: ${Date.now() - batchStartTime}ms`);

        await this.sleep(500);
      }
    } catch (error) {
        logger.error('Error during thumbnail generation run:', error);
        console.error('[ERROR_DEBUG] Error during thumbnail generation run:', error);
    } finally {
      // Cleanup SFTP connections
      for (const [sourceId, sftpConnection] of Object.entries(this.sftpConnections)) {
        try {
          await sftpConnection.disconnect();
        } catch (error) {
          console.log('[DEBUG] Error disconnecting SFTP', { sourceId, message: error.message });
        }
      }
      this.sftpConnections = {};

      this.isGenerating = false;
      const totalDuration = Date.now() - overallStartTime;
      const finalWorkRatio = ((this.processedCount / totalDuration) * 1000).toFixed(2);
      console.debug(`[DEBUG] Completed generatePendingThumbnails FULL run. Duration: ${totalDuration}ms, Work ratio: ${finalWorkRatio} thumbs/sec`);
      logger.info(`Thumbnail generation FULL run completed in ${totalDuration}ms. Total Processed: ${totalProcessedCount}, Success: ${totalSuccessCount}, Failed: ${totalFailureCount}.`);
      console.debug(`[DEBUG] Thumbnail generation FULL run finished. Duration: ${totalDuration}ms. Total Processed: ${totalProcessedCount}. isGenerating set to false.`);
    }
  }

  async getStatus() {
    console.debug('[DEBUG] Getting thumbnail generation status.');
    const pendingCount = await this.db.collection('media').countDocuments({
      has_thumb: false,
      thumb_pending: true,
      thumb_attempts: { $lt: this.maxAttempts }
    });
    console.debug(`[DEBUG] Pending count query result: ${pendingCount}`);

    const failedCount = await this.db.collection('media').countDocuments({
      has_thumb: false,
      thumb_pending: false,
      thumb_attempts: { $gte: this.maxAttempts }
    });
    console.debug(`[DEBUG] Failed count query result: ${failedCount}`);

    const lastRun = await this.db.collection('thumbnail_history')
      .findOne({}, { sort: { timestamp: -1 } });
    console.debug(`[DEBUG] Last history entry found:`, lastRun ? { id: lastRun._id, time: lastRun.timestamp } : null);

    const cpuUsage = await this.getCPUUsage();

    // Calculate work ratio and time estimates
    let workRatio = 0;
    let elapsedTime = 0;
    let remainingTime = null;
    let estimatedCompletionTime = null;

    if (this.isGenerating && this.processingStartTime) {
      elapsedTime = Math.floor((Date.now() - this.processingStartTime) / 1000);
      if (elapsedTime > 0) {
        workRatio = (this.processedCount / elapsedTime).toFixed(2);
        
        // Calculate remaining time if we have a valid work ratio
        if (parseFloat(workRatio) > 0) {
          const remainingItems = pendingCount;
          remainingTime = Math.ceil(remainingItems / parseFloat(workRatio));
          estimatedCompletionTime = new Date(Date.now() + (remainingTime * 1000));
        }
      }
    }

    // Format remaining time
    let remainingTimeFormatted = null;
    if (remainingTime !== null) {
      const hours = Math.floor(remainingTime / 3600);
      const minutes = Math.floor((remainingTime % 3600) / 60);
      const seconds = remainingTime % 60;
      
      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
      
      remainingTimeFormatted = parts.join(' ');
    }

    const status = {
      isGenerating: this.isGenerating,
      pendingCount,
      failedCount,
      lastEvent: lastRun?.timestamp || null,
      cpuUsage,
      cpuThrottling: cpuUsage > this.cpuUsageLimit,
      workRatio,
      processedCount: this.processedCount,
      elapsedTime,
      remainingTime: remainingTimeFormatted,
      estimatedCompletionTime: estimatedCompletionTime?.toLocaleString() || null
    };
    console.debug('[DEBUG] Returning status:', status);
    return status;
  }

  async getHistory(query = {}) {
    console.debug('[DEBUG] Getting thumbnail history with query:', query);
    const { sourceId, status, from, to, limit = 100 } = query;
    const filter = {};

    if (sourceId) {
       if (ObjectId.isValid(sourceId)) {
         filter.sourceId = new ObjectId(sourceId);
       } else {
         console.warn(`[WARN] Invalid sourceId format received in getHistory: ${sourceId}`);
       }
    }
    if (status) filter.status = status;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    console.debug('[DEBUG] History filter:', filter);
    const history = await this.db.collection('thumbnail_history')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .toArray();
    console.debug(`[DEBUG] Found ${history.length} history entries.`);
    return history;
  }
}

module.exports = ThumbnailGenerationService;