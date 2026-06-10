import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3100;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/output', express.static(path.join(__dirname, 'output')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'vid-dub-backend' });
});

import resetRoute from './src/api/reset.js';
import uploadRoute from './src/api/upload.js';
import transcribeRoute from './src/api/transcribe.js';
import translateRoute from './src/api/translate.js';
import ttsRoute from './src/api/tts.js';
import syncRoute from './src/api/sync.js';
import subtitleRoute from './src/api/subtitle.js';
import exportRoute from './src/api/export.js';

app.use('/api/reset', resetRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/transcribe', transcribeRoute);
app.use('/api/translate', translateRoute);
app.use('/api/tts', ttsRoute);
app.use('/api/sync', syncRoute);
app.use('/api/subtitle', subtitleRoute);
app.use('/api/export', exportRoute);

app.listen(PORT, () => {
  console.log(`vid-dub backend running on http://localhost:${PORT}`);
});
