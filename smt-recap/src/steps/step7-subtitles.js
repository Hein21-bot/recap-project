/**
 * Step 7: Subtitles & Visual Effects
 * Generates Myanmar subtitles (SRT/ASS) and burns them into video using Pango/HarfBuzz
 */

import ora from "ora";
import { logger } from "../utils/logger.js";
import { saveState, readJSON, writeFile, fileExists } from "../utils/file-helper.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");

const FFMPEG_FULL = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg";
if (fs.existsSync(FFMPEG_FULL)) ffmpeg.setFfmpegPath(FFMPEG_FULL);

export async function step7AddSubtitles(options = {}) {
  logger.step(7, "Adding subtitles and visual effects...");

  const state = readJSON("./output/pipeline-state.json") || {};
  const scriptData = readJSON("./output/script-formatted.json") || readJSON("./output/script.json");
  const videoPath = options.videoPath || state.step6?.syncedVideoPath || "./output/video/synced-video.mp4";
  const audioPath = options.audioPath || state.step5?.audioPath || "./output/audio/narration.wav";

  if (!scriptData) throw new Error("No script data found. Run Steps 1-4 first.");
  if (!fileExists(videoPath)) throw new Error(`Video not found: ${videoPath}. Run Step 6 first.`);

  // Generate SRT subtitle file
  const srtPath = "./output/subtitles/subtitles.srt";
  const assPath = "./output/subtitles/subtitles.ass";

  // Get actual audio duration so subtitles match what the voice is saying
  let audioDuration = null;
  if (fs.existsSync(audioPath)) {
    const { execFileSync } = require("child_process");
    const FFPROBE = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffprobe";
    try {
      const out = execFileSync(FFPROBE, [
        "-v", "quiet", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1", audioPath,
      ], { encoding: "utf8" });
      audioDuration = parseFloat(out.split("=")[1]);
    } catch (_) { }
  }
  logger.info(`Audio duration for subtitle sync: ${audioDuration?.toFixed(2)}s`);

  const srtContent = generateSRT(scriptData, audioDuration);
  const assContent = generateASS(scriptData, audioDuration);

  writeFile(srtPath, srtContent);
  writeFile(assPath, assContent);

  logger.success(`SRT subtitles → ${srtPath}`);
  logger.success(`ASS subtitles (styled) → ${assPath}`);

  // Get actual video dimensions
  const videoDims = getVideoDimensions(videoPath);
  logger.info(`Video dimensions: ${videoDims.w}x${videoDims.h}`);

  // Embed subtitles into video
  const outputPath = "./output/video/subtitled-video.mp4";

  await burnSubtitles(videoPath, srtPath, outputPath, videoDims);

  saveState({ step7: { completed: true, srtPath, assPath, subtitledVideoPath: outputPath } });
  logger.success(`Subtitled video → ${outputPath}`);

  return { outputPath, srtPath, assPath };
}

function generateSRT(scriptData, audioDuration = null) {
  // Try perfect sync first — use per-sentence durations from Step 5
  const durationsData = (() => {
    try { return readJSON("./output/sentence-durations.json"); } catch (_) { return null; }
  })();

  if (durationsData?.sentences?.length > 0) {
    logger.info("Using per-sentence durations for perfect subtitle sync");
    return generatePerfectSRT(durationsData.sentences);
  }

  // Fallback: syllable-based approximate timing
  logger.info("Falling back to syllable-based subtitle timing");
  const fullText = scriptData.formattedText || scriptData.fullScript || "";
  return generateSimpleSRT(fullText, audioDuration);
}

function generatePerfectSRT(sentences) {
  let srt = "";
  let index = 1;
  let currentTime = 0;

  for (const { text, duration } of sentences) {
    if (!text.trim() || duration <= 0) {
      currentTime += duration;
      continue;
    }

    // Split long sentences into display chunks (~28 chars) but keep timing proportional
    const chunks = splitSentenceIntoChunks(text, 28);
    const chunkDuration = duration / chunks.length;

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const start = currentTime;
      const end   = currentTime + chunkDuration;
      srt += `${index}\n`;
      srt += `${formatSRTTime(start)} --> ${formatSRTTime(end)}\n`;
      srt += `${chunk.trim()}\n\n`;
      index++;
      currentTime = end;
    }
  }

  return srt;
}

