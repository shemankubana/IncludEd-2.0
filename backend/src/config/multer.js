import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = 'uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/webp', 
      'image/avif', 
      'image/svg+xml'
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only PDF files and common images (JPG, PNG, WebP, AVIF, SVG) are allowed'));
    }
    cb(null, true);
  },
});
