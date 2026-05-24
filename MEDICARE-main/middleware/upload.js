const multer = require('multer');
const path = require('path');

function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

const diskStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename(req, file, cb) {
    const safeName = safeFilename(file.originalname);
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const storage = process.env.VERCEL ? multer.memoryStorage() : diskStorage;
const upload = multer({ storage });

module.exports = upload;
