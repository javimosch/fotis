const crypto = require('crypto');
const path = require('path');

// Generate a hash for a file path that will be used as the thumbnail identifier
function generateFileHash(filePath) {
  return crypto
    .createHash('md5')
    .update(filePath)
    .digest('hex');
}

// Check if a file is a supported image
function isImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
}

// Check if a file is a supported video
function isVideo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.mp4', '.mov', '.avi', '.mkv'].includes(ext);
}

module.exports = {
  generateFileHash,
  isImage,
  isVideo
};