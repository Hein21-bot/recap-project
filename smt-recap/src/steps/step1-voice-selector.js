/**
 * Step 2: Choose AI Voice (User Identity / Brand Voice)
 * Selects ElevenLabs voice character for the video
 */

import inquirer from "inquirer";
import { VOICES } from "../config/voices.js";
import { logger } from "../utils/logger.js";
import { saveState, readState } from "../utils/file-helper.js";

export async function step2SelectVoice(options = {}) {
  logger.step(2, "Selecting AI Voice character...");

  // If voice already specified, use it directly
  if (options.voiceId) {
    const voice = Object.values(VOICES).find((v) => v.id === options.voiceId) || {
      id: options.voiceId,
      name: options.voiceName || "Custom Voice",
      settings: VOICES.sadaltager.settings,
    };
    logger.success(`Using voice: ${voice.name} (${voice.id})`);
    saveState({ step2: { completed: true, voice } });
    return voice;
  }

  if (options.voiceKey && VOICES[options.voiceKey]) {
    const voice = VOICES[options.voiceKey];
    logger.success(`Using voice: ${voice.name}`);
    saveState({ step2: { completed: true, voice, voiceKey: options.voiceKey } });
    return voice;
  }

  // In web server context, no valid voiceKey was provided — use default
  const voiceKey = "sadaltager";
  const voice = VOICES[voiceKey];
  logger.success(`Selected: ${voice.name}`);
  logger.info(`Voice ID: ${voice.id}`);

  saveState({ step2: { completed: true, voice, voiceKey } });
  return voice;
}

export async function listAvailableVoices(apiKey) {
  // Fetch available voices from ElevenLabs
  const { default: fetch } = await import("node-fetch");

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const data = await response.json();
    return data.voices || [];
  } catch (err) {
    logger.warn("Could not fetch voices from ElevenLabs, using defaults");
    return Object.values(VOICES);
  }
}
