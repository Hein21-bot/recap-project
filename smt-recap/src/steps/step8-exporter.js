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

const FFMPEG_FULL  = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg";
const PANGO        = "/opt/homebrew/bin/pango-view";
const CONVERT      = "/opt/homebrew/bin/convert";
const WATERMARK_IMG = path.resolve("./assets/watermark.png");
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

  const resolution    = options.resolution || "1080p";
  const thumbnailText = (options.thumbnailText || "").trim();

  // Detect input dimensions to preserve orientation (portrait/landscape)
  const meta = await getVideoMetadata(inputPath);
  const videoStream = meta?.streams?.find(s => s.codec_type === "video");
  const inputW = videoStream?.width  || 1080;
  const inputH = videoStream?.height || 1920;
  const isPortrait = inputH > inputW;

  // Scale so the shorter dimension hits the target, maintaining aspect ratio.
  // Never scale ABOVE the source's own resolution — yt-dlp caps downloads at
  // 1080p, so picking "4K" here would just stretch existing pixels (soft,
  // blurry "fake 4K") instead of adding real detail. Cap to whichever is smaller.
  const requestedShort = resolution === "4k" ? 2160 : 1080;
  const sourceShort = isPortrait ? inputW : inputH;
  const targetShort = Math.min(requestedShort, sourceShort);
  const wasCapped = targetShort < requestedShort;
  const scale = isPortrait
    ? `scale=${targetShort}:-2`   // portrait: fix width, auto height
    : `scale=-2:${targetShort}`;  // landscape: auto width, fix height

  console.log(`[Step 8] Input: ${inputW}x${inputH} (${isPortrait ? "portrait" : "landscape"}) → scale: ${scale}`
    + (wasCapped ? ` (capped from ${requestedShort} — source has no more detail than this)` : ""));

  const crf    = resolution === "4k" ? 18 : 18;
  const suffix = resolution === "4k" ? "_4K" : "_1080p";

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const outputPath = `./output/final/smt-recap${suffix}_${timestamp}.mp4`;

  // Final output frame width (matches what `scale` above produces), used to
  // size the thumbnail and watermark relative to the actual exported frame.
  const outputW = isPortrait ? targetShort : Math.round(inputW * targetShort / inputH / 2) * 2;

  // Render thumbnail text PNG via Pango (supports Myanmar + English)
  let thumbnailPng = null;
  if (thumbnailText) {
    thumbnailPng = await renderThumbnailPng(thumbnailText, outputW);
    console.log("[Step 8] Thumbnail PNG rendered:", thumbnailPng);
  }

  // Watermark image, chosen in the UI from ./assets/*, falling back to the default.
  const watermarkPath = path.resolve("./assets", options.watermarkImage || "watermark.png");
  const finalWatermarkPath = fs.existsSync(watermarkPath) ? watermarkPath : WATERMARK_IMG;
  // Size relative to the OUTPUT frame width, not the watermark file's own
  // resolution — the old `scale=iw/8` made it tiny regardless of video size.
  const watermarkSizePct = Number(options.watermarkSizePct) || Number(process.env.WATERMARK_WIDTH_PCT) * 100 || 16;
  const watermarkWidthPx = Math.round(outputW * (watermarkSizePct / 100));
  // Margin from the frame edges, also resolution-relative (was a hardcoded 20px).
  const watermarkPaddingPct = Number(options.watermarkPaddingPct) || Number(process.env.WATERMARK_PADDING_PCT) || 2;
  const watermarkPaddingPx = Math.round(outputW * (watermarkPaddingPct / 100));

  await exportVideo(inputPath, outputPath, { crf, preset: "slow", scale }, thumbnailPng, finalWatermarkPath, options.watermarkPosition || "top-right", watermarkWidthPx, watermarkPaddingPx);

  const fileSize = getFileSize(outputPath);
  saveState({ step8: { completed: true, exportPath: outputPath, resolution, resolutionCapped: wasCapped, completedAt: new Date().toISOString() } });

  logger.success(`\nExport complete!`);
  logger.info(`Output: ${outputPath}`);
  logger.info(`Resolution: ${resolution} (${isPortrait ? "portrait" : "landscape"})${wasCapped ? " — capped to source resolution, no upscale" : ""}`);
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

  return { outputPath, fileSize, resolutionCapped: wasCapped };
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

// x:y expressions for each corner. W/H = output frame, w/h = overlay image,
// pad = margin in px from the edges (was a hardcoded 20 before).
function watermarkPositionExpr(position, pad) {
  const exprs = {
    "top-left":     `${pad}:${pad}`,
    "top-right":    `W-w-${pad}:${pad}`,
    "bottom-left":  `${pad}:H-h-${pad}`,
    "bottom-right": `W-w-${pad}:H-h-${pad}`,
  };
  return exprs[position] || exprs["top-right"];
}

