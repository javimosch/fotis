const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

class ThumbnailService {
  constructor() {
    this.cacheDir = process.env.CACHE_DIR;
    this.width = parseInt(process.env.THUMB_WIDTH, 10);
    this.height = parseInt(process.env.THUMB_HEIGHT, 10);
  }

  async generateImageThumbnail(inputPath, hash) {
    const outputPath = path.join(this.cacheDir, `${hash}.jpg`);
    
    await sharp(inputPath)
      .resize(this.width, this.height, {
        fit: 'cover',
        position: 'attention'
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);

    return outputPath;
  }

  async generateVideoThumbnail(inputPath, hash) {
    // TODO: Implement video thumbnail generation using ffmpeg
    throw new Error('Video thumbnail generation not implemented yet');
  }

  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
      throw error;
    }
  }
}

module.exports = ThumbnailService;