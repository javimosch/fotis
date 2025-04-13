const cron = require('node-cron');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { ObjectId } = require('mongodb');

class ThumbnailsPruner {
  constructor(db) {
    this.db = db;
    this.isPruning = false;
  }

  start() {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.debug('[DEBUG] Cron job triggered thumbnail pruning.');
      await this.pruneThumbnails();
    });
    logger.info('Thumbnail pruning service started');
  }

  async pruneThumbnails() {
    if (this.isPruning) {
      logger.debug('Pruning already in progress, skipping');
      return;
    }

    this.isPruning = true;
    const startTime = Date.now();
    let processedCount = 0;
    let removedCount = 0;
    const removedItems = []; // Track details of removed items

    try {
      logger.debug('Starting thumbnail pruning process');

      // Find all media documents that either:
      // 1. have has_thumb=true and thumb_path exists (check if file exists)
      // 2. have has_thumb=true but no thumb_path (need to be reset)
      const media = await this.db.collection('media').find({
        has_thumb: true,
        $or: [
          { thumb_path: { $exists: true } },
          { thumb_path: { $exists: false } }
        ]
      }).toArray();

      logger.debug(`Found ${media.length} thumbnails to check`);

      for (const item of media) {
        processedCount++;
        
        // Case 1: has thumb_path - check if file exists
        if (item.thumb_path) {
          const thumbPath = path.resolve(item.thumb_path);
          try {
            await fs.access(thumbPath);
            // File exists, continue to next item
            continue;
          } catch (fsError) {
            logger.debug(`Thumbnail file not accessible at: ${thumbPath}`, fsError);
            // File doesn't exist, track details
            removedItems.push({
              mediaId: item._id,
              path: item.path,
              thumbPath: item.thumb_path,
              reason: 'file_not_found',
              sourceId: item.sourceId
            });
          }
        } else {
          // Case 2: no thumb_path but has_thumb is true
          logger.debug(`Found media with has_thumb=true but no thumb_path: ${item._id}`);
          removedItems.push({
            mediaId: item._id,
            path: item.path,
            reason: 'missing_thumb_path',
            sourceId: item.sourceId
          });
        }

        // Reset thumbnail flags in document
        await this.db.collection('media').updateOne(
          { _id: item._id },
          {
            $set: {
              has_thumb: false,
              thumb_pending: true,
              thumb_attempts: 0
            },
            $unset: { thumb_path: "", thumb_size: "", thumb_size_human: "" }
          }
        );
        removedCount++;
      }

      // Group removed items by source for better reporting
      const sourceStats = {};
      for (const item of removedItems) {
        const sourceId = item.sourceId ? item.sourceId.toString() : 'unknown';
        if (!sourceStats[sourceId]) {
          sourceStats[sourceId] = {
            total: 0,
            file_not_found: 0,
            missing_thumb_path: 0
          };
        }
        sourceStats[sourceId].total++;
        sourceStats[sourceId][item.reason]++;
      }

      // Record pruning history with detailed stats
      await this.db.collection('thumbnail_history').insertOne({
        timestamp: new Date(),
        operation: 'prune',
        status: 'success',
        processedCount,
        removedCount,
        duration: Date.now() - startTime,
        details: {
          sourceStats,
          removedItems: removedItems.map(item => ({
            mediaId: item.mediaId,
            reason: item.reason,
            sourceId: item.sourceId
          }))
        }
      });

      logger.info(`Thumbnail pruning completed. Processed: ${processedCount}, Removed: ${removedCount}`);
    } catch (error) {
      logger.error('Error during thumbnail pruning:', error);

      // Record error in history
      await this.db.collection('thumbnail_history').insertOne({
        timestamp: new Date(),
        operation: 'prune',
        status: 'error',
        processedCount,
        removedCount,
        duration: Date.now() - startTime,
        error: error.message,
        details: {
          sourceStats: {},
          removedItems: []
        }
      });
    } finally {
      this.isPruning = false;
    }
  }

  async getStatus() {
    const lastRun = await this.db.collection('thumbnail_history')
      .findOne(
        { operation: 'prune' },
        { sort: { timestamp: -1 } }
      );

    return {
      isPruning: this.isPruning,
      lastRun: lastRun ? {
        timestamp: lastRun.timestamp,
        status: lastRun.status,
        processedCount: lastRun.processedCount,
        removedCount: lastRun.removedCount,
        duration: lastRun.duration,
        error: lastRun.error,
        details: lastRun.details || {} // Include detailed stats
      } : null
    };
  }
}

module.exports = ThumbnailsPruner;