function splitSentenceIntoChunks(text, maxLen) {
  const words = text.split(" ").filter(Boolean);
  const chunks = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
    } else if ((current + " " + word).length <= maxLen) {
      current += " " + word;
    } else {
      chunks.push(current);
      current = word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function generateSimpleSRT(text, audioDuration = null) {
  // Strip ALL pause markers: [pause], [pause2], [pause3....] etc.
  const cleanText = text.replace(/\[pause[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanText.split(' ').filter((w) => w.trim());
  const chunks = [];
  let current = '';
  for (const word of words) {
    if (current === '') {
      current = word;
    } else if ((current + ' ' + word).length <= 28) {
      current += ' ' + word;
    } else {
      chunks.push(current);
      current = word;
    }
  }
  if (current) chunks.push(current);

  // Myanmar syllable-aware timing: count base consonant clusters, not raw chars.
  // Combining marks (်, ြ, ွ, ာ etc.) stack onto a base letter but add no speaking time.
  const syllableCounts = chunks.map(myanmarSyllableCount);
  const totalSyllables = syllableCounts.reduce((sum, n) => sum + n, 0);
  const totalDuration = (audioDuration && audioDuration > 0) ? audioDuration : totalSyllables * 0.3;

  let srt = '';
  let index = 1;
  let syllableOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.trim()) continue;
    const sc = syllableCounts[i];
    const startTime = (syllableOffset / totalSyllables) * totalDuration;
    const endTime = ((syllableOffset + sc) / totalSyllables) * totalDuration;
    srt += index + '\n';
    srt += formatSRTTime(startTime) + ' --> ' + formatSRTTime(endTime) + '\n';
    srt += chunk.trim() + '\n\n';
    index++;
    syllableOffset += sc;
  }

  return srt;
}

function generateASS(scriptData, audioDuration = null) {
  const header = `[Script Info]
Title: Myanmar Video Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans Myanmar,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,20,20,30,1
Style: Highlight,Noto Sans Myanmar,52,&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,20,20,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const fullText = scriptData.formattedText || scriptData.fullScript || "";
  const cleanText = fullText.replace(/\[pause[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  const sentences = cleanText.split(/(?<=၊)\s*/g).filter((s) => s.trim());
  let events = "";

  if (audioDuration && audioDuration > 0) {
    const totalChars = sentences.reduce((sum, s) => sum + s.trim().length, 0);
    let currentTime = 0;
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      const duration = (s.length / totalChars) * audioDuration;
      const endTime = currentTime + duration;
      events += `Dialogue: 0,${formatASSTime(currentTime)},${formatASSTime(endTime)},Default,,0,0,0,,${s}\n`;
      currentTime = endTime;
    }
  } else {
    let currentTime = 0;
    const avgSecondsPerChar = 0.1;
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      const duration = Math.max(2, s.length * avgSecondsPerChar);
      const endTime = currentTime + duration;
      events += `Dialogue: 0,${formatASSTime(currentTime)},${formatASSTime(endTime)},Default,,0,0,0,,${s}\n`;
      currentTime = endTime + 0.3;
    }
  }

  return header + events;
}

function parseSRTTimestamp(ts) {
  // HH:MM:SS,mmm
  const [time, ms] = ts.split(",");
  const [h, m, s] = time.split(":").map(Number);
  return h * 3600 + m * 60 + s + parseInt(ms) / 1000;
}

function parseSRT(content) {
  const entries = [];
  const blocks = content.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const m = lines[1].match(/(\d+:\d+:\d+,\d+)\s*-->\s*(\d+:\d+:\d+,\d+)/);
    if (!m) continue;
    entries.push({
      start: parseSRTTimestamp(m[1]),
      end: parseSRTTimestamp(m[2]),
      text: lines.slice(2).join(" ").trim(),
    });
  }
  return entries;
}

// Detect subtitle band by scanning frames for white or yellow text rows.
// Returns { topY, centerY, bottomY } or null if not found.
function detectSubtitleY(videoPath) {
  const os = require("os");
  const path = require("path");
  const { execFileSync, spawnSync } = require("child_process");

  const FFMPEG_BIN = fs.existsSync(FFMPEG_FULL) ? FFMPEG_FULL : "ffmpeg";
  const PYTHON = "/opt/homebrew/bin/python3";

  const tmpDir = path.join(os.tmpdir(), `smt-subY-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    execFileSync(FFMPEG_BIN, [
      "-i", videoPath,
      "-vf", "fps=0.5",
      path.join(tmpDir, "f_%04d.jpg"),
      "-y",
    ], { stdio: "pipe" });
  } catch (err) {
    console.error("[Step 7 detect] ffmpeg frame extraction failed:", err.message);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return null;
  }

  const script = `
import sys, os
from PIL import Image
from collections import defaultdict

frame_dir = sys.argv[1]
frames = sorted(f for f in os.listdir(frame_dir) if f.endswith('.jpg'))
row_counts = defaultdict(int)

for fname in frames:
    img = Image.open(os.path.join(frame_dir, fname)).convert('RGB')
    pixels = img.load()
    w, h = img.size
    # Only scan bottom 35% — subtitles appear near the bottom
    for y in range(int(h * 0.65), h):
        count = 0
        for x in range(w):
            r, g, b = pixels[x, y]
            is_white  = r > 200 and g > 200 and b > 200
            is_yellow = r > 180 and g > 150 and (r - b) > 80 and (g - b) > 50
            if is_white or is_yellow:
                count += 1
        if count > w * 0.04:
            row_counts[y] += count

if row_counts:
    best_y = max(row_counts, key=lambda y: row_counts[y])
    band_rows = [y for y in row_counts if abs(y - best_y) <= 40]
    print(f"{min(band_rows)},{best_y},{max(band_rows)}")
`;

  const scriptPath = path.join(tmpDir, "detect_y.py");
  fs.writeFileSync(scriptPath, script, "utf8");

  const result = spawnSync(PYTHON, [scriptPath, tmpDir], { encoding: "utf8" });
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log("[Step 7 detect] status:", result.status, "stdout:", JSON.stringify(result.stdout?.trim()));
  if (result.stderr?.trim()) console.error("[Step 7 detect] stderr:", result.stderr.trim());
  if (result.error) console.error("[Step 7 detect] spawn error:", result.error.message);

  const parts = result.stdout.trim().split(",").map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return { topY: parts[0], centerY: parts[1], bottomY: parts[2] };
  }
  return null;
}

