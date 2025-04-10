const logger = require('../utils/logger');
const { ObjectId } = require('mongodb');

class DeduplicationService {
  constructor(db) {
    this.db = db;
    this.isCleaning = false;
    this.lastRunStats = {
      startTime: null,
      endTime: null,
      hashesProcessed: 0,
      duplicatesRemoved: 0,
      status: 'idle', // idle, running, completed, failed
      error: null,
    };
  }

  // Helper function for sleep
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runCleanup() {
    if (this.isCleaning) {
      logger.info('Deduplication cleanup is already running.');
      return this.lastRunStats;
    }

    this.isCleaning = true;
    const startTime = Date.now();
    this.lastRunStats = {
      startTime: new Date(startTime),
      endTime: null,
      hashesProcessed: 0,
      duplicatesRemoved: 0,
      status: 'running',
      error: null,
    };
    logger.info('Starting media deduplication cleanup...');

    try {
      const mediaCollection = this.db.collection('media');
      const pipeline = [
        {
          $group: {
            _id: "$hash", // Group documents by the unique hash
            count: { $sum: 1 }, // Count how many documents share the same hash
            docIds: { $push: "$_id" } // Collect the MongoDB ObjectIds of all documents in the group
          }
        },
        {
          $match: {
            count: { $gt: 1 } // Filter to only include groups where the count is greater than 1
          }
        }
        // Consider adding $limit here for very large collections to process in batches
      ];

      logger.debug('Running deduplication aggregation pipeline...');
      const duplicateGroups = await mediaCollection.aggregate(pipeline).toArray();
      this.lastRunStats.hashesProcessed = duplicateGroups.length;
      logger.info(`Found ${duplicateGroups.length} hashes with duplicate entries.`);

      let totalRemoved = 0;
      for (const group of duplicateGroups) {
        logger.debug(`Processing hash ${group._id} which has ${group.count} entries.`);

        // Sort IDs chronologically (oldest first)
        const sortedIds = group.docIds.sort();
        const idsToRemove = sortedIds.slice(1); // Keep the first (oldest), remove the rest

        if (idsToRemove.length > 0) {
          try {
            const deleteResult = await mediaCollection.deleteMany({
              _id: { $in: idsToRemove }
            });
            if (deleteResult.deletedCount > 0) {
              logger.info(`Removed ${deleteResult.deletedCount} duplicates for hash ${group._id}.`);
              totalRemoved += deleteResult.deletedCount;
            } else {
              logger.warn(`Expected to remove duplicates for hash ${group._id}, but deleteMany reported 0 removed.`);
            }
          } catch (deleteError) {
            logger.error(`Failed to delete duplicates for hash ${group._id}:`, deleteError);
            // Optionally: Collect errors and continue, or re-throw to stop
          }
          // Optional sleep to reduce load
          // await this.sleep(50);
        }
      }

      this.lastRunStats.duplicatesRemoved = totalRemoved;
      this.lastRunStats.status = 'completed';
      logger.info(`Completed deduplication cleanup. Removed ${totalRemoved} duplicate documents.`);

    } catch (error) {
      logger.error('Deduplication cleanup failed:', error);
      this.lastRunStats.status = 'failed';
      this.lastRunStats.error = error.message;
    } finally {
      this.isCleaning = false;
      this.lastRunStats.endTime = new Date();
      logger.debug('Deduplication cleanup finished.');
    }
    return this.lastRunStats;
  }

  getStatus() {
    // Return a copy to prevent external modification
    return { ...this.lastRunStats, isCleaning: this.isCleaning };
  }
}

module.exports = DeduplicationService;