const path = require('path');
const fs = require('fs');

// Render sets process.env.RENDER = 'true'.
// Railway sets process.env.RAILWAY_VOLUME_MOUNT_PATH or process.env.PORT.
const IS_PROD = process.env.RENDER === 'true' || !!process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.NODE_ENV === 'production';

// We default our mount path to '/data' for cloud (both Render/Railway support mounting here), and local folder for development.
const DATA_DIR = IS_PROD ? '/data' : __dirname;

if (IS_PROD && !fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error(`Failed to create directory ${DATA_DIR}:`, err.message);
  }
}

const downloadsDir = path.join(DATA_DIR, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  try {
    fs.mkdirSync(downloadsDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create downloads directory:`, err.message);
  }
}

module.exports = {
  db: path.join(DATA_DIR, 'db.json'),
  caption: path.join(DATA_DIR, 'caption.txt'),
  presetCover: path.join(DATA_DIR, 'preset_cover.txt'),
  downloads: downloadsDir,
  resolveMedia(localPath) {
    if (!localPath) return '';
    return path.resolve(DATA_DIR, localPath);
  }
};
