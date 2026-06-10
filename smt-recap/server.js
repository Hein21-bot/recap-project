/**
 * SMT Recap — Web UI Server
 * Step-by-step pipeline: each step runs on demand, user reviews before continuing
 * State stored in PostgreSQL per sessionId
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { downloadYouTube, getVideoInfo, downloadTranscript } from "./src/youtube-downloader.js";
import { step1GenerateScript } from "./src/steps/step3-script-generator.js";
import { step2SelectVoice } from "./src/steps/step1-voice-selector.js";
import { step3SetTone } from "./src/steps/step2-tone-setter.js";
import { step4FormatVocal } from "./src/steps/step4-vocal-formatter.js";
import { step5GenerateAudio } from "./src/steps/step5-audio-generator.js";
import { step6SyncVideo } from "./src/steps/step6-video-syncer.js";
import { step7AddSubtitles } from "./src/steps/step7-subtitles.js";
import { step8Export } from "./src/steps/step8-exporter.js";
import { readJSON } from "./src/utils/file-helper.js";
import { initDB, getSession, saveSession, resetSession } from "./src/utils/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/output", express.static(path.join(__dirname, "output")));

// ── SSE: real-time logs for long-running steps ────────────────────────────────
const clients = new Map();

app.get("/api/events/:jobId", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  clients.set(req.params.jobId, res);
  req.on("close", () => clients.delete(req.params.jobId));
});

function emit(jobId, type, data) {
  const client = clients.get(jobId);
  if (client) client.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

// ── Pipeline state ────────────────────────────────────────────────────────────
app.get("/api/state", async (req, res) => {
  const sessionId = req.query.sessionId || "default";
  const state = await getSession(sessionId);
  res.json(state);
});

// ── Reset pipeline ────────────────────────────────────────────────────────────
app.post("/api/reset", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  await resetSession(sessionId);
  // Clear output files
  const dirs = ["./output/audio", "./output/video", "./output/subtitles", "./output/exports", "./output/final"];
  for (const dir of dirs) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  ["./output/script.json", "./output/script-raw.txt", "./output/script-formatted.json",
    "./output/tts-input.txt", "./output/pipeline-state.json",
    "./output/sentence-durations.json"].forEach(f => {
      if (fs.existsSync(f)) fs.rmSync(f);
    });
  if (fs.existsSync("./input/video.mp4")) fs.rmSync("./input/video.mp4");
  res.json({ success: true });
});

// ── Step 0: YouTube info preview ──────────────────────────────────────────────
app.post("/api/step/0/info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });
  try {
    const info = await getVideoInfo(url);
    console.log("[Step 0 Info] SUCCESS — title:", info.title);
    res.json(info);
  } catch (err) {
    console.error("[Step 0 Info] ERROR:", err.stack || err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── Step 0: Download ──────────────────────────────────────────────────────────
app.post("/api/step/0/download", async (req, res) => {
  const { url, jobId, sessionId } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });

  res.json({ started: true });

  try {
    await saveSession(sessionId, { youtubeUrl: url, startedAt: new Date().toISOString() });
    emit(jobId, "log", { message: `yt-dlp ဖြင့် ဒေါင်းလုဒ်လုပ်နေသည်...` });

    const videoPath = await downloadYouTube(url, (percent) => {
      emit(jobId, "progress", { percent });
    });

    emit(jobId, "log", { message: "Transcript ရှာဖွေနေသည်..." });
    const transcript = await downloadTranscript(url);
    if (transcript) {
      emit(jobId, "log", { message: `Transcript ရရှိသည် — ${transcript.split(/\s+/).length} words` });
    } else {
      emit(jobId, "log", { message: "Transcript မရှိပါ — ဗီဒီယိုမှ Script ထုတ်မည်" });
    }

    await saveSession(sessionId, { step0: { completed: true, videoPath, transcript: transcript || null } });
    console.log("[Step 0] SUCCESS — videoPath:", videoPath, "transcript:", transcript ? `${transcript.split(/\s+/).length} words` : "none");
    emit(jobId, "done", { success: true, videoPath, hasTranscript: !!transcript });
  } catch (err) {
    console.error("[Step 0] ERROR:", err.stack || err.message);
    emit(jobId, "done", { success: false, error: err.message });
  }
});

// ── Step 1: Generate script ───────────────────────────────────────────────────
app.post("/api/step/1/generate", async (req, res) => {
  const { jobId, sessionId } = req.body;
  console.log("[Step 1] Route hit — jobId:", jobId, "sessionId:", sessionId);
  res.json({ started: true });
  console.log("[Step 1] Response sent, starting pipeline...");

  try {
    console.log("[Step 1] Entering try block...");
    const state = await getSession(sessionId);
    const toneKey = state.step3?.toneKey || "knowledge";
    const speedMultiplier = state.step3?.tone?.speedMultiplier || 1.0;
    const transcript = state.step0?.transcript || null;
    console.log("[Step 1] Using toneKey:", toneKey, "speedMultiplier:", speedMultiplier, "transcript:", transcript ? "yes" : "no");

    let scriptOptions;
    if (transcript) {
      let videoDurationSeconds = null;
      try {
        const { execFileSync } = await import("child_process");
        const FFPROBE = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffprobe";
        const out = execFileSync(FFPROBE, ["-v", "quiet", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1", "./input/video.mp4"], { encoding: "utf8" });
        videoDurationSeconds = parseFloat(out.split("=")[1]) || null;
        if (videoDurationSeconds) console.log("[Step 1] Video duration:", videoDurationSeconds.toFixed(1) + "s");
      } catch (_) {}
      emit(jobId, "log", { message: `Transcript ဖြင့် Script ထုတ်နေသည်... (Tone: ${toneKey}, Speed: ${speedMultiplier}x, Duration: ${videoDurationSeconds ? videoDurationSeconds.toFixed(0) + "s" : "unknown"})` });
      scriptOptions = { textContent: transcript, toneKey, speedMultiplier, videoDurationSeconds };
    } else {
      emit(jobId, "log", { message: `ဗီဒီယိုဖြင့် Script ထုတ်နေသည်... (Tone: ${toneKey}, Speed: ${speedMultiplier}x)` });
      scriptOptions = { videoPath: "./input/video.mp4", toneKey, speedMultiplier };
    }
    console.log("[Step 1] Calling step1GenerateScript...");
    const script = await step1GenerateScript(scriptOptions);
    console.log("[Step 1] step1GenerateScript returned, saving session...");
    await saveSession(sessionId, {
      step1: { completed: true, script: script.fullScript, wordCount: script.wordCount, summary: script.summary },
      step4: null, step5: null, step6: null, step7: null, step8: null,
    });
    console.log("[Step 1] SUCCESS — wordCount:", script.wordCount);
    emit(jobId, "done", {
      success: true,
      script: script.fullScript,
      wordCount: script.wordCount,
      summary: script.summary,
      sections: script.sections,
    });
  } catch (err) {
    console.error("[Step 1] ERROR:", err.stack || err.message);
    emit(jobId, "done", { success: false, error: err.message });
  }
});

// ── Step 1: Save edited script ────────────────────────────────────────────────
app.post("/api/step/1/save", async (req, res) => {
  const { script, sessionId } = req.body;
  console.log("[Step 1 Save] Route hit — sessionId:", sessionId);
  if (!script) return res.status(400).json({ error: "script required" });

  try {
    const existing = readJSON("./output/script.json") || {};
    const updated = {
      ...existing,
      fullScript: script,
      wordCount: script.split(/\s+/).filter(Boolean).length,
      editedByUser: true,
      editedAt: new Date().toISOString(),
    };
    fs.writeFileSync("./output/script.json", JSON.stringify(updated, null, 2));
    await saveSession(sessionId, { step1: { completed: true, script, wordCount: updated.wordCount }, step4: null, step5: null, step6: null, step7: null, step8: null });
    console.log("[Step 1 Save] SUCCESS — wordCount:", updated.wordCount);
    res.json({ success: true, wordCount: updated.wordCount });
  } catch (err) {
    console.error("[Step 1 Save] ERROR:", err.stack || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Step 2: Select voice ──────────────────────────────────────────────────────
app.post("/api/step/2/select", async (req, res) => {
  const { voiceKey, sessionId } = req.body;
  console.log("[Step 2] Route hit — voiceKey:", voiceKey, "sessionId:", sessionId);
  try {
    console.log("[Step 2] Calling step2SelectVoice...");
    const voice = await step2SelectVoice({ voiceKey: voiceKey || "sadaltager" });
    console.log("[Step 2] Saving session...");
    await saveSession(sessionId, { step2: { completed: true, voice, voiceKey } });
    console.log("[Step 2] SUCCESS — voiceKey:", voiceKey);
    res.json({ success: true, voice });
  } catch (err) {
    console.error("[Step 2] ERROR:", err.stack || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Step 3: Set tone ──────────────────────────────────────────────────────────
app.post("/api/step/3/select", async (req, res) => {
  const { tone, sessionId } = req.body;
  console.log("[Step 3] Route hit — tone:", tone, "sessionId:", sessionId);
  try {
    console.log("[Step 3] Calling step3SetTone...");
    const result = await step3SetTone({ tone: tone || "knowledge" });
    console.log("[Step 3] Saving session...");
    await saveSession(sessionId, { step3: { completed: true, tone: result.tone, toneKey: result.toneKey } });
    console.log("[Step 3] SUCCESS — tone:", result.toneKey);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Step 3] ERROR:", err.stack || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Step 4: Format vocal (sync — instant) ────────────────────────────────────
app.post("/api/step/4/format-sync", async (req, res) => {
  const { sessionId } = req.body;
  console.log("[Step 4] Route hit — sessionId:", sessionId);
  try {
    console.log("[Step 4] Loading session and script...");
    const state = await getSession(sessionId);
    const script = readJSON("./output/script.json");
    const toneKey = state.step3?.toneKey || "knowledge";
    console.log("[Step 4] Calling step4FormatVocal — toneKey:", toneKey);
    const result = await step4FormatVocal({ script, toneKey });
    console.log("[Step 4] Saving session...");
    await saveSession(sessionId, { step4: { completed: true } });
    console.log("[Step 4] SUCCESS — formatted length:", result.formattedText?.length);
    res.json({ success: true, formattedText: result.formattedText });
  } catch (err) {
    console.error("[Step 4] ERROR:", err.stack || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Step 5: Generate audio ────────────────────────────────────────────────────
app.post("/api/step/5/generate", async (req, res) => {
  const { jobId, sessionId } = req.body;
  console.log("[Step 5] Route hit — jobId:", jobId, "sessionId:", sessionId);
  res.json({ started: true });
  console.log("[Step 5] Response sent, starting audio generation...");

  try {
    console.log("[Step 5] Entering try block...");
    emit(jobId, "log", { message: "Gemini TTS ဖြင့် အသံဖိုင် ထုတ်နေသည်..." });
    console.log("[Step 5] Loading session...");
    const state = await getSession(sessionId);
    console.log("[Step 5] Calling step5GenerateAudio...");
    const { audioPath } = await step5GenerateAudio({
      voiceKey: state.step2?.voiceKey || "sadaltager",
      speedMultiplier: state.step3?.tone?.speedMultiplier || 1.3,
    });
    console.log("[Step 5] Saving session...");
    await saveSession(sessionId, { step5: { completed: true, audioPath } });
    console.log("[Step 5] SUCCESS — audioPath:", audioPath);
    emit(jobId, "done", { success: true, audioPath });
  } catch (err) {
    console.error("[Step 5] ERROR:", err.stack || err.message);
    emit(jobId, "done", { success: false, error: err.message });
  }
});

// ── Step 6: Sync video ────────────────────────────────────────────────────────
app.post("/api/step/6/sync", async (req, res) => {
  const { jobId, sessionId } = req.body;
  console.log("[Step 6] Route hit — jobId:", jobId, "sessionId:", sessionId);
  res.json({ started: true });
  console.log("[Step 6] Response sent, starting video sync...");

  try {
    console.log("[Step 6] Entering try block...");
    emit(jobId, "log", { message: "ဗီဒီယိုနှင့် အသံ ပေါင်းစပ်နေသည်..." });
    console.log("[Step 6] Loading session...");
    const state = await getSession(sessionId);
    console.log("[Step 6] Calling step6SyncVideo...");
    const { videoDuration, audioDuration, outputPath } = await step6SyncVideo({
      videoPath: "./input/video.mp4",
      audioPath: state.step5?.audioPath || "./output/audio/narration.wav",
    });
    console.log("[Step 6] Saving session...");
    await saveSession(sessionId, { step6: { completed: true, syncedVideoPath: outputPath, videoDuration, audioDuration } });
    console.log("[Step 6] SUCCESS — video:", videoDuration?.toFixed(1) + "s, audio:", audioDuration?.toFixed(1) + "s");
    emit(jobId, "done", { success: true, videoDuration, audioDuration, outputPath });
  } catch (err) {
    console.error("[Step 6] ERROR:", err.stack || err.message);
    emit(jobId, "done", { success: false, error: err.message });
  }
});

// ── Step 7: Subtitles ─────────────────────────────────────────────────────────
app.post("/api/step/7/subtitles", async (req, res) => {
  const { jobId, sessionId } = req.body;
  console.log("[Step 7] Route hit — jobId:", jobId, "sessionId:", sessionId);
  res.json({ started: true });
  console.log("[Step 7] Response sent, starting subtitles...");

  try {
    console.log("[Step 7] Entering try block...");
    emit(jobId, "log", { message: "စာတန်းထိုး ထည့်နေသည်..." });
    console.log("[Step 7] Loading session...");
    const state = await getSession(sessionId);
    console.log("[Step 7] Calling step7AddSubtitles...");
    const result = await step7AddSubtitles({
      videoPath: state.step6?.syncedVideoPath || "./output/video/synced-video.mp4",
      audioPath: state.step5?.audioPath || "./output/audio/narration.wav",
    });
    console.log("[Step 7] Saving session...");
    await saveSession(sessionId, { step7: { completed: true, subtitledVideoPath: result.outputPath, ...result } });
    console.log("[Step 7] SUCCESS — outputPath:", result.outputPath);
    emit(jobId, "done", { success: true, ...result });
  } catch (err) {
    console.error("[Step 7] ERROR:", err.stack || err.message);
    emit(jobId, "done", { success: false, error: err.message });
  }
});

// ── Step 8: Export ────────────────────────────────────────────────────────────
app.post("/api/step/8/export", async (req, res) => {
  const { jobId, resolution, watermark, thumbnailText, sessionId } = req.body;
  console.log("[Step 8] Route hit — jobId:", jobId, "resolution:", resolution, "watermark:", watermark, "thumbnailText:", thumbnailText, "sessionId:", sessionId);
  res.json({ started: true });
  console.log("[Step 8] Response sent, starting export...");

  try {
    console.log("[Step 8] Entering try block...");
    emit(jobId, "log", { message: `${resolution || "1080p"} ဖြင့် Export လုပ်နေသည်...` });
    if (thumbnailText) emit(jobId, "log", { message: `Thumbnail စာသား ထည့်သွင်းနေသည်...` });
    console.log("[Step 8] Loading session...");
    const state = await getSession(sessionId);
    console.log("[Step 8] Calling step8Export — resolution:", resolution || "1080p");
    const { outputPath, fileSize } = await step8Export({
      resolution: resolution || "1080p",
      watermark: watermark || "",
      thumbnailText: thumbnailText || "",
      inputPath: state.step7?.subtitledVideoPath || "./output/video/subtitled-video.mp4",
    });
    console.log("[Step 8] Saving session...");
    await saveSession(sessionId, { step8: { completed: true, exportPath: outputPath, fileSize } });
    console.log("[Step 8] SUCCESS — outputPath:", outputPath, "size:", fileSize);
    emit(jobId, "done", { success: true, outputPath, fileSize });
  } catch (err) {
    console.error("[Step 8] ERROR:", err.stack || err.message);
    emit(jobId, "done", { success: false, error: err.message });
  }
});

// ── Download final video ──────────────────────────────────────────────────────
app.get("/api/download", async (req, res) => {
  const sessionId = req.query.sessionId || "default";
  const state = await getSession(sessionId);
  const filePath = state?.step8?.exportPath;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "No exported video found" });
  }
  res.download(path.resolve(filePath));
});

// ── Catch unhandled errors so server doesn't silently die ─────────────────────
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

// ── Start server ──────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  SMT Recap  → http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error("DB init failed:", err.message);
  process.exit(1);
});
