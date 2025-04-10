const cron = require('node-cron');
const os = require('os');
const logger = require('../utils/logger');
const ThumbnailService = require('./thumbnails');
const fs = require('fs').promises;
const { formatBytes } = require('../utils/fileUtils');
const { ObjectId } = require('mongodb');

class ThumbnailGenerationService {
  constructor(db) {
    this.db = db;
    this.thumbnailService = new ThumbnailService();
    this.isGenerating = false;
    this.batchSize = parseInt(process.env.THUMB_BATCH_SIZE, 10) || 10;
    this.maxAttempts = parseInt(process.env.THUMB_MAX_ATTEMPTS, 10) || 3;
    this.cpuCooldown = parseInt(process.env.THUMB_CPU_COOLDOWN, 10) || 2000;
    this.cpuUsageLimit = parseInt(process.env.THUMB_CPU_USAGE_LIMIT, 10) || 80;
    this.throttleMultiplier = parseInt(process.env.THUMB_THROTTLE_MULTIPLIER, 10) || 2;
  }

  async start() {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.debug('[DEBUG] Cron job triggered thumbnail generation.');
      await this.generatePendingThumbnails();
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

  async generatePendingThumbnails() {
    if (this.isGenerating) {
      logger.debug('Thumbnail generation already in progress, skipping run.');
      console.debug('[DEBUG] Thumbnail generation already in progress, skipping run.');
      return;
    }

    console.debug('[DEBUG] Starting generatePendingThumbnails FULL run.');
    this.isGenerating = true;
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

        const totalPendingBeforeBatch = await this.db.collection('media').countDocuments({
          has_thumb: false,
          thumb_pending: true,
          thumb_attempts: { $lt: this.maxAttempts }
        });
        console.debug(`[DEBUG] Batch #${batchNumber}: Total pending items BEFORE fetching batch: ${totalPendingBeforeBatch}`);

        if (totalPendingBeforeBatch === 0) {
            console.debug(`[DEBUG] Batch #${batchNumber}: No more pending items found. Exiting loop.`);
            break;
        }

        console.debug(`[DEBUG] Batch #${batchNumber}: Fetching batch of up to ${this.batchSize} pending thumbnails (attempts < ${this.maxAttempts}).`);
        const batch = await this.db.collection('media').find({
          has_thumb: false,
          thumb_pending: true,
          thumb_attempts: { $lt: this.maxAttempts }
        }).limit(this.batchSize).toArray();

        if (batch.length === 0) {
          console.debug(`[DEBUG] Batch #${batchNumber}: Fetched batch is empty, although count was > 0. Exiting loop.`);
          break;
        }

        logger.debug(`Batch #${batchNumber}: Processing ${batch.length} pending thumbnails`);
        console.debug(`[DEBUG] Batch #${batchNumber}: Found ${batch.length} items in batch:`, batch.map(m => ({ id: m._id, path: m.path, attempts: m.thumb_attempts })));

        for (const media of batch) {
          batchProcessedCount++;
          totalProcessedCount++;
          const genStartTime = Date.now();
          console.debug(`[DEBUG] Batch #${batchNumber}, Item ${batchProcessedCount}/${batch.length}: Processing ${media._id} (${media.path})`);

          try {
            const cpuUsage = await this.getCPUUsage();
            let cooldownTime = this.cpuCooldown;

            if (cpuUsage > this.cpuUsageLimit) {
               cooldownTime = this.cpuCooldown * this.throttleMultiplier;
               logger.debug(`CPU usage high (${cpuUsage.toFixed(1)}%), increasing cooldown to ${cooldownTime}ms`);
               console.debug(`[DEBUG] CPU usage high (${cpuUsage.toFixed(1)}%), increasing cooldown to ${cooldownTime}ms`);
            } else {
               console.debug(`[DEBUG] CPU usage OK (${cpuUsage.toFixed(1)}%), using base cooldown ${cooldownTime}ms`);
            }

            let thumbPath, thumbStats;
            console.debug(`[DEBUG] Attempting thumbnail generation for type: ${media.type}`);
            if (media.type === 'image') {
              thumbPath = await this.thumbnailService.generateImageThumbnail(media.path, media.hash);
              thumbStats = await fs.stat(thumbPath);
              console.debug(`[DEBUG] Image thumbnail generated: ${thumbPath}, Size: ${thumbStats.size}`);
            } else if (media.type === 'video') {
              thumbPath = await this.thumbnailService.generateVideoThumbnail(media.path, media.hash);
              thumbStats = await fs.stat(thumbPath);
              console.debug(`[DEBUG] Video thumbnail generated: ${thumbPath}, Size: ${thumbStats.size}`);
            } else {
               console.warn(`[WARN] Unsupported media type for thumbnail generation: ${media.type} for ${media._id}`);
               throw new Error(`Unsupported media type: ${media.type}`);
            }

            const updateData = {
              $set: {
                has_thumb: true,
                thumb_pending: false,
                thumb_path: thumbPath,
                thumb_size: thumbStats.size,
                thumb_size_human: formatBytes(thumbStats.size)
              },
              $inc: { thumb_attempts: 1 }
            };
            console.debug(`[DEBUG] Preparing SUCCESS update for ${media._id}:`, JSON.stringify(updateData));

            const updateResult = await this.db.collection('media').updateOne(
              { _id: media._id },
              updateData
            );
            console.debug(`[DEBUG] SUCCESS DB update result for ${media._id}:`, JSON.stringify(updateResult));
            if (updateResult.modifiedCount === 1) {
               batchSuccessCount++;
               totalSuccessCount++;
            } else {
               console.warn(`[WARN] Thumbnail generated but DB update modified ${updateResult.modifiedCount} docs for ${media._id}. Check if document still exists and matches filter.`);
               batchFailureCount++;
               totalFailureCount++;
            }

            const historyDataSuccess = {
              mediaId: media._id,
              sourceId: media.sourceId,
              timestamp: new Date(),
              status: 'success',
              duration: Date.now() - genStartTime,
              input_size: media.size,
              output_size: thumbStats.size,
              attempt: (media.thumb_attempts || 0) + 1
            };
            console.debug(`[DEBUG] Inserting SUCCESS history for ${media._id}:`, JSON.stringify(historyDataSuccess));

            await this.db.collection('thumbnail_history').insertOne(historyDataSuccess);

            await this.sleep(cooldownTime);
          } catch (error) {
            batchFailureCount++;
            totalFailureCount++;
            logger.error('Thumbnail generation failed:', {
              mediaId: media._id.toString(),
              path: media.path,
              error: error.message,
              stack: error.stack
            });
            console.error(`[ERROR_DEBUG] Thumbnail generation failed for ${media._id}: ${error.message}`);

            const currentAttempts = (media.thumb_attempts || 0) + 1;
            const shouldRetry = currentAttempts < this.maxAttempts;
            console.debug(`[DEBUG] Failure on attempt ${currentAttempts} for ${media._id}. Max attempts: ${this.maxAttempts}. Should retry: ${shouldRetry}`);

            const updateFailureData = {
              $inc: { thumb_attempts: 1 },
              $set: {
                thumb_pending: shouldRetry
              }
            };
            console.debug(`[DEBUG] Preparing FAILURE update for ${media._id}:`, JSON.stringify(updateFailureData));

            const updateFailureResult = await this.db.collection('media').updateOne(
              { _id: media._id },
              updateFailureData
            );
            console.debug(`[DEBUG] FAILURE DB update result for ${media._id}:`, JSON.stringify(updateFailureResult));
            if (updateFailureResult.modifiedCount !== 1) {
               console.warn(`[WARN] Thumbnail failed and DB update modified ${updateFailureResult.modifiedCount} docs for ${media._id}. Check if document still exists and matches filter.`);
            }

            const historyDataFailure = {
              mediaId: media._id,
              sourceId: media.sourceId,
              timestamp: new Date(),
              status: 'failed',
              error: error.message,
              duration: Date.now() - genStartTime,
              input_size: media.size,
              attempt: currentAttempts
            };
            console.debug(`[DEBUG] Inserting FAILURE history for ${media._id}:`, JSON.stringify(historyDataFailure));

            await this.db.collection('thumbnail_history').insertOne(historyDataFailure);

            await this.sleep(this.cpuCooldown);
          }
        }

        console.debug(`[DEBUG] Finished processing loop for Batch #${batchNumber}. Batch Results: ${batchSuccessCount} success, ${batchFailureCount} failures. Duration: ${Date.now() - batchStartTime}ms`);

        await this.sleep(500);
      }
    } catch (error) {
        logger.error('Error during thumbnail generation run:', error);
        console.error('[ERROR_DEBUG] Error during thumbnail generation run:', error);
    } finally {
      this.isGenerating = false;
      const overallDuration = Date.now() - overallStartTime;
      logger.info(`Thumbnail generation FULL run completed in ${overallDuration}ms. Total Processed: ${totalProcessedCount}, Success: ${totalSuccessCount}, Failed: ${totalFailureCount}.`);
      console.debug(`[DEBUG] Thumbnail generation FULL run finished. Duration: ${overallDuration}ms. Total Processed: ${totalProcessedCount}. isGenerating set to false.`);
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
    const status = {
      isGenerating: this.isGenerating,
      pendingCount,
      failedCount,
      lastRunTime: lastRun?.timestamp || null,
      cpuUsage,
      cooldownActive: cpuUsage > this.cpuUsageLimit
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