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

// Convert bytes to human readable size
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
}

module.exports = {
  generateFileHash,
  isImage,
  isVideo,
  formatBytes
};