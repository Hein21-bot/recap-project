import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs';
import { readState, saveState, outputPath } from '../utils/state.js';
import { extractAudio } from '../utils/ffmpeg.js';

const router = express.Router();

const SPEAKER_VOICES = ['Kore', 'Charon', 'Puck', 'Sadaltager', 'Fenrir'];
const MAX_INLINE_BYTES = 10 * 1024 * 1024; // 10MB — use Files API above this

function assignVoices(segments) {
  const speakerMap = {};
  let voiceIndex = 0;
  for (const seg of segments) {
    const spk = seg.speaker || 'SPEAKER_1';
    if (!speakerMap[spk]) {
      speakerMap[spk] = SPEAKER_VOICES[voiceIndex % SPEAKER_VOICES.length];
      voiceIndex++;
    }
  }
  return speakerMap;
}

const PROMPT = `Transcribe this audio. The audio is in Chinese (Mandarin).
Identify different speakers and label them SPEAKER_1, SPEAKER_2, SPEAKER_3, etc.
If there is only one speaker, use SPEAKER_1 for all.

Return ONLY a JSON array like this (no explanation):
[
  { "start": 0.0, "end": 3.5, "text": "Chinese text", "speaker": "SPEAKER_1" },
  { "start": 3.5, "end": 7.0, "text": "Chinese text", "speaker": "SPEAKER_2" }
]`;

router.post('/', async (req, res) => {
  try {
    const state = readState();
    if (!state.videoPath) return res.status(400).json({ error: 'No video uploaded yet' });

    const audioPath = outputPath('extracted-audio.wav');
    await extractAudio(state.videoPath, audioPath);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const audioSize = fs.statSync(audioPath).size;
    console.log(`Audio size: ${(audioSize / 1024 / 1024).toFixed(1)}MB`);

    let audioPart;

    if (audioSize > MAX_INLINE_BYTES) {
      // Large file — use Gemini Files API
      console.log('Large audio detected — using Gemini Files API');
      const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
      const uploadResult = await fileManager.uploadFile(audioPath, {
        mimeType: 'audio/wav',
        displayName: 'extracted-audio'
      });
      audioPart = { fileData: { mimeType: 'audio/wav', fileUri: uploadResult.file.uri } };
    } else {
      // Small file — inline base64
      const base64Audio = fs.readFileSync(audioPath).toString('base64');
      audioPart = { inlineData: { mimeType: 'audio/wav', data: base64Audio } };
    }

    const result = await model.generateContent([audioPart, { text: PROMPT }]);

    const candidates = result.response?.candidates;
    if (!candidates?.length || !candidates[0].content?.parts?.length) {
      const reason = candidates?.[0]?.finishReason || 'UNKNOWN';
      throw new Error(`Gemini returned no content (finishReason: ${reason}). Try a shorter video or check your API quota.`);
    }

    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Invalid transcription response from Gemini');

    const segments = JSON.parse(jsonMatch[0]);
    const uniqueSpeakers = [...new Set(segments.map(s => s.speaker || 'SPEAKER_1'))];
    const speakerVoiceMap = assignVoices(segments);

    console.log(`Detected ${uniqueSpeakers.length} speaker(s):`, speakerVoiceMap);

    fs.writeFileSync(outputPath('transcript.json'), JSON.stringify(segments, null, 2));
    saveState({ step: 1, transcript: segments, uniqueSpeakers, speakerVoiceMap });

    res.json({ success: true, segments, uniqueSpeakers, speakerVoiceMap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
