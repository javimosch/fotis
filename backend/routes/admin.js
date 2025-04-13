const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const SftpService = require('../services/sftp');

// Trigger indexing job
router.post('/index', async (req, res, next) => {
  try {
    const { sourceId } = req.body;

    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId is required' });
    }

    logger.debug('Starting indexing for source:', sourceId);

    const indexer = req.app.locals.indexer;
    // Run indexing asynchronously
    indexer.startIndexing(sourceId);

    res.status(202).json({ message: 'Indexing started' }); // Respond immediately
  } catch (error) {
    logger.error('Indexing trigger error:', error);
    // Avoid sending headers twice if error occurs before async operation
    if (!res.headersSent) {
       next(error);
    }
  }
});

// Add new source
router.post('/sources', async (req, res, next) => {
  try {
    const { type, config } = req.body;
    const db = req.app.locals.db;

    // Basic validation
    if (!type || !config) {
      return res.status(400).json({ error: 'Missing type or config' });
    }
    if (type === 'local' && !config.path) {
      return res.status(400).json({ error: 'Missing config.path for local source' });
    }
    if (type === 'sftp' && (!config.host || !config.user || !config.pass || !config.path)) {
      return res.status(400).json({ error: 'Missing required SFTP config fields (host, user, pass, path)' });
    }

    const result = await db.collection('sources').insertOne({
      type,
      config,
      createdAt: new Date()
    });

    // Fetch the inserted document to return it fully
    const newSource = await db.collection('sources').findOne({ _id: result.insertedId });
    res.status(201).json(newSource);

  } catch (error) {
    logger.error('Add source error:', error);
    next(error);
  }
});

// Test source connection
router.post('/sources/test', async (req, res, next) => {
  try {
    const { sourceId } = req.body;
    const db = req.app.locals.db;

    if (!sourceId || !ObjectId.isValid(sourceId)) {
      return res.status(400).json({ error: 'Valid sourceId is required' });
    }

    logger.debug('Testing source connection:', sourceId);

    const source = await db.collection('sources').findOne({
      _id: new ObjectId(sourceId)
    });

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    if (source.type === 'local') {
      try {
        const stats = await fs.stat(source.config.path);
        if (!stats.isDirectory()) {
          return res.status(400).json({ error: 'Path exists but is not a directory' });
        }
        res.json({ 
          success: true, 
          details: `Directory exists and is accessible: ${source.config.path}` 
        });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(400).json({ error: 'Directory does not exist' });
        }
        if (error.code === 'EACCES') {
          return res.status(400).json({ error: 'Permission denied accessing directory' });
        }
        throw error;
      }
    } else if (source.type === 'sftp') {
      const sftp = new SftpService();
      try {
        await sftp.connect({
          host: source.config.host,
          port: source.config.port || 22,
          username: source.config.user,
          password: source.config.pass
        });
        
        // Try to list files in the configured path
        await sftp.listFiles(source.config.path);
        
        await sftp.disconnect();
        res.json({ 
          success: true, 
          details: `Successfully connected to SFTP and verified path: ${source.config.path}` 
        });
      } catch (error) {
        await sftp.disconnect().catch(() => {});
        if (error.message.includes('connect')) {
          return res.status(400).json({ error: 'Failed to connect to SFTP server' });
        }
        if (error.message.includes('Permission denied')) {
          return res.status(400).json({ error: 'Permission denied accessing SFTP path' });
        }
        if (error.message.includes('No such file')) {
          return res.status(400).json({ error: 'SFTP path does not exist' });
        }
        throw error;
      }
    } else {
      return res.status(400).json({ error: 'Unknown source type' });
    }
  } catch (error) {
    logger.error('Test source error:', error);
    next(error);
  }
});

// List all sources
router.get('/sources', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const sources = await db.collection('sources').find().sort({ createdAt: -1 }).toArray();
    res.json(sources);
  } catch (error) {
    logger.error('List sources error:', error);
    next(error);
  }
});

// Get indexing stats for a specific source
router.get('/index/status', async (req, res, next) => {
  try {
    const { sourceId } = req.query;
    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId query parameter is required' });
    }
    // Validate sourceId format
    if (!ObjectId.isValid(sourceId)) {
       return res.status(400).json({ error: 'Invalid sourceId format' });
    }

    const indexer = req.app.locals.indexer;
    const stats = await indexer.getStatus(sourceId);
    res.json(stats);
  } catch (error) {
    logger.error('Indexing status error:', error);
    next(error);
  }
});

