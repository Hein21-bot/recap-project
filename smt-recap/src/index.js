#!/usr/bin/env node

/**
 * SMT Recap - Myanmar AI Video Pipeline
 * 8-Step Automated Video Production System
 *
 * Usage:
 *   node src/index.js pipeline --video ./input/video.mp4
 *   node src/index.js step1 --video ./input/video.mp4
 *   node src/index.js step1 --text "your content here"
 *   node src/index.js step5 --voice sadaltager
 *   node src/index.js step8 --resolution 4k
 */

import "dotenv/config";
import { Command } from "commander";
import { logger } from "./utils/logger.js";
import { readState } from "./utils/file-helper.js";

import { step1GenerateScript } from "./steps/step1-script-generator.js";
import { step2SelectVoice } from "./steps/step2-voice-selector.js";
import { step3SetTone } from "./steps/step3-tone-setter.js";
import { step4FormatVocal } from "./steps/step4-vocal-formatter.js";
import { step5GenerateAudio } from "./steps/step5-audio-generator.js";
import { step6SyncVideo } from "./steps/step6-video-syncer.js";
import { step7AddSubtitles } from "./steps/step7-subtitles.js";
import { step8Export } from "./steps/step8-exporter.js";

const program = new Command();

program
  .name("smt-recap")
  .description("Myanmar AI Video Pipeline - 8-Step Automated Production")
  .version("1.0.0");

// ─── Full Pipeline ────────────────────────────────────────────────────────────
program
  .command("pipeline")
  .description("Run the complete 8-step pipeline")
  .option("-v, --video <path>", "Input video file path", "./input/video.mp4")
  .option("-t, --text <content>", "Text content (if no video)")
  .option("--voice <key>", "Voice character key (sadaltager/energetic/documentary/youthful)")
  .option("--tone <key>", "Tone key (knowledge/funny/documentary/educational)")
  .option("--resolution <res>", "Export resolution (4k/1080p/720p/instagram/tiktok)", "4k")
  .action(async (opts) => {
    logger.banner();
    console.log(`Starting full pipeline...\n`);

    try {
      // Step 1: Generate Script
      const script = await step1GenerateScript({
        videoPath: opts.video,
        textContent: opts.text,
      });

      // Step 2: Select Voice
      const voice = await step2SelectVoice({ voiceKey: opts.voice });

      // Step 3: Set Tone
      const { tone, toneKey } = await step3SetTone({ tone: opts.tone });

      // Step 4: Format for Vocal
      await step4FormatVocal({ script, toneKey });

      // Step 5: Generate Audio
      await step5GenerateAudio({ voice });

      // Step 6: Sync Video
      await step6SyncVideo({ videoPath: opts.video });

      // Step 7: Add Subtitles
      await step7AddSubtitles({});

      // Step 8: Export
      await step8Export({ resolution: opts.resolution });

    } catch (err) {
      logger.error(`Pipeline failed: ${err.message}`);
      process.exit(1);
    }
  });

// ─── Individual Steps ─────────────────────────────────────────────────────────
program
  .command("step1")
  .description("Step 1: Generate Myanmar script from video/text")
  .option("-v, --video <path>", "Input video file path")
  .option("-t, --text <content>", "Text content to summarize")
  .action(async (opts) => {
    logger.banner();
    try {
      await step1GenerateScript({ videoPath: opts.video, textContent: opts.text });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

program
  .command("step2")
  .description("Step 2: Select AI voice character")
  .option("--voice <key>", "Voice key (sadaltager/energetic/documentary/youthful)")
  .action(async (opts) => {
    try {
      await step2SelectVoice({ voiceKey: opts.voice });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

program
  .command("step3")
  .description("Step 3: Set tone and mood")
  .option("--tone <key>", "Tone key (knowledge/funny/documentary/educational)")
  .action(async (opts) => {
    try {
      await step3SetTone({ tone: opts.tone });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

program
  .command("step4")
  .description("Step 4: Format script for natural vocal delivery")
  .option("--tone <key>", "Override tone key")
  .action(async (opts) => {
    try {
      await step4FormatVocal({ toneKey: opts.tone });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

program
  .command("step5")
  .description("Step 5: Generate audio with ElevenLabs TTS")
  .option("--voice <key>", "Voice key override")
  .action(async (opts) => {
    try {
      const voice = opts.voice ? (await import("./config/voices.js")).VOICES[opts.voice] : undefined;
      await step5GenerateAudio({ voice });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

program
  .command("step6")
  .description("Step 6: Sync audio with video")
  .option("-v, --video <path>", "Input video path")
  .option("-a, --audio <path>", "Input audio path")
  .action(async (opts) => {
    try {
      await step6SyncVideo({ videoPath: opts.video, audioPath: opts.audio });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

program
  .command("step7")
  .description("Step 7: Add subtitles and visual effects")
  .option("-v, --video <path>", "Input video path")
  .action(async (opts) => {
    try {
      await step7AddSubtitles({ videoPath: opts.video });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

program
  .command("step8")
  .description("Step 8: Final export")
  .option("-i, --input <path>", "Input video path")
  .option("-r, --resolution <res>", "Export resolution (4k/1080p/720p/instagram/tiktok)", "4k")
  .action(async (opts) => {
    try {
      await step8Export({ inputPath: opts.input, resolution: opts.resolution });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

// ─── Status Command ───────────────────────────────────────────────────────────
program
  .command("status")
  .description("Show current pipeline status")
  .action(() => {
    const state = readState();
    if (!state || Object.keys(state).length === 0) {
      logger.warn("No pipeline state found. Run a step first.");
      return;
    }

    console.log("\nPipeline Status:");
    const steps = ["step1", "step2", "step3", "step4", "step5", "step6", "step7", "step8"];
    const names = [
      "Script Generation",
      "Voice Selection",
      "Tone Setting",
      "Vocal Formatting",
      "Audio Generation",
      "Video Syncing",
      "Subtitle Addition",
      "Final Export",
    ];

    for (let i = 0; i < steps.length; i++) {
      const s = state[steps[i]];
      const icon = s?.completed ? "✓" : "○";
      console.log(`  ${icon} Step ${i + 1}: ${names[i]}`);
    }

    if (state.step8?.exportPath) {
      console.log(`\n  Output: ${state.step8.exportPath}`);
    }
    console.log();
  });

program.parse();