function exportVideo(inputPath, outputPath, preset, thumbnailPng = null, watermarkPath = WATERMARK_IMG, watermarkPosition = "top-right", watermarkWidthPx = 180, watermarkPaddingPx = 20) {
  const hasWatermark  = fs.existsSync(watermarkPath);
  const hasThumbnail  = thumbnailPng && fs.existsSync(thumbnailPng);
  const wmPos = watermarkPositionExpr(watermarkPosition, watermarkPaddingPx);

  const codecOptions = [
    "-c:v", "libx264",
    "-c:a", "aac",
    "-ar", "48000",
    "-ac", "2",
    "-b:a", "192k",
    "-crf", String(preset.crf),
    "-preset", preset.preset,
    "-profile:v", "high",
    "-level", "4.2",
    "-movflags", "+faststart",
    "-pix_fmt", "yuv420p",
  ];

  return new Promise((resolve, reject) => {
    const spinner = ora("Exporting...").start();
    const { spawn } = require("child_process");
    const FFMPEG_BIN = fs.existsSync(FFMPEG_FULL) ? FFMPEG_FULL : "ffmpeg";

    let args;

    if (hasWatermark || hasThumbnail) {
      // Build filter_complex with any combination of watermark image + thumbnail overlay
      const inputs = ["-i", inputPath];
      let inputIndex = 1;
      let wmIndex = -1;
      let thumbIndex = -1;

      if (hasWatermark) {
        inputs.push("-i", watermarkPath);
        wmIndex = inputIndex++;
      }
      if (hasThumbnail) {
        inputs.push("-i", thumbnailPng);
        thumbIndex = inputIndex++;
      }

      // Chain: scale base → overlay watermark (bottom-right) → overlay thumbnail (center 0-5s)
      let prevLabel = "0:v";
      const filters = [];

      filters.push(`[${prevLabel}]${preset.scale}[scaled]`);
      prevLabel = "scaled";

      if (wmIndex !== -1) {
        filters.push(
          `[${wmIndex}:v]scale=${watermarkWidthPx}:-1,format=rgba,colorchannelmixer=aa=0.75[wm]`,
          `[${prevLabel}][wm]overlay=${wmPos}[wmout]`
        );
        prevLabel = "wmout";
      }

      if (thumbIndex !== -1) {
        filters.push(
          `[${prevLabel}][${thumbIndex}:v]overlay=x=(W-w)/2:y=H*0.20:enable='between(t,0,5)'[vout]`
        );
        prevLabel = "vout";
      } else {
        // rename last label to vout
        filters[filters.length - 1] = filters[filters.length - 1].replace(`[${prevLabel}]`, "[vout]");
        prevLabel = "vout";
      }

      args = [
        ...inputs,
        "-filter_complex", filters.join(";"),
        "-map", "[vout]",
        "-map", "0:a",
        ...codecOptions,
        "-y", outputPath,
      ];
    } else {
      // No overlays — simple -vf scale
      args = [
        "-i", inputPath,
        "-vf", preset.scale,
        ...codecOptions,
        "-y", outputPath,
      ];
    }

    console.log("[Step 8] FFmpeg args:", args.join(" "));
    const proc = spawn(FFMPEG_BIN, args);
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      const m = stderr.match(/time=(\d+:\d+:\d+\.\d+)/g);
      if (m) spinner.text = `Exporting: ${m[m.length - 1]}`;
    });
    proc.on("close", (code) => {
      if (code === 0) {
        spinner.succeed("Export complete");
        resolve();
      } else {
        spinner.fail("Export failed");
        reject(new Error("Export failed:\n" + stderr.slice(-800)));
      }
    });
    proc.on("error", reject);
  });
}

function renderThumbnailPng(text, videoWidth = 608) {
  const { execFileSync } = require("child_process");
  const tmpDir = path.join(os.tmpdir(), "smt-thumbnail");
  fs.mkdirSync(tmpDir, { recursive: true });

  const textFile = path.join(tmpDir, "thumb_text.txt");
  const rawPng   = path.join(tmpDir, "thumb_raw.png");
  const finalPng = path.join(tmpDir, "thumb_final.png");

  fs.writeFileSync(textFile, text, "utf8");

  execFileSync(PANGO, [
    "--font=Noto Sans Myanmar Bold 26",
    "--background=transparent",
    "--foreground=#FFD700",
    "--align=center",
    `--width=${Math.floor(videoWidth * 0.80 * 0.75)}`,
    "--wrap=word",
    "-qo", rawPng,
    textFile,
  ]);

  if (fs.existsSync(CONVERT)) {
    const shadowPng = path.join(tmpDir, "thumb_shadow.png");
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

  return finalPng;
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
