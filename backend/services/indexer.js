const { MAX_FILE_READS_PER_SECOND } = process.env;
const { ObjectId } = require('mongodb');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { isImage, isVideo, generateFileHash, formatBytes } = require('../utils/fileUtils');
const ThumbnailService = require('./thumbnails');
const SftpService = require('./sftp');

class Indexer {
  constructor(db) {
    this.db = db;
    this.isIndexing = false;
    this.thumbnailService = new ThumbnailService();
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
      await this.thumbnailService.ensureCacheDir();

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

      let files = [];
      if (source.type === 'local') {
        logger.debug('Processing local source');
        const sourcePath = source.config.path;
        
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

        files = await this.scanDirectory(sourcePath);
      } else if (source.type === 'sftp') {
        logger.debug('Processing SFTP source');
        const sftp = new SftpService();
        
        try {
          logger.debug('Connecting to SFTP server...', {
            host: source.config.host,
            port: source.config.port,
            user: source.config.user,
            path: source.config.path
          });

          await sftp.connect({
            host: source.config.host,
            port: source.config.port || 22,
            username: source.config.user,
            password: source.config.pass
          });

          logger.debug('SFTP connection successful');
          logger.debug('Listing SFTP directory:', source.config.path);

          const sftpFiles = await sftp.listFiles(source.config.path);
          logger.debug('SFTP directory listing result:', {
            totalEntries: sftpFiles.length,
            firstFew: sftpFiles.slice(0, 3)
          });

          files = sftpFiles
            .filter(file => !file.isDirectory)
            .filter(file => isImage(file.name) || isVideo(file.name))
            .map(file => ({
              path: path.join(source.config.path, file.name),
              type: isImage(file.name) ? 'image' : 'video',
              stats: {
                size: file.size,
                modified: file.modifyTime
              }
            }));

          logger.debug('Filtered SFTP files:', {
            totalFiles: files.length,
            firstFewPaths: files.slice(0, 3).map(f => f.path)
          });

          await sftp.disconnect();
          logger.debug('SFTP connection closed');
        } catch (error) {
          logger.error('SFTP error:', {
            error: error.message,
            stack: error.stack,
            phase: 'listing'
          });
          throw new Error(`SFTP error: ${error.message}`);
        }
      }

      totalFiles = files.length;
      logger.debug(`Found ${totalFiles} total media files`);

      const mediaCollection = this.db.collection('media');
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

          const hash = generateFileHash(file.path);
          
          const mediaDoc = {
            sourceId: new ObjectId(sourceId),
            path: file.path,
            type: file.type,
            hash,
            size: file.stats.size,
            size_human: formatBytes(file.stats.size),
            timestamp: file.stats.mtime || file.stats.modified,
            lastUpdated: new Date(),
            has_thumb: false,
            thumb_pending: true,
            thumb_attempts: 0
          };

          logger.debug('Upserting media document:', mediaDoc);

          await mediaCollection.updateOne(
            { hash },
            { $set: mediaDoc },
            { upsert: true }
          );

          processedFiles++;
          logger.debug(`Processed ${processedFiles}/${totalFiles} files`);
        } catch (error) {
          logger.error('Error processing file:', {
            file: file.path,
            error: error.message
          });
        }
      }

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
    const totalFiles = await this.db.collection('media').countDocuments({
      sourceId: new ObjectId(sourceId)
    });
    
    return {
      isIndexing: this.isIndexing,
      totalFiles,
      processedFiles: totalFiles,
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