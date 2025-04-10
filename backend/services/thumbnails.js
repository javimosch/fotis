const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../utils/logger');

class ThumbnailService {
  constructor() {
    this.cacheDir = process.env.CACHE_DIR || './cache';
    this.width = parseInt(process.env.THUMB_WIDTH, 10) || 300;
    this.height = parseInt(process.env.THUMB_HEIGHT, 10) || 300;
    this.jpegQuality = parseInt(process.env.THUMB_QUALITY, 10) || 80;
  }

  async generateImageThumbnail(inputPath, hash) {
    const outputPath = path.join(this.cacheDir, `${hash}.jpg`);
    logger.debug(`Generating image thumbnail for ${inputPath} -> ${outputPath}`);
    await sharp(inputPath)
      .resize(this.width, this.height, {
        fit: 'cover',
        position: 'attention'
      })
      .jpeg({ quality: this.jpegQuality })
      .toFile(outputPath);
    logger.debug(`Image thumbnail generated successfully: ${outputPath}`);
    return outputPath;
  }

  async generateVideoThumbnail(inputPath, hash) {
    const outputPath = path.join(this.cacheDir, `${hash}.jpg`);
    const tempOutputPath = path.join(this.cacheDir, `${hash}_temp.png`);
    logger.debug(`Generating video thumbnail for ${inputPath} -> ${outputPath}`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .on('end', async () => {
          logger.debug(`FFmpeg extracted frame successfully to ${tempOutputPath}`);
          try {
            await sharp(tempOutputPath)
              .resize(this.width, this.height, {
                fit: 'cover',
                position: 'centre'
              })
              .jpeg({ quality: this.jpegQuality })
              .toFile(outputPath);

            logger.debug(`Video thumbnail processed and saved as JPEG: ${outputPath}`);
            await fs.unlink(tempOutputPath);
            logger.debug(`Removed temporary PNG file: ${tempOutputPath}`);
            resolve(outputPath);
          } catch (sharpError) {
            logger.error('Error processing video frame with Sharp:', sharpError);
            try { await fs.unlink(tempOutputPath); } catch (unlinkErr) { /* ignore */ }
            reject(new Error(`Failed to process video frame with Sharp: ${sharpError.message}`));
          }
        })
        .on('error', (err) => {
          logger.error(`FFmpeg error processing ${inputPath}:`, err);
          try { fs.unlink(tempOutputPath).catch(() => {}); } catch (unlinkErr) { /* ignore */ }
          reject(new Error(`FFmpeg failed: ${err.message}`));
        })
        .screenshots({
          timestamps: ['00:00:00.001'],
          filename: `${hash}_temp.png`,
          folder: this.cacheDir,
          size: `${this.width}x?`
        });
    });
  }

  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.debug(`Cache directory ensured: ${this.cacheDir}`);
    } catch (error) {
      logger.error('Failed to create cache directory:', { path: this.cacheDir, error });
      throw error;
    }
  }
}

module.exports = ThumbnailService;