/**
 * Step 5: Audio Generation (Text-to-Speech)
 * Uses Gemini TTS (gemini-2.5-flash-preview-tts) — same API key as Step 1
 * Falls back to ElevenLabs if ELEVENLABS_API_KEY is set
 */

import ora from "ora";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../utils/logger.js";
import { saveState, readJSON, writeBinaryFile, writeFile } from "../utils/file-helper.js";
import { stripPauseMarkersForElevenLabs } from "./step4-vocal-formatter.js";

// Gemini TTS voice options (closest equivalents to ElevenLabs styles)
const GEMINI_VOICES = {
  sadaltager: { name: "Sadaltager", style: "calm and measured" },    // calm/knowledge
  charon:     { name: "Charon",     style: "deep and authoritative" }, // documentary
  puck:       { name: "Puck",       style: "upbeat and energetic" },   // funny/energetic
  kore:       { name: "Kore",       style: "warm and youthful" },      // youthful
};

export async function step5GenerateAudio(options = {}) {
  logger.step(5, "Generating audio with Gemini TTS...");

  const geminiKey = process.env.GEMINI_API_KEY;
  const elevenKey  = process.env.ELEVENLABS_API_KEY;

  if (!geminiKey && !elevenKey) {
    throw new Error("No API key found. Set GEMINI_API_KEY in .env");
  }

  // Load formatted script
  let scriptText = options.text;
  if (!scriptText) {
    const formatted = readJSON("./output/script-formatted.json");
    scriptText = formatted?.formattedText
      || readJSON("./output/script.json")?.fullScript;
    if (!scriptText) throw new Error("No script found. Run Steps 1-4 first.");
  }

  const state = readJSON("./output/pipeline-state.json") || {};
  const tone  = state.step3?.tone;
  const speedMultiplier = options.speedMultiplier || tone?.speedMultiplier || 1.3;
  const voiceKey = options.voiceKey || state.step2?.voiceKey || state.step2?.voice?.style || "sadaltager";

  const cleanText = stripPauseMarkersForElevenLabs(scriptText);
  logger.info(`Text length: ${cleanText.length} characters`);

  // Prefer Gemini (same key, free quota); fall back to ElevenLabs
  let result;
  if (geminiKey) {
    result = await generateWithGemini(cleanText, voiceKey, speedMultiplier, geminiKey);
  } else {
    result = await generateWithElevenLabs(cleanText, state, speedMultiplier, elevenKey);
  }

  // Run forced alignment to get per-sentence timestamps for perfect subtitle sync
  await runForcedAlignment(result.audioPath, cleanText);

  return result;
}

async function generateWithGemini(text, voiceKey, speedMultiplier, apiKey) {
  const spinner = ora("Calling Gemini TTS API...").start();

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const voice = GEMINI_VOICES[voiceKey] || GEMINI_VOICES.sadaltager;

    logger.info(`Voice: ${voice.name} (Gemini TTS)`);
    logger.info(`Target speed: ${speedMultiplier}x`);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-tts" });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.name } },
        },
      },
    });

    const audioPart = response.response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.mimeType?.startsWith("audio/")
    );
    if (!audioPart) throw new Error("No audio returned from Gemini TTS");

    const mimeType  = audioPart.inlineData.mimeType;
    const rawBuffer = Buffer.from(audioPart.inlineData.data, "base64");

    let audioBuffer;
    if (mimeType.includes("pcm") || !mimeType.includes("wav")) {
      const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || "24000");
      audioBuffer = pcmToWav(rawBuffer, sampleRate, 1, 16);
    } else {
      audioBuffer = rawBuffer;
    }

    const rawPath    = "./output/audio/narration_raw.wav";
    const outputPath = "./output/audio/narration.wav";
    writeBinaryFile(rawPath, audioBuffer);

    const { execFileSync } = await import("child_process");
    const FFMPEG = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg";

    if (speedMultiplier && speedMultiplier !== 1.0) {
      execFileSync(FFMPEG, ["-i", rawPath, "-filter:a", `atempo=${speedMultiplier}`, "-y", outputPath], { stdio: "pipe" });
      logger.info(`Audio sped up to ${speedMultiplier}x`);
    } else {
      execFileSync(FFMPEG, ["-i", rawPath, "-y", outputPath], { stdio: "pipe" });
    }

    spinner.succeed("Gemini TTS audio generated!");

    writeFile("./output/audio/narration-meta.json", JSON.stringify({
      provider: "gemini", voiceName: voice.name, speedMultiplier,
      textLength: text.length, fileSizeMB: (audioBuffer.length / (1024 * 1024)).toFixed(2),
      generatedAt: new Date().toISOString(),
    }, null, 2));

    saveState({ step5: { completed: true, audioPath: outputPath, provider: "gemini" } });
    logger.success(`Audio saved → ${outputPath}`);
    logger.info(`File size: ${(audioBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

    return { audioPath: outputPath, buffer: audioBuffer };
  } catch (err) {
    spinner.fail("Gemini TTS failed");
    throw err;
  }
}

async function generateWithElevenLabs(text, state, speedMultiplier, apiKey) {
  const { default: fetch } = await import("node-fetch");
  const { VOICES } = await import("../config/voices.js");

  const voice   = state.step2?.voice || VOICES.sadaltager;
  const spinner = ora("Calling ElevenLabs API (fallback)...").start();

  logger.info(`Voice: ${voice.name} (ElevenLabs fallback)`);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: voice.settings?.stability ?? 0.75,
          similarity_boost: voice.settings?.similarity_boost ?? 0.85,
          style: voice.settings?.style ?? 0.2,
          use_speaker_boost: voice.settings?.use_speaker_boost ?? true,
          speed: speedMultiplier,
        },
      }),
    }
  );

  if (!response.ok) {
    spinner.fail("ElevenLabs fallback failed");
    throw new Error(`ElevenLabs error ${response.status}: ${await response.text()}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const outputPath  = "./output/audio/narration.mp3";

  writeBinaryFile(outputPath, audioBuffer);
  spinner.succeed("ElevenLabs audio generated!");

  saveState({ step5: { completed: true, audioPath: outputPath, provider: "elevenlabs" } });
  logger.success(`Audio saved → ${outputPath}`);

  return { audioPath: outputPath, buffer: audioBuffer };
}

