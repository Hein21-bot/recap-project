import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(__dirname, '../../../output/pipeline-state.json');
const OUTPUT_DIR = path.join(__dirname, '../../../output');

export function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveState(updates) {
  ensureOutputDir();
  const current = readState();
  const next = { ...current, ...updates, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function outputPath(filename) {
  ensureOutputDir();
  return path.join(OUTPUT_DIR, filename);
}