function escapeDrawtext(text) {
  // drawtext text: escape \ then ' then :
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:");
}

function getVideoDimensions(videoPath) {
  const { execFileSync } = require("child_process");
  const FFPROBE = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffprobe";
  try {
    const out = execFileSync(FFPROBE, [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=p=0",
      videoPath,
    ], { encoding: "utf8" });
    const [w, h] = out.trim().split(",").map(Number);
    if (w && h) return { w, h };
  } catch (_) { }
  return { w: 1080, h: 1920 }; // safe fallback
}


function burnSubtitles(videoPath, srtPath, outputPath, videoDims = { w: 1080, h: 1920 }) {
  return new Promise((resolve, reject) => {
    const spinner = ora("Rendering subtitles with Pango/HarfBuzz...").start();

    const os = require("os");
    const path = require("path");
    const { execFileSync } = require("child_process");

    const FFMPEG_BIN = fs.existsSync(FFMPEG_FULL) ? FFMPEG_FULL : "ffmpeg";
    const PANGO = "/opt/homebrew/bin/pango-view";
    const CONVERT = "/opt/homebrew/bin/convert"; // ImageMagick

    const srtContent = fs.readFileSync(srtPath, "utf8");
    const entries = parseSRT(srtContent);

    if (entries.length === 0) {
      spinner.warn("No subtitle entries, copying video as-is");
      execFileSync("cp", [videoPath, outputPath]);
      resolve();
      return;
    }

    // Render each subtitle line as a PNG via pango-view (HarfBuzz shaping)
    const tmpDir = path.join(os.tmpdir(), "smt-subtitles");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const pngPaths = [];
    for (let i = 0; i < entries.length; i++) {
      const textFile = path.join(tmpDir, `sub${i}.txt`);
      const rawPng = path.join(tmpDir, `sub${i}_raw.png`);
      const finalPng = path.join(tmpDir, `sub${i}.png`);

      fs.writeFileSync(textFile, entries[i].text, "utf8");

      const fontSize = 14;
      const videoWidth = videoDims?.w || 608;
      execFileSync(PANGO, [
        `--font=Noto Sans Myanmar Bold ${fontSize}`,
        "--background=transparent",
        "--foreground=#FFD700",
        "--align=center",
        `--width=${Math.floor(videoWidth * 0.80 * 0.75)}`,
        "--wrap=word",
        "-qo", rawPng,
        textFile,
      ]);

      if (fs.existsSync(CONVERT)) {
        const shadowPng = path.join(tmpDir, `sub${i}_shadow.png`);
        execFileSync(CONVERT, [
          rawPng,
          "(", "+clone",
          "-background", "black",
          "-shadow", "80x4+0+0",
          ")",
          "-reverse", "-background", "none", "-layers", "merge",
          shadowPng,
        ]);
        execFileSync(CONVERT, [
          shadowPng,
          "-channel", "alpha", "-morphology", "Dilate", "Octagon:3",
          "-fill", "black", "+opaque", "none",
          shadowPng, "-composite",
          finalPng,
        ]);
      } else {
        fs.copyFileSync(rawPng, finalPng);
      }

      pngPaths.push(finalPng);
    }

    spinner.text = "Overlaying Myanmar subtitles...";
    runPass2(FFMPEG_BIN, videoPath, entries, pngPaths, outputPath, spinner)
      .then(() => {
        spinner.succeed("Subtitles burned (Pango/HarfBuzz)");
        resolve();
      })
      .catch((err) => {
        console.error("[Step 7] Subtitle burn FAILED:", err.message);
        spinner.fail("Subtitle burn failed: " + err.message);
        reject(err);
      });
  });
}

