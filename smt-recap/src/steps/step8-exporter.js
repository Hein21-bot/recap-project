/**
 * Step 8: Final Review & Export
 * Final quality check and 4K export
 */

import { createRequire } from "module";
import ora from "ora";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import { saveState, readJSON, fileExists, getFileSize } from "../utils/file-helper.js";

const require = createRequire(import.meta.url);
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const os = require("os");
const path = require("path");

const FFMPEG_FULL = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg";
if (fs.existsSync(FFMPEG_FULL)) ffmpeg.setFfmpegPath(FFMPEG_FULL);

const EXPORT_PRESETS = {
  "4k": {
    width: 3840,
    height: 2160,
    crf: 18,
    preset: "slow",
    suffix: "_4K",
  },
  "1080p": {
    width: 1920,
    height: 1080,
    crf: 18,
    preset: "slow",
    suffix: "_1080p",
  },
  "720p": {
    width: 1280,
    height: 720,
    crf: 20,
    preset: "medium",
    suffix: "_720p",
  },
  instagram: {
    width: 1080,
    height: 1080,
    crf: 20,
    preset: "medium",
    suffix: "_Instagram",
  },
  tiktok: {
    width: 1080,
    height: 1920,
    crf: 20,
    preset: "medium",
    suffix: "_TikTok",
  },
};

export async function step8Export(options = {}) {
  logger.step(8, "Final review and export...");

  const state = readJSON("./output/pipeline-state.json") || {};
  const inputPath =
    options.inputPath ||
    state.step7?.subtitledVideoPath ||
    state.step6?.syncedVideoPath ||
    "./output/video/subtitled-video.mp4";

  if (!fileExists(inputPath)) {
    throw new Error(`No processed video found at ${inputPath}. Complete previous steps first.`);
  }

  // Ensure output directory exists
  fs.mkdirSync("./output/final", { recursive: true });

  // Review summary
  await printReviewSummary(state, inputPath);

  const resolution = options.resolution || "1080p";
  const watermark  = (options.watermark || "").trim();

  // Detect input dimensions to preserve orientation (portrait/landscape)
  const meta = await getVideoMetadata(inputPath);
  const videoStream = meta?.streams?.find(s => s.codec_type === "video");
  const inputW = videoStream?.width  || 1080;
  const inputH = videoStream?.height || 1920;
  const isPortrait = inputH > inputW;

  // Scale so the shorter dimension hits the target, maintaining aspect ratio
  const targetShort = resolution === "4k" ? 2160 : 1080;
  const scale = isPortrait
    ? `scale=${targetShort}:-2`   // portrait: fix width, auto height
    : `scale=-2:${targetShort}`;  // landscape: auto width, fix height

  console.log(`[Step 8] Input: ${inputW}x${inputH} (${isPortrait ? "portrait" : "landscape"}) → scale: ${scale}`);

  const crf    = resolution === "4k" ? 18 : 18;
  const suffix = resolution === "4k" ? "_4K" : "_1080p";

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const outputPath = `./output/final/smt-recap${suffix}_${timestamp}.mp4`;

  await exportVideo(inputPath, outputPath, { crf, preset: "slow", scale }, watermark);

  const fileSize = getFileSize(outputPath);
  saveState({ step8: { completed: true, exportPath: outputPath, resolution, completedAt: new Date().toISOString() } });

  logger.success(`\nExport complete!`);
  logger.info(`Output: ${outputPath}`);
  logger.info(`Resolution: ${resolution} (${isPortrait ? "portrait" : "landscape"})`);
  logger.info(`File size: ${fileSize}`);

  // Clean up intermediate files to save disk space
  // Keep subtitled-video.mp4 so re-export always has the correct source
  const cleanupPaths = [
    "./input/video.mp4",
    "./output/video/synced-video.mp4",
    "./output/audio/narration_raw.wav",
    "./output/audio/narration.wav",
    "./output/subtitles",
  ];
  for (const p of cleanupPaths) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
        else fs.unlinkSync(p);
      }
    } catch (_) {}
  }
  logger.info("Intermediate files cleaned up.");

  printCompletionBanner(outputPath);

  return { outputPath, fileSize };
}

