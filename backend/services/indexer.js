const { MAX_FILE_READS_PER_SECOND } = process.env;
const { ObjectId } = require('mongodb');
const logger = require('../utils/logger');

class Indexer {
  constructor(db) {
    this.db = db;
    this.isIndexing = false;
  }

  async startIndexing(sourceId) {
    logger.debug('Starting indexing process for sourceId:', sourceId);
    
    if (this.isIndexing) {
      logger.debug('Indexing already in progress, aborting');
      throw new Error('Indexing already in progress');
    }

    this.isIndexing = true;
    try {
      // Get source configuration
      logger.debug('Fetching source configuration');
      const source = await this.db.collection('sources').findOne({ 
        _id: new ObjectId(sourceId) 
      });
      
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }
      
      logger.debug('Source configuration:', {
        type: source.type,
        config: source.config
      });

      // TODO: Implement indexing logic
      // 1. Get source configuration
      // 2. Scan files (local or SFTP)
      // 3. Generate thumbnails
      // 4. Update database
      logger.debug('Source path to scan:', source.config.path);

      // Store indexing history
      logger.debug('Storing indexing history');
      await this.db.collection('indexing_history').insertOne({
        sourceId: new ObjectId(sourceId),
        timestamp: new Date(),
        totalFiles: 0, // TODO: Update with actual counts
        processedFiles: 0,
        status: 'completed'
      });
      
      logger.debug('Indexing completed successfully');
    } catch (error) {
      logger.error('Indexing failed:', error);
      // Store failed indexing attempt
      await this.db.collection('indexing_history').insertOne({
        sourceId: new ObjectId(sourceId),
        timestamp: new Date(),
        totalFiles: 0,
        processedFiles: 0,
        status: 'failed',
        error: error.message
      });
      throw error;
    } finally {
      this.isIndexing = false;
      logger.debug('Indexing process finished, isIndexing set to false');
    }
  }

  async getStatus(sourceId) {
    logger.debug('Getting status for sourceId:', sourceId);
    // TODO: Implement status checking
    return {
      isIndexing: this.isIndexing,
      totalFiles: 0,
      processedFiles: 0,
      lastIndexed: null
    };
  }

  async getHistory(sourceId) {
    logger.debug('Fetching history for sourceId:', sourceId);
    return await this.db.collection('indexing_history')
      .find({ sourceId: new ObjectId(sourceId) })
      .sort({ timestamp: -1 })
      .toArray();
  }
}

module.exports = Indexer;