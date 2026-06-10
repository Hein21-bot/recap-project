import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '../../output/state.json');
const OUTPUT_DIR = path.join(__dirname, '../../output');

export function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveState(partial) {
  const current = readState();
  const updated = { ...current, ...partial, updatedAt: new Date().toISOString() };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

export function outputPath(filename) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  return path.join(OUTPUT_DIR, filename);
}

export function resetState() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}
