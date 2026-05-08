/**
 * Detect yellow subtitle bounding boxes per frame using PIL/Python
 * Returns array of { t, x, y, w, h } entries
 */

import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const FFMPEG_FULL = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg";
const PYTHON = "/opt/homebrew/bin/python3";

const DETECT_SCRIPT = `
import sys, os
from PIL import Image

frame_dir = sys.argv[1]
fps = float(sys.argv[2])
frames = sorted(f for f in os.listdir(frame_dir) if f.endswith('.jpg'))

for fname in frames:
    idx = int(fname.replace('frame_','').replace('.jpg','')) - 1
    t = idx / fps
    img = Image.open(os.path.join(frame_dir, fname)).convert('RGB')
    pixels = img.load()
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            if r > 180 and g > 150 and (r - b) > 80 and (g - b) > 50:
                found = True
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
    if found:
        pad_x, pad_y = 25, 15
        bx = max(0, min_x - pad_x)
        by = max(0, min_y - pad_y)
        bw = min(w, max_x + pad_x) - bx
        bh = min(h, max_y + pad_y) - by
        # Filter: subtitle text is thin (bh<80) and not too narrow
        if bh < 80 and bw > 60:
            print(f"{t:.3f},{bx},{by},{bw},{bh}")
        else:
            print(f"{t:.3f},none")
    else:
        print(f"{t:.3f},none")
`;

export function detectSubtitleRegions(videoPath, fps = 6) {
  const tmpDir = path.join(os.tmpdir(), `smt-detect-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const scriptPath = path.join(tmpDir, "detect.py");
  fs.writeFileSync(scriptPath, DETECT_SCRIPT, "utf8");

  // Extract frames
  const ffmpeg = fs.existsSync(FFMPEG_FULL) ? FFMPEG_FULL : "ffmpeg";
  execFileSync(ffmpeg, [
    "-i", videoPath,
    "-vf", `fps=${fps}`,
    path.join(tmpDir, "frame_%04d.jpg"),
    "-y",
  ], { stdio: "pipe" });

  // Run detection
  const result = spawnSync(PYTHON, [scriptPath, tmpDir, String(fps)], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) throw result.error;

  const entries = [];
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    const t = parseFloat(parts[0]);
    if (parts[1] === "none") continue;
    entries.push({
      t,
      x: parseInt(parts[1]),
      y: parseInt(parts[2]),
      w: parseInt(parts[3]),
      h: parseInt(parts[4]),
    });
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return entries;
}

/**
 * Merge consecutive frames with similar bounding boxes into time ranges
 * Returns array of { startT, endT, x, y, w, h }
 */
export function mergeIntoRanges(entries, fps = 6) {
  if (entries.length === 0) return [];

  const frameDur = 1 / fps;
  const ranges = [];
  let cur = { ...entries[0], startT: entries[0].t, endT: entries[0].t + frameDur };

  for (let i = 1; i < entries.length; i++) {
    const e = entries[i];
    const gap = e.t - cur.endT;
    const sameRegion =
      Math.abs(e.y - cur.y) < 80 &&
      gap < 1.0;

    if (sameRegion) {
      // Expand bbox to cover both
      const x2 = Math.max(cur.x + cur.w, e.x + e.w);
      const y2 = Math.max(cur.y + cur.h, e.y + e.h);
      cur.x = Math.min(cur.x, e.x);
      cur.y = Math.min(cur.y, e.y);
      cur.w = x2 - cur.x;
      cur.h = y2 - cur.y;
      cur.endT = e.t + frameDur;
    } else {
      ranges.push({ startT: cur.startT, endT: cur.endT, x: cur.x, y: cur.y, w: cur.w, h: cur.h });
      cur = { ...e, startT: e.t, endT: e.t + frameDur };
    }
  }
  ranges.push({ startT: cur.startT, endT: cur.endT, x: cur.x, y: cur.y, w: cur.w, h: cur.h });

  // Add time padding so blur covers brief subtitle appearances between sampled frames
  const PAD = 0.3;
  return ranges.map(r => ({
    ...r,
    startT: Math.max(0, r.startT - PAD),
    endT: r.endT + PAD,
  }));
}
