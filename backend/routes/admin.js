const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const logger = require('../utils/logger');

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
    const { sourceId } = req.body; // Optional sourceId
    const thumbnailGenerator = req.app.locals.thumbnailGenerator;
    const db = req.app.locals.db;

    if (sourceId) {
       if (!ObjectId.isValid(sourceId)) {
         return res.status(400).json({ error: 'Invalid sourceId format' });
       }
      // Update specific source to pending
      logger.info(`Marking thumbnails as pending for sourceId: ${sourceId}`);
      const updateResult = await db.collection('media').updateMany(
        {
          sourceId: new ObjectId(sourceId),
          has_thumb: false,
          thumb_attempts: { $lt: thumbnailGenerator.maxAttempts || 3 } // Use configured maxAttempts
        },
        {
          $set: { thumb_pending: true }
        }
      );
       logger.info(`Marked ${updateResult.modifiedCount} thumbnails as pending for source ${sourceId}.`);
    } else {
       logger.info('Marking all eligible thumbnails as pending.');
       // Mark all eligible thumbnails as pending if no sourceId provided
       const updateResult = await db.collection('media').updateMany(
        {
          has_thumb: false,
          thumb_attempts: { $lt: thumbnailGenerator.maxAttempts || 3 }
        },
        {
          $set: { thumb_pending: true }
        }
      );
       logger.info(`Marked ${updateResult.modifiedCount} total thumbnails as pending.`);
    }

    // Trigger immediate generation (runs async)
    logger.info('Triggering immediate thumbnail generation cycle.');
    thumbnailGenerator.generatePendingThumbnails();

    res.status(202).json({ message: 'Thumbnail generation triggered' });
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