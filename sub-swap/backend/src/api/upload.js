import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { saveState, resetState, outputPath } from '../utils/state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
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
      cb(new Error('Video file သာ upload လုပ်ပါ'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }
});

router.post('/', (req, res) => {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'File မရှိပါ' });

    // Clear previous pipeline state on new upload
    resetState();

    // Clear old output files
    const outDir = path.join(__dirname, '../../output');
    if (fs.existsSync(outDir)) {
      for (const f of fs.readdirSync(outDir)) {
        if (f !== 'state.json') {
          const fp = path.join(outDir, f);
          fs.rmSync(fp, { recursive: true, force: true });
        }
      }
    }

    saveState({
      step: 0,
      videoPath: req.file.path,
      videoFilename: req.file.filename,
      originalName: req.file.originalname,
    });

    res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  });
});

export default router;
