const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const path = require('path');

// Get indexed media with pagination and filters
router.get('/', async (req, res, next) => {
  try {
    const { offset = 0, limit = 50, year, month } = req.query;
    const db = req.app.locals.db;
    
    logger.debug('Media list request params:', {
      offset,
      limit,
      year,
      month
    });

    const query = {};
    if (year) {
      const startDate = new Date(year, month ? month - 1 : 0, 1);
      const endDate = new Date(year, month ? month : 12, 0);
      query.timestamp = { $gte: startDate, $lte: endDate };
      logger.debug('Date filter applied:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
    }

    logger.debug('MongoDB query:', query);

    // Get total count for pagination info
    const totalCount = await db.collection('media').countDocuments(query);
    logger.debug('Total matching documents:', totalCount);

    const media = await db.collection('media')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100))
      .toArray();

    logger.debug('Query results:', {
      requestedLimit: limit,
      actualResults: media.length,
      firstItem: media[0] ? {
        path: media[0].path,
        type: media[0].type,
        timestamp: media[0].timestamp
      } : null,
      lastItem: media[media.length - 1] ? {
        path: media[media.length - 1].path,
        type: media[media.length - 1].type,
        timestamp: media[media.length - 1].timestamp
      } : null
    });

    res.json(media);
  } catch (error) {
    logger.error('Media list error:', error);
    next(error);
  }
});

// Get thumbnail by hash
router.get('/thumb/:hash', async (req, res, next) => {
  try {
    const { hash } = req.params;
    logger.debug('Thumbnail request:', { hash });

    // Get media info from database
    const db = req.app.locals.db;
    const media = await db.collection('media').findOne({ hash });

    if (!media) {
      logger.debug('Thumbnail not found:', { hash });
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    logger.debug('Found media:', {
      path: media.path,
      type: media.type,
      thumb_path: media.thumb_path
    });

    // If we have a thumbnail, serve it
    if (media.thumb_path) {
      const thumbPath = path.resolve(media.thumb_path);
      logger.debug('Serving thumbnail from:', thumbPath);
      return res.sendFile(thumbPath, (err) => {
        if (err) {
          logger.error('Error sending thumbnail:', err);
          next(err);
        }
      });
    }

    // Otherwise serve the original file
    const absolutePath = path.resolve(media.path);
    logger.debug('Serving original file from:', absolutePath);

    res.sendFile(absolutePath, (err) => {
      if (err) {
        logger.error('Error sending file:', err);
        next(err);
      }
    });
  } catch (error) {
    logger.error('Thumbnail error:', error);
    next(error);
  }
});

module.exports = router;