/**
 * Step 6: Visual Mapping & Syncing (The Editor Phase)
 * Syncs audio with video using ffmpeg
 * - Audio longer than video → slow motion / freeze frame on video
 * - Audio shorter than video → trim video to match
 */

import { createRequire } from "module";
import ora from "ora";
import { logger } from "../utils/logger.js";
import { saveState, readJSON, fileExists } from "../utils/file-helper.js";
import { getAudioDuration } from "./step5-audio-generator.js";

const require = createRequire(import.meta.url);
const ffmpeg = require("fluent-ffmpeg");

export async function step6SyncVideo(options = {}) {
  logger.step(6, "Syncing audio with video...");

  const state = readJSON("./output/pipeline-state.json") || {};
  const videoPath = options.videoPath || process.env.INPUT_VIDEO_PATH || "./input/video.mp4";
  const audioPath = options.audioPath || state.step5?.audioPath || "./output/audio/narration.mp3";

  if (!fileExists(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}\nPlace your video at ${videoPath}`);
  }
  if (!fileExists(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}\nRun Step 5 first`);
  }

  // Ensure output directory exists
  const { mkdirSync } = require("fs");
  mkdirSync("./output/video", { recursive: true });

  logger.info(`Video: ${videoPath}`);
  logger.info(`Audio: ${audioPath}`);

  const spinner = ora("Analyzing durations...").start();

  const [videoDuration, audioDuration] = await Promise.all([
    getMediaDuration(videoPath),
    getAudioDuration(audioPath),
  ]);

  spinner.stop();
  logger.info(`Video duration: ${videoDuration?.toFixed(2)}s`);
  logger.info(`Audio duration: ${audioDuration?.toFixed(2)}s`);

  const outputPath = "./output/video/synced-video.mp4";

  if (!videoDuration || !audioDuration) {
    logger.warn("Could not determine durations. Merging directly...");
    await mergeAudioVideo(videoPath, audioPath, outputPath, 1.0);
  } else {
    const diff = audioDuration - videoDuration;

    if (Math.abs(diff) < 0.5) {
      // Durations are close enough - direct merge
      logger.info("Durations match! Merging directly...");
      await mergeAudioVideo(videoPath, audioPath, outputPath, 1.0);
    } else if (diff > 0) {
      // Audio is LONGER than video → slow down video
      const slowFactor = audioDuration / videoDuration;
      logger.info(`Audio is ${diff.toFixed(1)}s longer. Slowing video by ${slowFactor.toFixed(2)}x...`);
      await slowMotionSync(videoPath, audioPath, outputPath, slowFactor);
    } else {
      // Audio is SHORTER than video → trim video
      logger.info(`Video is ${Math.abs(diff).toFixed(1)}s longer. Trimming video to match audio...`);
      await trimAndMerge(videoPath, audioPath, outputPath, audioDuration);
    }
  }

  saveState({ step6: { completed: true, syncedVideoPath: outputPath, videoDuration, audioDuration } });
  logger.success(`Synced video saved → ${outputPath}`);

  return { outputPath, videoDuration, audioDuration };
}

function mergeAudioVideo(videoPath, audioPath, outputPath, speed = 1.0) {
  return new Promise((resolve, reject) => {
    const spinner = ora("Merging audio and video...").start();

    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-map 0:v:0",
        "-map 1:a:0",
        "-c:v libx264",
        "-c:a aac",
        "-crf 18",
        "-preset fast",
        "-shortest",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", () => {
        spinner.succeed("Merge complete");
        resolve();
      })
      .on("error", (err) => {
        spinner.fail("Merge failed");
        reject(err);
      })
      .run();
  });
}

function slowMotionSync(videoPath, audioPath, outputPath, slowFactor) {
  return new Promise((resolve, reject) => {
    const spinner = ora(`Applying slow motion (${slowFactor.toFixed(2)}x)...`).start();

    // PTS setpts slows video: setpts=2.0*PTS means 2x slower
    const ptsMultiplier = slowFactor.toFixed(4);

    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .complexFilter([
        `[0:v]setpts=${ptsMultiplier}*PTS[v]`,
      ])
      .outputOptions([
        "-map [v]",
        "-map 1:a:0",
        "-c:v libx264",
        "-c:a aac",
        "-crf 18",
        "-preset fast",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("progress", (progress) => {
        if (progress.percent) {
          spinner.text = `Slow motion encoding: ${Math.round(progress.percent)}%`;
        }
      })
      .on("end", () => {
        spinner.succeed("Slow motion sync complete");
        resolve();
      })
      .on("error", (err) => {
        spinner.fail("Slow motion failed");
        reject(err);
      })
      .run();
  });
}

function trimAndMerge(videoPath, audioPath, outputPath, targetDuration) {
  return new Promise((resolve, reject) => {
    const spinner = ora(`Trimming video to ${targetDuration.toFixed(1)}s...`).start();

    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-map 0:v:0",
        "-map 1:a:0",
        "-c:v libx264",
        "-c:a aac",
        "-crf 18",
        "-preset fast",
        "-t", targetDuration.toFixed(3),
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", () => {
        spinner.succeed("Trim and merge complete");
        resolve();
      })
      .on("error", (err) => {
        spinner.fail("Trim failed");
        reject(err);
      })
      .run();
  });
}

function getMediaDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(null);
      resolve(metadata?.format?.duration || null);
    });
  });
}
