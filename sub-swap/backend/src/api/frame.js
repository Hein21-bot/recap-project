import express from 'express';
import path from 'path';
import fs from 'fs';
import { readState, saveState, outputPath } from '../utils/state.js';
import { extractFrame, getVideoInfo } from '../utils/ffmpeg.js';

const router = express.Router();

// GET /api/frame — extract a preview frame + return video dimensions
router.get('/', async (req, res) => {
  try {
    const state = readState();
    if (!state.videoPath) return res.status(400).json({ error: 'Video မရှိပါ' });

    const framePath = outputPath('preview-frame.jpg');

    const info = await getVideoInfo(state.videoPath);
    const seekTime = Math.min(5, info.duration * 0.1);
    await extractFrame(state.videoPath, framePath, seekTime);

    saveState({ videoInfo: info });

    res.json({
      success: true,
      frameUrl: '/output/preview-frame.jpg',
      width: info.width,
      height: info.height,
      duration: info.duration,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/frame/region — save the user-selected blur region
router.post('/region', (req, res) => {
  try {
    const { x, y, w, h } = req.body;
    if (x == null || y == null || w == null || h == null) {
      return res.status(400).json({ error: 'x, y, w, h လိုအပ်သည်' });
    }
    saveState({ step: 1, blurRegion: { x, y, w, h } });
    res.json({ success: true, blurRegion: { x, y, w, h } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
