import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const DIRS_TO_CLEAN = [
  path.join(__dirname, '../../../output'),
  path.join(__dirname, '../../../uploads'),
];

router.post('/', (req, res) => {
  for (const dir of DIRS_TO_CLEAN) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  res.json({ success: true });
});

export default router;
