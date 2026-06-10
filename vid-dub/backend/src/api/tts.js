import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { readState, saveState, outputPath } from '../utils/state.js';

const router = express.Router();

// SSE progress tracking
let sseClients = [];
let currentProgress = null;

function sendProgress(data) {
  currentProgress = data;
  sseClients.forEach(res => res.write(`data: ${JSON.stringify(data)}\n\n`));
}

router.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (currentProgress) res.write(`data: ${JSON.stringify(currentProgress)}\n\n`);
  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const dataLen    = pcmBuffer.length;
  const header     = Buffer.alloc(44);
  const byteRate   = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  header.write('RIFF',              0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write('WAVE',              8);
  header.write('fmt ',              12);
  header.writeUInt32LE(16,          16);
  header.writeUInt16LE(1,           20);
  header.writeUInt16LE(channels,    22);
  header.writeUInt32LE(sampleRate,  24);
  header.writeUInt32LE(byteRate,    28);
  header.writeUInt16LE(blockAlign,  32);
  header.writeUInt16LE(bitDepth,    34);
  header.write('data',              36);
  header.writeUInt32LE(dataLen,     40);
  return Buffer.concat([header, pcmBuffer]);
}

router.post('/', async (_req, res) => {
  try {
    const state = readState();
    const segments = state.translated;
    if (!segments) return res.status(400).json({ error: 'No translation found. Run translate first.' });

    const speakerVoiceMap = state.speakerVoiceMap || {};
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-tts' });

    const audioDir = outputPath('audio');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    const total = segments.length;
    const audioPaths = [];
    currentProgress = null;

    res.json({ success: true, total, message: 'Generation started. Connect to /api/tts/progress for updates.' });

    // Generate audio in background after response
    setImmediate(async () => {
      try {
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const voiceName = (seg.speaker && speakerVoiceMap[seg.speaker]) || 'Kore';

          sendProgress({ current: i + 1, total, speaker: seg.speaker || 'SPEAKER_1', voice: voiceName, status: 'generating' });

          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: seg.translatedText }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
            }
          });

          const audioPart = result.response.candidates[0].content.parts.find(
            p => p.inlineData?.mimeType?.startsWith('audio/')
          );
          if (!audioPart) throw new Error(`No audio returned for segment ${i}`);

          const mimeType  = audioPart.inlineData.mimeType;
          const rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
          let audioBuffer;
          if (mimeType.includes('pcm') || !mimeType.includes('wav')) {
            const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || '24000');
            audioBuffer = pcmToWav(rawBuffer, sampleRate, 1, 16);
          } else {
            audioBuffer = rawBuffer;
          }

          const audioFile = path.join(audioDir, `seg-${i}.wav`);
          fs.writeFileSync(audioFile, audioBuffer);
          audioPaths.push(audioFile);
        }

        saveState({ step: 3, audioPaths, speakerVoiceMap });
        sendProgress({ current: total, total, status: 'done' });
        currentProgress = null;
      } catch (err) {
        console.error(err);
        sendProgress({ status: 'error', error: err.message });
        currentProgress = null;
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
