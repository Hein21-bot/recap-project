import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs';
import { readState, saveState, outputPath } from '../utils/state.js';
import { extractAudio } from '../utils/ffmpeg.js';

const router = express.Router();
const MAX_INLINE_BYTES = 10 * 1024 * 1024;

const PROMPT = `Transcribe this video's audio. The audio is in Chinese (Mandarin).
Return ONLY a JSON array with exact timestamps (no explanation, no markdown):
[
  { "start": 0.0, "end": 3.5, "text": "Chinese text here" },
  { "start": 3.5, "end": 7.2, "text": "More Chinese text" }
]
Be precise with timestamps. Include all spoken content.`;

router.post('/', async (req, res) => {
  try {
    const state = readState();
    if (!state.videoPath) return res.status(400).json({ error: 'Video မရှိပါ' });

    const audioPath = outputPath('audio.wav');
    console.log('[Transcribe] Extracting audio...');
    await extractAudio(state.videoPath, audioPath);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const audioSize = fs.statSync(audioPath).size;
    console.log(`[Transcribe] Audio: ${(audioSize / 1024 / 1024).toFixed(1)}MB`);

    let audioPart;
    if (audioSize > MAX_INLINE_BYTES) {
      console.log('[Transcribe] Using Files API for large audio...');
      const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
      const uploaded = await fileManager.uploadFile(audioPath, {
        mimeType: 'audio/wav',
        displayName: 'sub-swap-audio',
      });
      audioPart = { fileData: { mimeType: 'audio/wav', fileUri: uploaded.file.uri } };
    } else {
      const b64 = fs.readFileSync(audioPath).toString('base64');
      audioPart = { inlineData: { mimeType: 'audio/wav', data: b64 } };
    }

    console.log('[Transcribe] Calling Gemini...');
    const result = await model.generateContent([audioPart, { text: PROMPT }]);

    const candidates = result.response?.candidates;
    if (!candidates?.length || !candidates[0].content?.parts?.length) {
      const reason = candidates?.[0]?.finishReason || 'UNKNOWN';
      throw new Error(`Gemini returned no content (finishReason: ${reason})`);
    }

    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Gemini မှ valid JSON မရပါ');

    const segments = JSON.parse(jsonMatch[0]);
    console.log(`[Transcribe] Got ${segments.length} segments`);

    fs.writeFileSync(outputPath('transcript.json'), JSON.stringify(segments, null, 2));
    saveState({ step: 2, transcript: segments });

    res.json({ success: true, segments });
  } catch (err) {
    console.error('[Transcribe] ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
