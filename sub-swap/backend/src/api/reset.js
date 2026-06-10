import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resetState } from '../utils/state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

router.post('/', (req, res) => {
  try {
    resetState();

    const outDir = path.join(__dirname, '../../output');
    const uploadDir = path.join(__dirname, '../../uploads');

    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
    if (fs.existsSync(uploadDir)) {
      for (const f of fs.readdirSync(uploadDir)) {
        fs.rmSync(path.join(uploadDir, f), { force: true });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
