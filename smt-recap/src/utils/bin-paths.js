/**
 * Resolve external binaries (ffmpeg, yt-dlp, pango-view, ImageMagick, python3)
 * without hardcoding a version number or a single machine's Homebrew prefix.
 *
 * Every one of these used to be hardcoded as e.g.
 *   "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg"
 * which only works on the exact machine that had that exact version
 * installed — any other Mac (different ffmpeg-full version, Intel Homebrew
 * prefix, or a fresh install) breaks silently or loudly. Resolve dynamically
 * instead, in order: known Cellar locations (any version) → `which` → bare
 * command name (rely on PATH at spawn time).
 */

import fs from "fs";
import { execSync } from "child_process";

function which(name) {
  try {
    const found = execSync(`which ${name}`, { encoding: "utf8" }).trim();
    return found && fs.existsSync(found) ? found : null;
  } catch (_) {
    return null;
  }
}

function findExecutable(name, extraCandidates = []) {
  for (const p of extraCandidates) {
    if (fs.existsSync(p)) return p;
  }
  return which(name) || name; // bare name: spawn/execFile will search PATH
}

// ffmpeg-full (Homebrew) installs versioned dirs under Cellar. A plain
// `ffmpeg` formula may also be installed and linked into PATH instead, so
// look in Cellar directly first — we specifically want the "full" build.
function findFfmpegFullBinDir() {
  for (const cellar of ["/opt/homebrew/Cellar/ffmpeg-full", "/usr/local/Cellar/ffmpeg-full"]) {
    if (!fs.existsSync(cellar)) continue;
    for (const version of fs.readdirSync(cellar)) {
      const dir = `${cellar}/${version}/bin`;
      if (fs.existsSync(`${dir}/ffmpeg`)) return dir;
    }
  }
  return null;
}

const ffmpegFullBinDir = findFfmpegFullBinDir();

export const FFMPEG = ffmpegFullBinDir
  ? `${ffmpegFullBinDir}/ffmpeg`
  : findExecutable("ffmpeg", ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]);

export const FFPROBE = ffmpegFullBinDir
  ? `${ffmpegFullBinDir}/ffprobe`
  : findExecutable("ffprobe", ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe"]);

// Directory form, for tools (like yt-dlp's --ffmpeg-location) that want a dir.
export const FFMPEG_BIN_DIR = ffmpegFullBinDir
  || (fs.existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin" : "/usr/local/bin");

export const YT_DLP = findExecutable("yt-dlp", ["/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp"]);

export const PANGO_VIEW = findExecutable("pango-view", ["/opt/homebrew/bin/pango-view", "/usr/local/bin/pango-view"]);

// Newer ImageMagick (v7) drops the standalone `convert` binary in favor of
// `magick`; keep both so either version of the formula works.
export const IMAGEMAGICK = (() => {
  const magick = findExecutable("magick", ["/opt/homebrew/bin/magick", "/usr/local/bin/magick"]);
  if (fs.existsSync(magick) || which("magick")) return magick;
  return findExecutable("convert", ["/opt/homebrew/bin/convert", "/usr/local/bin/convert"]);
})();

export const PYTHON3 = findExecutable("python3", ["/opt/homebrew/bin/python3", "/usr/local/bin/python3"]);
