const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

// --- New Route: Get Years with Counts ---
router.get('/years', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    logger.debug('Fetching years with media counts.');

    const pipeline = [
      {
        // Project the year from the timestamp
        $project: {
          year: { $year: "$timestamp" }
        }
      },
      {
        // Group by year and count occurrences
        $group: {
          _id: "$year", // Group key is the year
          count: { $sum: 1 } // Count documents in each group
        }
      },
      {
        // Reshape the output
        $project: {
          _id: 0, // Exclude the default _id field
          year: "$_id", // Rename _id to year
          count: 1 // Include the count
        }
      },
      {
        // Sort by year descending
        $sort: { year: -1 }
      }
    ];

    const yearsWithCounts = await db.collection('media').aggregate(pipeline).toArray();
    logger.debug('Years with counts result:', yearsWithCounts);
    res.json(yearsWithCounts);

  } catch (error) {
    logger.error('Error fetching years with counts:', error);
    next(error);
  }
});
// --- End of New Route ---


// Get indexed media with pagination and filters
router.get('/', async (req, res, next) => {
  try {
    const { offset = 0, limit = 50, year, month, requireThumbnail } = req.query;
    const db = req.app.locals.db;

    logger.debug('Media list request params:', {
      offset,
      limit,
      year,
      month,
      requireThumbnail
    });

    const query = {};
    
    // Skip items without thumbnails if requireThumbnail is true
    if (requireThumbnail) {
      query.has_thumb = true;
      logger.debug('Filtering for items with thumbnails only');
    }
    if (year) {
      // Ensure year is treated as a number for date matching
      const numericYear = parseInt(year, 10);
      if (!isNaN(numericYear)) {
        const startDate = new Date(numericYear, month ? month - 1 : 0, 1);
        // If month is specified, end date is the last day of that month.
        // If only year is specified, end date is the last day of that year.
        const endDate = month
          ? new Date(numericYear, month, 0) // Last day of the specified month
          : new Date(numericYear, 11, 31, 23, 59, 59, 999); // End of the year

        query.timestamp = { $gte: startDate, $lte: endDate };
        logger.debug('Date filter applied:', {
          year: numericYear,
          month: month,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      } else {
         logger.warn(`Invalid year parameter received: ${year}`);
      }
    }

    logger.debug('MongoDB query:', query);

    // Get total count for pagination info (consider if this is needed/performant)
    // const totalCount = await db.collection('media').countDocuments(query);
    // logger.debug('Total matching documents:', totalCount);

    const media = await db.collection('media')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100)) // Keep max limit reasonable
      .toArray();

    logger.debug('Query results:', {
      requestedLimit: limit,
      actualResults: media.length,
      firstItemTimestamp: media[0]?.timestamp,
      lastItemTimestamp: media[media.length - 1]?.timestamp
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
    logger.debug(`Request for thumbnail hash: ${hash}`); // Use logger

    // Get media info from database
    const db = req.app.locals.db;
    logger.debug(`Searching for media with hash: ${hash} for thumbnail`);
    const media = await db.collection('media').findOne({ hash });

    if (!media) {
      logger.debug(`Thumbnail: Media not found for hash: ${hash}`);
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    logger.debug('Thumbnail: Found media record:', {
      _id: media._id,
      path: media.path,
      type: media.type,
      thumb_path: media.thumb_path,
      has_thumb: media.has_thumb,
      thumb_pending: media.thumb_pending
    });

    // If we have a thumbnail path and it exists, serve it
    if (media.thumb_path && media.has_thumb) { // Check has_thumb as well
      const thumbPath = path.resolve(media.thumb_path);
      logger.debug(`Thumbnail: Checking existence of thumb_path: ${thumbPath}`);
      try {
        await fs.access(thumbPath); // Check if file exists and is accessible
        logger.debug(`Thumbnail: Serving generated thumbnail from: ${thumbPath}`);
        return res.sendFile(thumbPath, (err) => {
          if (err) {
            logger.error(`Thumbnail: Error sending generated thumbnail file ${thumbPath}:`, err);
            if (!res.headersSent) {
              next(err);
            }
          } else {
             logger.debug(`Thumbnail: Successfully sent generated thumbnail: ${thumbPath}`);
          }
        });
      } catch (fsError) {
         logger.error(`Thumbnail: thumb_path exists in DB but file not accessible at ${thumbPath}`, fsError);
         // Fall through to 404
      }
    } else {
       logger.debug(`Thumbnail: media.thumb_path is missing, empty, or has_thumb is false.`);
    }

    // Fallback: Return 404 if no valid thumbnail file found/ready
    logger.debug(`Thumbnail: No valid thumbnail file found for hash: ${hash}. Returning 404.`);
    return res.status(404).json({ error: 'Thumbnail not available' });

  } catch (error) {
    logger.error('Thumbnail: General error in /thumb/:hash route:', error);
    if (!res.headersSent) {
      next(error);
    }
  }
});

// Get original media file by hash
router.get('/:hash', async (req, res, next) => {
  try {
    const { hash } = req.params;
    logger.debug(`Request for media hash: ${hash}`);

    const db = req.app.locals.db;
    logger.debug(`Searching for media with hash: ${hash} in DB`);
    const media = await db.collection('media').findOne({ hash });

    if (!media) {
      logger.debug(`Media not found for hash: ${hash}`);
      return res.status(404).json({ error: 'Media not found' });
    }

    logger.debug(`Found media record:`, {
      _id: media._id,
      path: media.path,
      type: media.type,
      sourceId: media.sourceId
    });

    // TODO: Handle SFTP sources - this currently assumes local path
    // This needs a major refactor to handle SFTP streaming if required.
    // For now, it only works for 'local' sources where the path is accessible.
    if (media.sourceType === 'sftp') { // Assuming sourceType is stored, otherwise need to join/lookup
        logger.error(`Serving original SFTP files not implemented yet for hash ${hash}`);
        return res.status(501).json({ error: 'Serving original SFTP files not implemented' });
    }

    const absolutePath = path.resolve(media.path);
    logger.debug(`Resolved absolute path for media: ${absolutePath}`);

    // Check if file exists before attempting to send
    try {
      await fs.access(absolutePath);
      logger.debug(`File exists at path: ${absolutePath}. Attempting to send.`);
    } catch (fsError) {
      logger.error(`File not accessible at path: ${absolutePath}`, fsError);
      return res.status(404).json({ error: 'Media file not found or inaccessible on server' });
    }

    res.sendFile(absolutePath, (err) => {
      if (err) {
        logger.error(`Error sending file ${absolutePath}:`, err);
        if (!res.headersSent) {
          next(err);
        }
      } else {
        logger.debug(`Successfully sent file: ${absolutePath}`);
      }
    });
  } catch (error) {
    logger.error('Error fetching media file:', error);
    if (!res.headersSent) {
      next(error);
    }
  }
});

module.exports = router;