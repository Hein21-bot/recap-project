import express from 'express';
import path from 'path';
import { readState, saveState } from '../utils/state.js';

const router = express.Router();

router.get('/status', (req, res) => {
  const state = readState();
  res.json(state);
});

router.get('/download', (req, res) => {
  const state = readState();
  const videoPath = state.subtitledVideoPath || state.dubbedVideoPath;
  if (!videoPath) return res.status(404).json({ error: 'No output video found.' });

  const filename = `vid-dub-output-${Date.now()}.mp4`;
  res.download(videoPath, filename);
});

export default router;
