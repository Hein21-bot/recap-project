import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import uploadRouter    from './src/api/upload.js';
import frameRouter     from './src/api/frame.js';
import transcribeRouter from './src/api/transcribe.js';
import translateRouter from './src/api/translate.js';
import renderRouter    from './src/api/render.js';
import resetRouter     from './src/api/reset.js';
import { readState }   from './src/utils/state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3200;

app.use(cors());
app.use(express.json());
app.use('/output', express.static(path.join(__dirname, 'output')));

app.use('/api/upload',     uploadRouter);
app.use('/api/frame',      frameRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/translate',  translateRouter);
app.use('/api/render',     renderRouter);
app.use('/api/reset',      resetRouter);

app.get('/api/status', (req, res) => {
  res.json(readState());
});

app.get('/api/export/download', (req, res) => {
  const state = readState();
  const file = state.outputPath;
  if (!file || !fs.existsSync(file)) {
    return res.status(404).json({ error: 'Output video မရှိပါ' });
  }
  res.download(path.resolve(file), 'sub-swap-output.mp4');
});

process.on('uncaughtException', err => console.error('Uncaught:', err));
process.on('unhandledRejection', err => console.error('Rejection:', err));

app.listen(PORT, () => {
  console.log(`sub-swap backend running on http://localhost:${PORT}`);
});
