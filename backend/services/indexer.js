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
    logger.debug('Scanning local directory:', dirPath);
    let files = [];
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      logger.debug(`Found ${entries.length} entries in local directory`);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        logger.debug('Processing local entry:', {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          fullPath
        });

        if (entry.isDirectory()) {
          logger.debug('Recursively scanning local subdirectory:', fullPath);
          const subFiles = await this.scanDirectory(fullPath);
          files = files.concat(subFiles);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          const originalExt = path.extname(entry.name);
          logger.debug('Checking local file:', {
            name: entry.name,
            extension: ext,
            originalExtension: originalExt,
            isImageResult: isImage(entry.name),
            isVideoResult: isVideo(entry.name)
          });

          if (isImage(entry.name) || isVideo(entry.name)) {
            try {
              const stats = await fs.stat(fullPath);
              logger.debug('Found local media file:', {
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
              logger.error('Error getting local file stats:', {
                file: fullPath,
                error: error.message
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error scanning local directory:', {
        directory: dirPath,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }

    logger.debug(`Local scan complete for ${dirPath}. Found ${files.length} media files`);
    return files;
  }

  async scanSftpDirectory(sftp, dirPath) {
    logger.debug('Scanning SFTP directory:', dirPath);
    let files = [];
    try {
      const entries = await sftp.listFiles(dirPath);
      logger.debug(`Found ${entries.length} entries in SFTP directory ${dirPath}`);

      for (const entry of entries) {
        const fullPath = path.posix.join(dirPath, entry.name);
        logger.debug('Processing SFTP entry:', {
          name: entry.name,
          isDirectory: entry.type === 'd',
          fullPath
        });

        if (entry.type === 'd') {
          logger.debug('Recursively scanning SFTP subdirectory:', fullPath);
          const subFiles = await this.scanSftpDirectory(sftp, fullPath);
          files = files.concat(subFiles);
        } else {
          logger.debug('Checking SFTP file:', {
            name: entry.name,
            isImageResult: isImage(entry.name),
            isVideoResult: isVideo(entry.name)
          });

          if (isImage(entry.name) || isVideo(entry.name)) {
            logger.debug('Found SFTP media file:', {
              path: fullPath,
              size: entry.size,
              modified: entry.modifyTime
            });
            files.push({
              path: fullPath,
              type: isImage(entry.name) ? 'image' : 'video',
              stats: {
                size: entry.size,
                mtime: new Date(entry.modifyTime),
                modified: new Date(entry.modifyTime)
              }
            });
          }
        }
      }
    } catch (error) {
      if (error.code === 'EACCES') {
         logger.error('Permission denied scanning SFTP directory:', {
           directory: dirPath,
           error: error.message
         });
      } else {
        logger.error('Error scanning SFTP directory:', {
          directory: dirPath,
          error: error.message,
          stack: error.stack
        });
      }
      try { await sftp.disconnect(); } catch (disconnectErr) { logger.error('Error disconnecting SFTP after failure:', disconnectErr); }
      throw new Error(`SFTP error: ${error.message}`);
    }

    logger.debug(`SFTP scan complete for ${dirPath}. Found ${files.length} media files in this branch`);
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
    const indexingStartTime = Date.now();

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
          logger.debug('Starting recursive SFTP scan from:', source.config.path);

          files = await this.scanSftpDirectory(sftp, source.config.path);

          logger.debug('Completed recursive SFTP scan. Total files found:', files.length);
          logger.debug('First few SFTP files found:', files.slice(0, 5).map(f => f.path));

          await sftp.disconnect();
          logger.debug('SFTP connection closed');
        } catch (error) {
          logger.error('SFTP error during indexing:', {
            error: error.message,
            stack: error.stack,
            phase: 'connection or scanning'
          });
          try { await sftp.disconnect(); } catch (disconnectErr) { logger.error('Error disconnecting SFTP after failure:', disconnectErr); }
          throw new Error(`SFTP error: ${error.message}`);
        }
      }

      totalFiles = files.length;
      logger.debug(`Found ${totalFiles} total media files across all sources/types.`);

      const mediaCollection = this.db.collection('media');
      for (const file of files) {
        try {
          logger.debug('Processing file:', {
            path: file.path,
            type: file.type,
            stats: {
              size: file.stats.size,
              modified: file.stats.mtime || file.stats.modified
            }
          });

          let hashInput = file.path;
          if (source.type === 'local') {
             hashInput = path.relative(source.config.path, file.path);
          }
          hashInput = `${sourceId}:${hashInput}`;

          const hash = generateFileHash(hashInput);

          const mediaDoc = {
            sourceId: new ObjectId(sourceId),
            path: file.path,
            relativePath: (source.type === 'local' ? path.relative(source.config.path, file.path) : file.path.substring(source.config.path.length).replace(/^\//, '')),
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

          logger.debug('Upserting media document with hash:', hash, mediaDoc);

          await mediaCollection.updateOne(
            { hash },
            { $set: mediaDoc },
            { upsert: true }
          );

          processedFiles++;
          if (processedFiles % 100 === 0 || processedFiles === totalFiles) {
             logger.debug(`Processed ${processedFiles}/${totalFiles} files`);
          }
        } catch (error) {
          logger.error('Error processing file during indexing:', {
            file: file.path,
            error: error.message,
            stack: error.stack
          });
        }
      }

      const indexingEndTime = Date.now();
      const durationMs = indexingEndTime - indexingStartTime;
      logger.debug('Storing indexing history', {
        totalFiles,
        processedFiles,
        durationMs
      });

      await this.db.collection('indexing_history').insertOne({
        sourceId: new ObjectId(sourceId),
        timestamp: new Date(indexingStartTime),
        durationMs,
        totalFiles,
        processedFiles,
        status: 'completed'
      });

      logger.info(`Indexing completed successfully for source ${sourceId}. Duration: ${durationMs}ms`);
    } catch (error) {
      const indexingEndTime = Date.now();
      const durationMs = indexingEndTime - indexingStartTime;
      logger.error('Indexing failed:', {
        sourceId: sourceId,
        error: error.message,
        stack: error.stack,
        durationMs
      });

      await this.db.collection('indexing_history').insertOne({
        sourceId: new ObjectId(sourceId),
        timestamp: new Date(indexingStartTime),
        durationMs,
        totalFiles,
        processedFiles,
        status: 'failed',
        error: error.message
      });
    } finally {
      this.isIndexing = false;
      logger.debug('Indexing process finished, isIndexing set to false');
    }
  }

  async getStatus(sourceId) {
    logger.debug('Getting status for sourceId:', sourceId);
    const db = this.db;
    const sourceObjectId = new ObjectId(sourceId);

    const totalFiles = await db.collection('media').countDocuments({
      sourceId: sourceObjectId
    });

    const lastHistoryEntry = await db.collection('indexing_history')
      .find({ sourceId: sourceObjectId })
      .sort({ timestamp: -1 })
      .limit(1)
      .next();

    return {
      isIndexing: this.isIndexing,
      totalFiles,
      processedFiles: lastHistoryEntry ? lastHistoryEntry.processedFiles : 0,
      lastIndexed: lastHistoryEntry ? lastHistoryEntry.timestamp : null,
      lastStatus: lastHistoryEntry ? lastHistoryEntry.status : 'unknown',
      lastDurationMs: lastHistoryEntry ? lastHistoryEntry.durationMs : null,
      lastError: lastHistoryEntry && lastHistoryEntry.status === 'failed' ? lastHistoryEntry.error : null
    };
  }

  async getHistory(sourceId) {
    logger.debug('Fetching history for sourceId:', sourceId);
    const db = this.db;
    return await db.collection('indexing_history')
      .find({ sourceId: new ObjectId(sourceId) })
      .sort({ timestamp: -1 })
      .toArray();
  }
}

module.exports = Indexer;