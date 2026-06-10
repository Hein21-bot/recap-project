import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import { readState, saveState, outputPath } from '../utils/state.js';

const router = express.Router();

// POST /api/translate — translate all segments
router.post('/', async (req, res) => {
  try {
    const state = readState();
    if (!state.transcript?.length) return res.status(400).json({ error: 'Transcript မရှိပါ' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const chineseTexts = state.transcript.map((s, i) => `[${i}] ${s.text}`).join('\n');

    const prompt = `Translate these Chinese subtitle segments to Myanmar (Burmese).
Keep translations natural and concise — they will be displayed as subtitles.
Return ONLY a JSON array of translated strings in the same order (no explanation):
["Myanmar translation 0", "Myanmar translation 1", ...]

Chinese segments:
${chineseTexts}`;

    console.log('[Translate] Calling Gemini...');
    const result = await model.generateContent(prompt);

    const candidates = result.response?.candidates;
    if (!candidates?.length || !candidates[0].content?.parts?.length) {
      throw new Error(`Gemini returned no content`);
    }

    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Gemini မှ valid JSON မရပါ');

    const translations = JSON.parse(jsonMatch[0]);

    const segments = state.transcript.map((seg, i) => ({
      ...seg,
      translatedText: translations[i] || seg.text,
    }));

    fs.writeFileSync(outputPath('translated.json'), JSON.stringify(segments, null, 2));
    saveState({ step: 3, segments });

    res.json({ success: true, segments });
  } catch (err) {
    console.error('[Translate] ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/translate/edit — save user-edited translations
router.put('/edit', (req, res) => {
  try {
    const { segments } = req.body;
    if (!segments?.length) return res.status(400).json({ error: 'Segments မရှိပါ' });

    fs.writeFileSync(outputPath('translated.json'), JSON.stringify(segments, null, 2));
    saveState({ segments });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
