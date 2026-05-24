const { put } = require('@vercel/blob');

function safeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function uploadFile(file, folder) {
  if (!file) return '';

  if (file.filename) {
    return `/uploads/${file.filename}`;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for file uploads on Vercel.');
  }

  const pathname = `${folder}/${Date.now()}-${safeFilename(file.originalname)}`;
  const blob = await put(pathname, file.buffer, {
    access: 'public',
    contentType: file.mimetype,
    addRandomSuffix: true
  });

  return blob.url;
}

module.exports = {
  uploadFile
};
