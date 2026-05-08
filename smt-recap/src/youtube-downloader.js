/**
 * YouTube Video Downloader
 * Uses yt-dlp (system binary) — supports Shorts, age-restricted, all formats
 * Falls back to @distube/ytdl-core for info only
 */

import fs from "fs";
import { spawn } from "child_process";
import { ensureDir } from "./utils/file-helper.js";
import { logger } from "./utils/logger.js";

const YT_DLP = "/opt/homebrew/bin/yt-dlp";

export async function downloadYouTube(url, onProgress) {
  ensureDir("./input");
  const outputPath = "./input/video.mp4";

  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  logger.info(`Downloading via yt-dlp: ${url}`);

  return new Promise((resolve, reject) => {
    const args = [
      url,
      "-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
      "--merge-output-format", "mp4",
      "--ffmpeg-location", "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin",
      "-o", outputPath,
      "--no-playlist",
      "--newline",
    ];

    const proc = spawn(YT_DLP, args, { stdio: ["ignore", "pipe", "pipe"] });

    const onData = (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const match = line.match(/\[download\]\s+([\d.]+)%/);
        if (match && onProgress) {
          onProgress(Math.round(parseFloat(match[1])));
        }
      }
    };

    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}. Install with: brew install yt-dlp`));
    });
  });
}

export async function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    let raw = "";
    const proc = spawn(YT_DLP, ["--dump-json", "--no-playlist", url], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (d) => { raw += d.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Could not fetch video info (exit ${code})`));
        return;
      }
      try {
        const info = JSON.parse(raw);
        resolve({
          title: info.title,
          duration: info.duration,
          thumbnail: info.thumbnail,
          author: info.uploader || info.channel,
        });
      } catch (e) {
        reject(new Error(`Could not parse video info: ${e.message}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });

    setTimeout(() => { proc.kill(); reject(new Error("Video info fetch timed out")); }, 15000);
  });
}

export async function downloadTranscript(url) {
  ensureDir("./input");
  const outputTemplate = "./input/transcript";

  // Remove any existing transcript files
  for (const f of fs.readdirSync("./input")) {
    if (f.startsWith("transcript.")) fs.unlinkSync(`./input/${f}`);
  }

  return new Promise((resolve) => {
    const args = [
      url,
      "--write-auto-subs",
      "--sub-langs", "en",
      "--sub-format", "vtt",
      "--skip-download",
      "--no-playlist",
      "-o", outputTemplate,
    ];

    const proc = spawn(YT_DLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.on("close", () => {
      // Find downloaded vtt file
      const files = fs.readdirSync("./input").filter(f => f.startsWith("transcript") && f.endsWith(".vtt"));
      if (!files.length) {
        logger.info("No transcript available for this video");
        return resolve(null);
      }
      const vttPath = `./input/${files[0]}`;
      const text = parseVTT(fs.readFileSync(vttPath, "utf8"));
      fs.unlinkSync(vttPath);
      if (!text.trim()) return resolve(null);
      logger.info(`Transcript downloaded — ${text.split(/\s+/).length} words`);
      resolve(text);
    });
    proc.on("error", () => resolve(null));
  });
}

function parseVTT(vtt) {
  const seen = new Set();
  const lines = vtt.split("\n");
  const textLines = [];

  for (const line of lines) {
    const clean = line
      .replace(/<[^>]+>/g, "")       // remove HTML tags like <c>, </c>
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    // Skip WEBVTT header, timestamps, NOTE blocks, empty lines
    if (!clean || clean.startsWith("WEBVTT") || clean.startsWith("NOTE") ||
        /^\d{2}:\d{2}/.test(clean) || /-->/.test(clean) || /^\d+$/.test(clean)) continue;

    // Deduplicate (VTT often repeats lines progressively)
    if (!seen.has(clean)) {
      seen.add(clean);
      textLines.push(clean);
    }
  }

  return textLines.join(" ");
}

export function isValidYouTubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/.test(url);
}