// Get indexing history for a specific source
router.get('/index/history', async (req, res, next) => {
  try {
    const { sourceId } = req.query;
     if (!sourceId) {
      return res.status(400).json({ error: 'sourceId query parameter is required' });
    }
    if (!ObjectId.isValid(sourceId)) {
       return res.status(400).json({ error: 'Invalid sourceId format' });
    }

    const indexer = req.app.locals.indexer;

    const history = await indexer.getHistory(sourceId);
    res.json(history);
  } catch (error) {
    logger.error('Indexing history error:', error);
    next(error);
  }
});

// Manually trigger thumbnail generation
router.post('/thumbnails/generate', async (req, res, next) => {
  try {
    const { sourceId, year } = req.body; // Optional sourceId and year
    const thumbnailGenerator = req.app.locals.thumbnailGenerator;
    const db = req.app.locals.db;

    // Build base query
    const query = {
      has_thumb: false,
      thumb_attempts: { $lt: thumbnailGenerator.maxAttempts || 3 } // Use configured maxAttempts
    };

    // Add sourceId filter if provided
    if (sourceId) {
      if (!ObjectId.isValid(sourceId)) {
        return res.status(400).json({ error: 'Invalid sourceId format' });
      }
      query.sourceId = new ObjectId(sourceId);
      logger.info(`Adding sourceId filter: ${sourceId}`);
    }

    // Add year filter if provided
    if (year) {
      const numericYear = parseInt(year, 10);
      if (isNaN(numericYear)) {
        return res.status(400).json({ error: 'Invalid year format' });
      }
      const startDate = new Date(numericYear, 0, 1);
      const endDate = new Date(numericYear, 11, 31, 23, 59, 59, 999);
      query.timestamp = { $gte: startDate, $lte: endDate };
      logger.info(`Adding year filter: ${year}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }

    // Update matching documents to pending
    const pendingDesc = [];
    if (sourceId) pendingDesc.push(`sourceId: ${sourceId}`);
    if (year) pendingDesc.push(`year: ${year}`);
    logger.info(`Marking thumbnails as pending${pendingDesc.length ? ' for ' + pendingDesc.join(', ') : ' (all)'}`);

    const updateResult = await db.collection('media').updateMany(
      query,
      { $set: { thumb_pending: true } }
    );

    logger.info(`Marked ${updateResult.modifiedCount} thumbnails as pending.`);

    // Prepare filters for generation
    const filters = {};
    if (sourceId) filters.sourceId = sourceId;
    if (year) filters.year = year;

    // Trigger immediate generation (runs async) with filters
    const filterDesc = Object.entries(filters).map(([k, v]) => `${k}: ${v}`).join(', ');
    logger.info(`Triggering immediate thumbnail generation cycle${filterDesc ? ' with filters: ' + filterDesc : ''}`);
    thumbnailGenerator.generatePendingThumbnails(filters);

    res.status(202).json({ 
      message: 'Thumbnail generation triggered',
      filters: Object.keys(filters).length > 0 ? filters : undefined
    });
  } catch (error) {
    logger.error('Thumbnail generation trigger error:', error);
    next(error);
  }
});

// Get thumbnail generation status
router.get('/thumbnails/status', async (req, res, next) => {
  try {
    const thumbnailGenerator = req.app.locals.thumbnailGenerator;
    const status = await thumbnailGenerator.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Thumbnail status error:', error);
    next(error);
  }
});

// Get thumbnail generation history
router.get('/thumbnails/history', async (req, res, next) => {
  try {
    const thumbnailGenerator = req.app.locals.thumbnailGenerator;
    // Basic validation for query params if needed
    const history = await thumbnailGenerator.getHistory(req.query);
    res.json(history);
  } catch (error) {
    logger.error('Thumbnail history error:', error);
    next(error);
  }
});

// Manually trigger deduplication cleanup
router.post('/deduplication/start', async (req, res, next) => {
  try {
    const deduplicationService = req.app.locals.deduplicationService;
    if (!deduplicationService) {
      return res.status(503).json({ error: 'Deduplication service not available' });
    }

    // Run cleanup asynchronously, don't wait for it to finish
    deduplicationService.runCleanup();

    // Respond immediately
    res.status(202).json({ message: 'Deduplication cleanup process started.' });

  } catch (error) {
    logger.error('Deduplication start trigger error:', error);
    next(error);
  }
});

// Get deduplication status
router.get('/deduplication/status', async (req, res, next) => {
  try {
    const deduplicationService = req.app.locals.deduplicationService;
    if (!deduplicationService) {
      return res.status(503).json({ error: 'Deduplication service not available' });
    }
    const status = deduplicationService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Deduplication status error:', error);
    next(error);
  }
});

module.exports = router;