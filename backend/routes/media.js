const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

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
    console.debug(`[DEBUG] Received request for thumbnail hash: ${hash}`); // Added console.debug

    // Get media info from database
    const db = req.app.locals.db;
    console.debug(`[DEBUG] Searching for media with hash: ${hash} for thumbnail`); // Added console.debug
    const media = await db.collection('media').findOne({ hash });

    if (!media) {
      console.debug(`[DEBUG] Thumbnail: Media not found for hash: ${hash}`); // Added console.debug
      return res.status(404).json({ error: 'Thumbnail not found' });
    }

    console.debug('[DEBUG] Thumbnail: Found media record:', { // Added console.debug
      _id: media._id,
      path: media.path,
      type: media.type,
      thumb_path: media.thumb_path,
      has_thumb: media.has_thumb,
      thumb_pending: media.thumb_pending
    });

    // If we have a thumbnail path and it exists, serve it
    if (media.thumb_path) {
      const thumbPath = path.resolve(media.thumb_path);
      console.debug(`[DEBUG] Thumbnail: Checking existence of thumb_path: ${thumbPath}`); // Added console.debug
      try {
        await fs.access(thumbPath); // Check if file exists and is accessible
        console.debug(`[DEBUG] Thumbnail: Serving generated thumbnail from: ${thumbPath}`); // Added console.debug
        return res.sendFile(thumbPath, (err) => {
          if (err) {
            console.error(`[ERROR] Thumbnail: Error sending generated thumbnail file ${thumbPath}:`, err); // Changed to console.error
            if (!res.headersSent) {
              next(err);
            }
          } else {
             console.debug(`[DEBUG] Thumbnail: Successfully sent generated thumbnail: ${thumbPath}`); // Added console.debug
          }
        });
      } catch (fsError) {
         console.error(`[ERROR] Thumbnail: thumb_path exists in DB but file not accessible at ${thumbPath}`, fsError); // Changed to console.error
         // Fall through to potentially serve original or 404 later
      }
    } else {
       console.debug(`[DEBUG] Thumbnail: media.thumb_path is missing or empty.`); // Added console.debug
    }

    // Fallback: If no valid thumbnail, maybe return a specific status or placeholder?
    // For now, let's explicitly return 404 if no thumb exists and generation isn't pending/failed
    // Or maybe we *do* want to serve the original for images as a fallback? Let's stick to 404 for now if no thumb.
    console.debug(`[DEBUG] Thumbnail: No valid thumbnail file found for hash: ${hash}. Returning 404.`); // Added console.debug
    return res.status(404).json({ error: 'Thumbnail not available' });

    /* // Original Fallback Logic (Commented out - maybe revisit later)
    // Otherwise serve the original file (potentially problematic for large videos)
    const absolutePath = path.resolve(media.path);
    console.debug('[DEBUG] Thumbnail: Serving original file as fallback thumbnail from:', absolutePath); // Added console.debug

    res.sendFile(absolutePath, (err) => {
      if (err) {
        console.error('[ERROR] Thumbnail: Error sending file as fallback thumbnail:', err); // Changed to console.error
        if (!res.headersSent) {
          next(err);
        }
      } else {
         console.debug(`[DEBUG] Thumbnail: Successfully sent original file as fallback: ${absolutePath}`); // Added console.debug
      }
    });
    */
  } catch (error) {
    console.error('[ERROR] Thumbnail: General error in /thumb/:hash route:', error); // Changed to console.error
    if (!res.headersSent) {
      next(error);
    }
  }
});

// Get original media file by hash
router.get('/:hash', async (req, res, next) => {
  try {
    const { hash } = req.params;
    console.debug(`[DEBUG] Received request for media hash: ${hash}`); // Added console.debug

    const db = req.app.locals.db;
    console.debug(`[DEBUG] Searching for media with hash: ${hash} in DB`); // Added console.debug
    const media = await db.collection('media').findOne({ hash });

    if (!media) {
      console.debug(`[DEBUG] Media not found for hash: ${hash}`); // Added console.debug
      return res.status(404).json({ error: 'Media not found' });
    }

    console.debug(`[DEBUG] Found media record:`, { // Added console.debug
      _id: media._id,
      path: media.path,
      type: media.type,
      sourceId: media.sourceId
    });

    // TODO: Handle SFTP sources - this currently assumes local path
    // For now, we assume the path is directly accessible from the server's filesystem.
    // This might need adjustment if the path is relative or from an SFTP source.
    const absolutePath = path.resolve(media.path);
    console.debug(`[DEBUG] Resolved absolute path for media: ${absolutePath}`); // Added console.debug

    // Check if file exists before attempting to send
    try {
      await require('fs').promises.access(absolutePath);
      console.debug(`[DEBUG] File exists at path: ${absolutePath}. Attempting to send.`); // Added console.debug
    } catch (fsError) {
      console.error(`[ERROR] File not accessible at path: ${absolutePath}`, fsError); // Changed to console.error
      return res.status(404).json({ error: 'Media file not found or inaccessible on server' });
    }

    res.sendFile(absolutePath, (err) => {
      if (err) {
        console.error(`[ERROR] Error sending file ${absolutePath}:`, err); // Changed to console.error
        // Avoid sending headers twice if error occurs after sending starts
        if (!res.headersSent) {
          // Pass the error to the Express error handler
          next(err);
        }
      } else {
        console.debug(`[DEBUG] Successfully sent file: ${absolutePath}`); // Added console.debug
      }
    });
  } catch (error) {
    console.error('[ERROR] Error fetching media file:', error); // Changed to console.error
    // Ensure error is passed to the Express error handler if headers not sent
    if (!res.headersSent) {
      next(error);
    }
  }
});

module.exports = router;