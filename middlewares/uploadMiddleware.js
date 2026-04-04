const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '..', 'uploads', 'shops');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `shop-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    cb(new Error('Only image files are allowed'));
    return;
  }
  cb(null, true);
};

const uploadShopImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = { uploadShopImage };
