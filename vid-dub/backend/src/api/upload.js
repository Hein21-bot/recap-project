import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { saveState } from '../utils/state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'];
    const ext = path.extname(file.originalname).toLowerCase();
    const isVideoMime = file.mimetype.startsWith('video/');
    const isVideoExt = VIDEO_EXTS.includes(ext);
    if (isVideoMime || (file.mimetype === 'application/octet-stream' && isVideoExt)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files allowed'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }
});

router.post('/', (req, res) => {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    saveState({
      step: 0,
      videoFilename: req.file.filename,
      videoPath: req.file.path,
      originalName: req.file.originalname
    });

    res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  });
});

export default router;