async function printReviewSummary(state, videoPath) {
  console.log(chalk.cyan("\n" + "═".repeat(60)));
  console.log(chalk.bold.cyan("  Final Review Summary"));
  console.log(chalk.cyan("═".repeat(60)));

  // Get video properties
  const metadata = await getVideoMetadata(videoPath);
  if (metadata) {
    const video = metadata.streams?.find((s) => s.codec_type === "video");
    const audio = metadata.streams?.find((s) => s.codec_type === "audio");
    const duration = parseFloat(metadata.format?.duration || 0);

    console.log(chalk.white(`  Duration:    ${duration.toFixed(1)}s`));
    if (video) {
      console.log(chalk.white(`  Resolution:  ${video.width}x${video.height}`));
      console.log(chalk.white(`  Video codec: ${video.codec_name}`));
    }
    if (audio) {
      console.log(chalk.white(`  Audio codec: ${audio.codec_name}`));
    }
  }

  // Pipeline completion status
  const steps = [
    { num: 1, name: "Script Generated", key: "step1" },
    { num: 2, name: "Voice Selected", key: "step2" },
    { num: 3, name: "Tone Set", key: "step3" },
    { num: 4, name: "Vocal Formatted", key: "step4" },
    { num: 5, name: "Audio Generated", key: "step5" },
    { num: 6, name: "Video Synced", key: "step6" },
    { num: 7, name: "Subtitles Added", key: "step7" },
  ];

  console.log(chalk.cyan("\n  Pipeline Steps:"));
  for (const step of steps) {
    const done = state[step.key]?.completed;
    const icon = done ? chalk.green("  ✓") : chalk.yellow("  ○");
    console.log(`${icon} Step ${step.num}: ${step.name}`);
  }

  console.log(chalk.cyan("═".repeat(60) + "\n"));
}

function buildVf(scale, textFilePath) {
  const parts = [];
  if (textFilePath) {
    parts.push(`drawtext=textfile=${textFilePath}:fontsize=45:fontcolor=white:x=w-tw-16:y=16:box=1:boxcolor=black@0.55:boxborderw=6`);
  }
  parts.push(scale);
  return parts.join(",");
}

function exportVideo(inputPath, outputPath, preset, watermark = "") {
  let textFilePath = null;
  if (watermark) {
    textFilePath = path.join(os.tmpdir(), `smt_wm_${Date.now()}.txt`);
    fs.writeFileSync(textFilePath, watermark, "utf8");
    console.log("[Step 8] Watermark text:", watermark, "→ tempfile:", textFilePath);
  }

  const vf = buildVf(preset.scale, textFilePath);
  const outputOptions = [
    "-vf", vf,
    "-c:v libx264",
    "-c:a aac",
    "-ar 48000",
    "-ac 2",
    "-b:a 192k",
    `-crf ${preset.crf}`,
    `-preset ${preset.preset}`,
    "-profile:v high",
    "-level 4.2",
    "-movflags +faststart",
    "-pix_fmt yuv420p",
  ];

  return new Promise((resolve, reject) => {
    const spinner = ora("Exporting...").start();

    ffmpeg()
      .input(inputPath)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on("progress", (progress) => {
        if (progress.percent) spinner.text = `Exporting: ${Math.round(progress.percent)}%`;
      })
      .on("end", () => {
        spinner.succeed("Export complete");
        if (textFilePath && fs.existsSync(textFilePath)) fs.unlinkSync(textFilePath);
        resolve();
      })
      .on("error", (err) => {
        spinner.fail("Export failed");
        if (textFilePath && fs.existsSync(textFilePath)) fs.unlinkSync(textFilePath);
        reject(err);
      })
      .run();
  });
}

function getVideoMetadata(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(null);
      resolve(metadata);
    });
  });
}

function printCompletionBanner(outputPath) {
  console.log(chalk.green(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   ✓  Myanmar AI Video Pipeline Complete!      ║
  ║                                               ║
  ║   Your video is ready at:                     ║
  ║   ${outputPath.padEnd(45)} ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
  `));
}