function runPass1(ffmpegBin, videoPath, blurRanges, outputPath) {
  return new Promise((resolve, reject) => {
    const { spawn } = require("child_process");

    if (blurRanges.length === 0) {
      console.warn("[Step 7 Pass1] No blur ranges — copying video without blur");
      const { execFileSync } = require("child_process");
      execFileSync("cp", [videoPath, outputPath]);
      return resolve();
    }
    console.log("[Step 7 Pass1] Applying blur to", blurRanges.length, "region(s):", JSON.stringify(blurRanges));

    // Build blur-only filter_complex
    let filterComplex = "";
    let prevLabel = "0:v";

    for (let i = 0; i < blurRanges.length; i++) {
      const r = blurRanges[i];
      const baseA = `ba${i}`;
      const baseB = `bb${i}`;
      const blurLabel = `blur${i}`;
      const outLabel = i < blurRanges.length - 1 ? `bv${i}` : "vout";

      filterComplex +=
        `[${prevLabel}]split[${baseA}][${baseB}];` +
        `[${baseA}]crop=${r.w}:${r.h}:${r.x}:${r.y},gblur=sigma=40[${blurLabel}];` +
        `[${baseB}][${blurLabel}]overlay=${r.x}:${r.y}` +
        `:enable='between(t,${r.startT.toFixed(3)},${r.endT.toFixed(3)})'[${outLabel}]`;

      if (i < blurRanges.length - 1) filterComplex += ";";
      prevLabel = outLabel;
    }

    const args = [
      "-i", videoPath,
      "-filter_complex", filterComplex,
      "-map", "[vout]",
      "-map", "0:a",
      "-c:a", "copy",
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "fast",
      "-y",
      outputPath,
    ];

    const proc = spawn(ffmpegBin, args);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("Blur pass failed:\n" + stderr.slice(-800)));
    });
    proc.on("error", reject);
  });
}

function runPass2(ffmpegBin, videoPath, entries, pngPaths, outputPath, spinner) {
  return new Promise((resolve, reject) => {
    const { spawn } = require("child_process");

    if (entries.length === 0) {
      const { execFileSync } = require("child_process");
      execFileSync("cp", [videoPath, outputPath]);
      return resolve();
    }

    const inputs = [];
    for (const p of pngPaths) inputs.push("-i", p);

    let filterComplex = "";
    let prevLabel = "0:v";

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const outLabel = i < entries.length - 1 ? `mv${i}` : "vout";
      filterComplex +=
        `[${prevLabel}][${i + 1}:v]overlay=x=(W-w)/2:y=H*0.70-h` +
        `:enable='between(t,${e.start},${e.end})'[${outLabel}]`;
      if (i < entries.length - 1) filterComplex += ";";
      prevLabel = outLabel;
    }

    const args = [
      "-i", videoPath,
      ...inputs,
      "-filter_complex", filterComplex,
      "-map", "[vout]",
      "-map", "0:a",
      "-c:a", "copy",
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "fast",
      "-movflags", "+faststart",
      "-y",
      outputPath,
    ];

    const proc = spawn(ffmpegBin, args);
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      const m = stderr.match(/time=(\d+:\d+:\d+\.\d+)/g);
      if (m) spinner.text = `Overlaying subtitles: ${m[m.length - 1]}`;
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("Overlay pass failed:\n" + stderr.slice(-800)));
    });
    proc.on("error", reject);
  });
}

// Count Myanmar syllable clusters instead of raw characters.
// A cluster = base consonant (U+1000–U+102A) + any trailing combining marks (U+102B–U+103E).
// This prevents stacking diacritics (်, ြ, ွ, ာ …) from inflating the character count
// and making subtitles appear longer than the voice actually speaks them.
function myanmarSyllableCount(str) {
  const clusters = str.match(/[က-ဪဿ][ါ-ှ]*/g);
  return clusters ? clusters.length : Math.max(1, Math.ceil(str.length / 3));
}

// Utility functions
function parseTimestamp(ts) {
  if (!ts) return 0;
  const [min, sec] = ts.split(":").map(Number);
  return min * 60 + sec;
}

function formatSRTTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatASSTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${pad(m)}:${s.toFixed(2).padStart(5, "0")}`;
}

function pad(n, length = 2) {
  return String(Math.floor(n)).padStart(length, "0");
}

function splitIntoChunks(text, maxLen) {
  const words = text.split(" ");
  const chunks = [];
  let current = "";

  for (const word of words) {
    if ((current + word).length > maxLen && current) {
      chunks.push(current.trim());
      current = word + " ";
    } else {
      current += word + " ";
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
