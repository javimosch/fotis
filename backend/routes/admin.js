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
    await indexer.startIndexing(sourceId);
    
    res.json({ message: 'Indexing started' });
  } catch (error) {
    logger.error('Indexing error:', error);
    next(error);
  }
});

// Add new source
router.post('/sources', async (req, res, next) => {
  try {
    const { type, config } = req.body;
    const db = req.app.locals.db;
    
    const result = await db.collection('sources').insertOne({
      type,
      config,
      createdAt: new Date()
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// List all sources
router.get('/sources', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const sources = await db.collection('sources').find().toArray();
    res.json(sources);
  } catch (error) {
    next(error);
  }
});

// Get indexing stats
router.get('/stats', async (req, res, next) => {
  try {
    const { sourceId } = req.query;
    const indexer = req.app.locals.indexer;
    
    const stats = await indexer.getStatus(sourceId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get indexing history
router.get('/index/history', async (req, res, next) => {
  try {
    const { sourceId } = req.query;
    const indexer = req.app.locals.indexer;
    
    const history = await indexer.getHistory(sourceId);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Manually trigger thumbnail generation
router.post('/thumbnails/generate', async (req, res, next) => {
  try {
    const { sourceId } = req.body;
    const thumbnailGenerator = req.app.locals.thumbnailGenerator;

    if (sourceId) {
      // Update specific source to pending
      await req.app.locals.db.collection('media').updateMany(
        { 
          sourceId: new ObjectId(sourceId),
          has_thumb: false,
          thumb_attempts: { $lt: 3 }
        },
        { 
          $set: { thumb_pending: true }
        }
      );
    }

    // Trigger immediate generation
    thumbnailGenerator.generatePendingThumbnails();

    res.json({ message: 'Thumbnail generation triggered' });
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
    const history = await thumbnailGenerator.getHistory(req.query);
    res.json(history);
  } catch (error) {
    logger.error('Thumbnail history error:', error);
    next(error);
  }
});

module.exports = router;