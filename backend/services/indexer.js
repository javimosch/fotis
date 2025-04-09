const { MAX_FILE_READS_PER_SECOND } = process.env;
const { ObjectId } = require('mongodb');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { isImage, isVideo } = require('../utils/fileUtils');

class Indexer {
  constructor(db) {
    this.db = db;
    this.isIndexing = false;
  }

  async scanDirectory(dirPath) {
    logger.debug('Scanning directory:', dirPath);
    let files = [];
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      logger.debug(`Found ${entries.length} entries in directory`);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        logger.debug('Processing entry:', {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          fullPath
        });

        if (entry.isDirectory()) {
          logger.debug('Recursively scanning subdirectory:', fullPath);
          const subFiles = await this.scanDirectory(fullPath);
          files = files.concat(subFiles);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          const originalExt = path.extname(entry.name);
          logger.debug('Checking file:', {
            name: entry.name,
            extension: ext,
            originalExtension: originalExt,
            isImageResult: isImage(entry.name),
            isVideoResult: isVideo(entry.name)
          });

          if (isImage(entry.name) || isVideo(entry.name)) {
            try {
              const stats = await fs.stat(fullPath);
              logger.debug('Found media file:', {
                path: fullPath,
                size: stats.size,
                modified: stats.mtime
              });
              files.push({
                path: fullPath,
                type: isImage(entry.name) ? 'image' : 'video',
                stats
              });
            } catch (error) {
              logger.error('Error getting file stats:', {
                file: fullPath,
                error: error.message
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error scanning directory:', {
        directory: dirPath,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }

    logger.debug(`Scan complete for ${dirPath}. Found ${files.length} media files`);
    return files;
  }

  async startIndexing(sourceId) {
    logger.debug('Starting indexing process for sourceId:', sourceId);
    
    if (this.isIndexing) {
      logger.debug('Indexing already in progress, aborting');
      throw new Error('Indexing already in progress');
    }

    this.isIndexing = true;
    let totalFiles = 0;
    let processedFiles = 0;

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
        config: source.config,
        id: source._id.toString()
      });

      if (source.type === 'local') {
        logger.debug('Processing local source');
        const sourcePath = source.config.path;
        
        // Check if path exists
        try {
          const pathStats = await fs.stat(sourcePath);
          logger.debug('Source path stats:', {
            exists: true,
            isDirectory: pathStats.isDirectory(),
            size: pathStats.size,
            modified: pathStats.mtime
          });
        } catch (error) {
          logger.error('Source path error:', {
            path: sourcePath,
            error: error.message,
            code: error.code
          });
          throw new Error(`Invalid source path: ${error.message}`);
        }

        // Scan for media files
        const files = await this.scanDirectory(sourcePath);
        totalFiles = files.length;
        logger.debug(`Found ${totalFiles} total media files`);

        // Process each file
        for (const file of files) {
          try {
            logger.debug('Processing file:', {
              path: file.path,
              type: file.type,
              stats: {
                size: file.stats.size,
                modified: file.stats.mtime
              }
            });

            // TODO: Generate thumbnails and update database
            processedFiles++;
          } catch (error) {
            logger.error('Error processing file:', {
              file: file.path,
              error: error.message
            });
          }
        }
      }

      // Store indexing history
      logger.debug('Storing indexing history', {
        totalFiles,
        processedFiles
      });
      
      await this.db.collection('indexing_history').insertOne({
        sourceId: new ObjectId(sourceId),
        timestamp: new Date(),
        totalFiles,
        processedFiles,
        status: 'completed'
      });
      
      logger.debug('Indexing completed successfully');
    } catch (error) {
      logger.error('Indexing failed:', {
        error: error.message,
        stack: error.stack
      });
      
      // Store failed indexing attempt
      await this.db.collection('indexing_history').insertOne({
        sourceId: new ObjectId(sourceId),
        timestamp: new Date(),
        totalFiles,
        processedFiles,
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