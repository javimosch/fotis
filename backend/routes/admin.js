const express = require('express');
const router = express.Router();

// Trigger indexing job
router.post('/index', async (req, res, next) => {
  try {
    const { sourceId } = req.body;
    const indexer = req.app.locals.indexer;
    
    await indexer.startIndexing(sourceId);
    res.json({ message: 'Indexing started' });
  } catch (error) {
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

module.exports = router;