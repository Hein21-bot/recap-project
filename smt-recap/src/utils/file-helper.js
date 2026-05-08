import fs from "fs";
import path from "path";

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

export function readFile(filePath) {
  return fs.readFileSync(filePath, "utf-8");
}

export function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

export function writeBinaryFile(filePath, buffer) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buffer);
}

export function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / (1024 * 1024)).toFixed(2) + " MB";
}

// State management for pipeline
const STATE_FILE = "./output/pipeline-state.json";

export function saveState(state) {
  writeJSON(STATE_FILE, { ...readState(), ...state, updatedAt: new Date().toISOString() });
}

export function readState() {
  return readJSON(STATE_FILE) || {};
}
