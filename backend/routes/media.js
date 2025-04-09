const express = require('express');
const router = express.Router();

// Get indexed media with pagination and filters
router.get('/', async (req, res, next) => {
  try {
    const { offset = 0, limit = 50, year, month } = req.query;
    const db = req.app.locals.db;
    
    const query = {};
    if (year) {
      const startDate = new Date(year, month ? month - 1 : 0, 1);
      const endDate = new Date(year, month ? month : 12, 0);
      query.timestamp = { $gte: startDate, $lte: endDate };
    }

    const media = await db.collection('media')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100))
      .toArray();

    res.json(media);
  } catch (error) {
    next(error);
  }
});

// Get thumbnail by hash
router.get('/thumb/:hash', async (req, res, next) => {
  try {
    const { hash } = req.params;
    // TODO: Implement thumbnail serving
    res.sendFile(path.join(process.env.CACHE_DIR, `${hash}.jpg`));
  } catch (error) {
    next(error);
  }
});

module.exports = router;