// Check audio duration using ffprobe
export async function getAudioDuration(audioPath) {
  const { execSync } = await import("child_process");
  try {
    const FFPROBE = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffprobe";
    const output = execSync(
      `${FFPROBE} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { encoding: "utf-8", timeout: 10000 }
    );
    const val = parseFloat(output.trim());
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
}

// Run forced alignment: audio + script → per-sentence timestamps
async function runForcedAlignment(audioPath, scriptText) {
  const spinner = ora("Running forced alignment for perfect subtitle sync...").start();
  try {
    const { execFileSync } = await import("child_process");
    const { mkdirSync } = await import("fs");
    const os   = await import("os");
    const path = await import("path");

    mkdirSync("./output/audio", { recursive: true });

    // Write script to temp file
    const tmpDir      = path.join(os.tmpdir(), "smt-align");
    mkdirSync(tmpDir, { recursive: true });
    const scriptFile  = path.join(tmpDir, "script.txt");
    const outputJson  = "./output/sentence-durations.json";

    // Clean script — remove pause markers, keep sentence structure
    const cleanScript = scriptText
      .replace(/\[pause[^\]]*\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Split into sentences for alignment
    const sentences = cleanScript
      .split(/(?<=[၊။])\s*/)
      .map(s => s.trim())
      .filter(Boolean);

    // Write sentences one per line for alignment
    const { writeFileSync } = await import("fs");
    writeFileSync(scriptFile, sentences.join("\n"), "utf8");

    // Run Python forced alignment script
    const pyScript = path.join(path.dirname(new URL(import.meta.url).pathname), "../utils/forced_align.py");

    const result = execFileSync("python3", [
      pyScript,
      "--audio", audioPath,
      "--transcript", scriptFile,
      "--output", outputJson,
    ], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });

    spinner.succeed("Forced alignment complete → sentence-durations.json");
    logger.info(result.trim());
  } catch (err) {
    spinner.warn(`Forced alignment failed (subtitle sync will be approximate): ${err.message}`);
    // Non-fatal — Step 7 will fall back to syllable-based timing
  }
}

// Build a WAV file from raw PCM bytes
function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const dataLen    = pcmBuffer.length;
  const header     = Buffer.alloc(44);
  const byteRate   = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);

  header.write("RIFF",         0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write("WAVE",         8);
  header.write("fmt ",         12);
  header.writeUInt32LE(16,     16); // PCM chunk size
  header.writeUInt16LE(1,      20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate,   28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth,   34);
  header.write("data",         36);
  header.writeUInt32LE(dataLen, 40);

  return Buffer.concat([header, pcmBuffer]);
}
