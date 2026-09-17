/**
 * Step 5: Audio Generation (Text-to-Speech)
 * Two providers, chosen by the user in the UI:
 *   - "gemini"    → Gemini TTS (gemini-2.5-pro-preview-tts), same key as Step 1
 *   - "clipchamp" → Microsoft Edge / Clipchamp neural voices via msedge-tts.
 *                   Same my-MM voices Clipchamp uses, but no API key / account.
 * Falls back to ElevenLabs if only ELEVENLABS_API_KEY is set.
 */

import ora from "ora";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../utils/logger.js";
import { saveState, readJSON, writeBinaryFile, writeFile } from "../utils/file-helper.js";
import { stripPauseMarkersForElevenLabs } from "./step4-vocal-formatter.js";
import { FFMPEG, FFPROBE } from "../utils/bin-paths.js";

// Gemini TTS voice options (closest equivalents to ElevenLabs styles)
const GEMINI_VOICES = {
  sadaltager: { name: "Sadaltager", style: "calm and measured" },    // calm/knowledge
  charon:     { name: "Charon",     style: "deep and authoritative" }, // documentary
  puck:       { name: "Puck",       style: "upbeat and energetic" },   // funny/energetic
  kore:       { name: "Kore",       style: "warm and youthful" },      // youthful
};

// Clipchamp = Microsoft Edge neural voices. Native Myanmar (my-MM) voices,
// reached through msedge-tts (no API key, no account, free).
// Keyed by the same voiceKey the rest of the pipeline uses.
const CLIPCHAMP_VOICES = {
  sadaltager: { name: "my-MM-ThihaNeural", label: "Thiha (male, calm)" },
  charon:     { name: "my-MM-ThihaNeural", label: "Thiha (male, documentary)" },
  puck:       { name: "my-MM-NilarNeural", label: "Nilar (female, energetic)" },
  kore:       { name: "my-MM-NilarNeural", label: "Nilar (female, youthful)" },
};

export async function step5GenerateAudio(options = {}) {
  const provider = (options.provider || "gemini").toLowerCase();
  logger.step(5, `Generating audio with ${provider === "clipchamp" ? "Clipchamp (Edge neural voice)" : "Gemini TTS"}...`);

  const geminiKey = process.env.GEMINI_API_KEY;
  const elevenKey = process.env.ELEVENLABS_API_KEY;

  // "clipchamp" needs no key. Only bail if nothing at all is usable.
  if (provider !== "clipchamp" && !geminiKey && !elevenKey) {
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

  let result;
  if (provider === "clipchamp") {
    result = await generateWithClipchamp(cleanText, voiceKey, speedMultiplier);
  } else if (geminiKey) {
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

    const ttsModel = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
    const model = genAI.getGenerativeModel({ model: ttsModel });

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

// "Clipchamp" voice option. Two engines, auto-selected:
//   - AZURE_SPEECH_KEY set  → real Azure Speech REST API (full catalog, incl.
//                             it-IT-AlessioMultilingualNeural)
//   - otherwise             → free Microsoft Edge voices via msedge-tts
// Voice order: CLIPCHAMP_VOICE env → per-style my-MM default.
// Multilingual voices read Burmese via CLIPCHAMP_LANG (default my-MM) forced
// in SSML. Speed is baked in via SSML <prosody rate>.
async function generateWithClipchamp(text, voiceKey, speedMultiplier) {
  const spinner = ora("Generating Clipchamp voice...").start();

  try {
    const styleDefault = (CLIPCHAMP_VOICES[voiceKey] || CLIPCHAMP_VOICES.sadaltager).name;
    const voiceName = (process.env.CLIPCHAMP_VOICE || styleDefault).trim();
    const lang = (process.env.CLIPCHAMP_LANG || "my-MM").trim();

    // speedMultiplier 1.3 → rate "+30%", 0.9 → rate "-10%"
    const ratePct = Math.round((speedMultiplier - 1) * 100);
    const rate = `${ratePct >= 0 ? "+" : ""}${ratePct}%`;

    const azureKey    = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION;
    const useAzure    = Boolean(azureKey && azureRegion);

    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
      `<voice name="${voiceName}"><prosody rate="${rate}">${esc(text)}</prosody></voice>` +
      `</speak>`;

    logger.info(`Voice: ${voiceName} @ ${lang} (${useAzure ? "Azure Speech" : "Edge"})`);
    logger.info(`Target speed: ${speedMultiplier}x (SSML rate ${rate})`);

    let rawBuffer, rawExt;

    if (useAzure) {
      const { default: fetch } = await import("node-fetch");
      const res = await fetch(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": azureKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
          "User-Agent": "smt-recap",
        },
        body: ssml,
      });
      if (!res.ok) throw new Error(`Azure Speech error ${res.status}: ${await res.text()}`);
      rawBuffer = Buffer.from(await res.arrayBuffer());
      rawExt = "wav";
    } else {
      const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
      const tts = new MsEdgeTTS();

      const available = (await tts.getVoices()).map((v) => v.ShortName);
      if (!available.includes(voiceName)) {
        const myMM = available.filter((v) => v.startsWith("my-MM"));
        const multi = available.filter((v) => /Multilingual/.test(v)).slice(0, 6);
        throw new Error(
          `Voice "${voiceName}" isn't on the free Edge route. ` +
          `Set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in .env to use the full Azure catalog ` +
          `(e.g. it-IT-AlessioMultilingualNeural), or pick a free one via CLIPCHAMP_VOICE: ` +
          `${[...myMM, ...multi].join(", ")}`
        );
      }

      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      // rawToStream keeps our xml:lang so multilingual voices speak Burmese
      const { audioStream } = await tts.rawToStream(ssml);
      const chunks = [];
      await new Promise((resolve, reject) => {
        audioStream.on("data", (c) => chunks.push(c));
        audioStream.on("end", resolve);
        audioStream.on("error", reject);
      });
      rawBuffer = Buffer.concat(chunks);
      rawExt = "mp3";
    }
    if (!rawBuffer?.length) throw new Error("No audio returned from Clipchamp voice");

    // Normalise to WAV so every downstream step stays unchanged
    const rawPath    = `./output/audio/narration_raw.${rawExt}`;
    const outputPath = "./output/audio/narration.wav";
    writeBinaryFile(rawPath, rawBuffer);

    const { execFileSync } = await import("child_process");
    execFileSync(FFMPEG, ["-i", rawPath, "-ar", "24000", "-ac", "1", "-y", outputPath], { stdio: "pipe" });

    const { readFileSync } = await import("fs");
    const audioBuffer = readFileSync(outputPath);

    spinner.succeed("Clipchamp voice audio generated!");

    writeFile("./output/audio/narration-meta.json", JSON.stringify({
      provider: "clipchamp", engine: useAzure ? "azure-speech" : "edge-tts",
      voiceName, speedMultiplier,
      textLength: text.length, fileSizeMB: (audioBuffer.length / (1024 * 1024)).toFixed(2),
      generatedAt: new Date().toISOString(),
    }, null, 2));

    saveState({ step5: { completed: true, audioPath: outputPath, provider: "clipchamp" } });
    logger.success(`Audio saved → ${outputPath}`);
    logger.info(`File size: ${(audioBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

    return { audioPath: outputPath, buffer: audioBuffer };
  } catch (err) {
    spinner.fail("Clipchamp voice failed");
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
