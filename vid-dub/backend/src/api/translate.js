import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import { readState, saveState, outputPath } from '../utils/state.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { targetLang = 'Myanmar (Burmese)' } = req.body;
    const state = readState();
    const segments = state.transcript;
    if (!segments) return res.status(400).json({ error: 'No transcript found. Run transcribe first.' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const chineseText = segments.map((s, i) => `[${i}] ${s.text}`).join('\n');

    const result = await model.generateContent(`Translate the following Chinese segments to ${targetLang}.
Keep the [index] prefix on each line. Preserve the meaning naturally.
Return ONLY the translated lines, nothing else.

${chineseText}`);

    const lines = result.response.text().trim().split('\n').filter(l => l.trim());
    const translated = segments.map((seg, i) => {
      const line = lines.find(l => l.startsWith(`[${i}]`));
      const text = line ? line.replace(`[${i}]`, '').trim() : seg.text;
      return { ...seg, translatedText: text };
    });

    fs.writeFileSync(outputPath('translated.json'), JSON.stringify(translated, null, 2));
    saveState({ step: 2, translated, targetLang });

    res.json({ success: true, segments: translated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Save manually edited translations from UI
router.put('/edit', (req, res) => {
  try {
    const { segments } = req.body;
    if (!segments) return res.status(400).json({ error: 'No segments provided' });

    const state = readState();
    fs.writeFileSync(outputPath('translated.json'), JSON.stringify(segments, null, 2));
    saveState({ ...state, translated: segments });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
