const multer = require('multer');
const cloudinary = require('../config/cloudinary');

const storage = multer.memoryStorage();

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
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadBufferToCloudinary = (fileBuffer, folder = 'veerrajfoods/shops') =>
  new Promise((resolve, reject) => {
    console.log('[shops-upload] cloudinary upload start', { folder });
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          console.error('[shops-upload] cloudinary upload error', error);
          reject(error);
          return;
        }
        console.log('[shops-upload] cloudinary upload success', {
          public_id: result?.public_id,
          secure_url: Boolean(result?.secure_url),
        });
        resolve(result);
      },
    );

    stream.end(fileBuffer);
  });

const parseShopImageUpload = (req, res, next) => {
  uploadShopImage.single('image')(req, res, (error) => {
    if (!error) {
      console.log('[shops-upload] parse success', {
        hasFile: Boolean(req.file),
        mimeType: req.file?.mimetype || null,
        size: req.file?.size || 0,
      });
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      console.error('[shops-upload] multer error', { code: error.code, message: error.message });
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          success: false,
          message: 'Image file too large. Max size is 10MB.',
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Invalid file upload request.',
      });
      return;
    }

    console.error('[shops-upload] invalid file error', { message: error.message });
    res.status(400).json({
      success: false,
      message: error.message || 'Invalid image file.',
    });
  });
};

module.exports = { uploadShopImage, uploadBufferToCloudinary, parseShopImageUpload };
