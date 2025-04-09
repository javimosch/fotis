const cron = require('node-cron');
const os = require('os');
const logger = require('../utils/logger');
const ThumbnailService = require('./thumbnails');
const fs = require('fs').promises;
const { formatBytes } = require('../utils/fileUtils');

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
      await this.generatePendingThumbnails();
    });
    logger.info('Thumbnail generation service started');
  }

  async getCPUUsage() {
    const cpus = os.cpus();
    const totalUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0);
    return totalUsage / cpus.length;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generatePendingThumbnails() {
    if (this.isGenerating) {
      logger.debug('Thumbnail generation already in progress');
      return;
    }

    this.isGenerating = true;
    const startTime = Date.now();

    try {
      // Get batch of pending thumbnails
      const batch = await this.db.collection('media').find({
        has_thumb: false,
        thumb_pending: true,
        thumb_attempts: { $lt: this.maxAttempts }
      }).limit(this.batchSize).toArray();

      logger.debug(`Processing ${batch.length} pending thumbnails`);

      for (const media of batch) {
        const genStartTime = Date.now();

        try {
          // Check CPU usage and apply throttling if needed
          const cpuUsage = await this.getCPUUsage();
          const cooldownTime = cpuUsage > this.cpuUsageLimit 
            ? this.cpuCooldown * this.throttleMultiplier 
            : this.cpuCooldown;

          if (cooldownTime > this.cpuCooldown) {
            logger.debug(`CPU usage high (${cpuUsage.toFixed(1)}%), increasing cooldown`);
          }

          // Generate thumbnail
          let thumbPath, thumbStats;
          if (media.type === 'image') {
            thumbPath = await this.thumbnailService.generateImageThumbnail(media.path, media.hash);
            thumbStats = await fs.stat(thumbPath);
          } else if (media.type === 'video') {
            thumbPath = await this.thumbnailService.generateVideoThumbnail(media.path, media.hash);
            thumbStats = await fs.stat(thumbPath);
          }

          // Update media document
          await this.db.collection('media').updateOne(
            { _id: media._id },
            {
              $set: {
                has_thumb: true,
                thumb_pending: false,
                thumb_path: thumbPath,
                thumb_size: thumbStats.size,
                thumb_size_human: formatBytes(thumbStats.size)
              },
              $inc: { thumb_attempts: 1 }
            }
          );

          // Record success in history
          await this.db.collection('thumbnail_history').insertOne({
            mediaId: media._id,
            sourceId: media.sourceId,
            timestamp: new Date(),
            status: 'success',
            duration: Date.now() - genStartTime,
            input_size: media.size,
            output_size: thumbStats.size,
            attempt: media.thumb_attempts + 1
          });

          // Apply CPU throttling cooldown
          await this.sleep(cooldownTime);

        } catch (error) {
          logger.error('Thumbnail generation failed:', {
            mediaId: media._id.toString(),
            path: media.path,
            error: error.message
          });

          // Update media document with failure
          await this.db.collection('media').updateOne(
            { _id: media._id },
            {
              $inc: { thumb_attempts: 1 },
              $set: {
                thumb_pending: media.thumb_attempts + 1 >= this.maxAttempts ? false : true
              }
            }
          );

          // Record failure in history
          await this.db.collection('thumbnail_history').insertOne({
            mediaId: media._id,
            sourceId: media.sourceId,
            timestamp: new Date(),
            status: 'failed',
            error: error.message,
            duration: Date.now() - genStartTime,
            input_size: media.size,
            attempt: media.thumb_attempts + 1
          });

          // Still apply cooldown after failure
          await this.sleep(this.cpuCooldown);
        }
      }

    } finally {
      this.isGenerating = false;
      logger.debug(`Thumbnail generation batch completed in ${Date.now() - startTime}ms`);
    }
  }

  async getStatus() {
    const pendingCount = await this.db.collection('media').countDocuments({
      has_thumb: false,
      thumb_pending: true
    });

    const failedCount = await this.db.collection('media').countDocuments({
      has_thumb: false,
      thumb_pending: false,
      thumb_attempts: { $gte: this.maxAttempts }
    });

    const lastRun = await this.db.collection('thumbnail_history')
      .findOne({}, { sort: { timestamp: -1 } });

    const cpuUsage = await this.getCPUUsage();

    return {
      isGenerating: this.isGenerating,
      pendingCount,
      failedCount,
      lastRunTime: lastRun?.timestamp || null,
      cpuUsage,
      cooldownActive: cpuUsage > this.cpuUsageLimit
    };
  }

  async getHistory(query = {}) {
    const { sourceId, status, from, to } = query;
    const filter = {};

    if (sourceId) filter.sourceId = new ObjectId(sourceId);
    if (status) filter.status = status;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    return await this.db.collection('thumbnail_history')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
  }
}

module.exports = ThumbnailGenerationService;