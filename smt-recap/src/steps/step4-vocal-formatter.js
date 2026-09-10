/**
 * Step 4: Vocal Formatting & Pausing (The Style)
 * Adds pause markers and emphasis to prevent robotic-sounding audio
 * Formats text for natural Myanmar speech patterns
 */

import { TONES, PAUSE_MARKERS } from "../config/voices.js";
import { logger } from "../utils/logger.js";
import { saveState, writeFile, readJSON } from "../utils/file-helper.js";

// Myanmar sentence ending characters
const MYANMAR_ENDINGS = ["။", "၊", "?", "!", "..."];

// Words that should have emphasis (common Myanmar important words)
const EMPHASIS_TRIGGERS = [
  "အရေးကြီး", "သတိပြု", "မှတ်သား", "ထူးခြား", "အဓိက",
  "ကြည့်ပါ", "နားထောင်ပါ", "မမေ့နှင့်", "ဂရုစိုက်", "အချက်",
];

export async function step4FormatVocal(options = {}) {
  logger.step(4, "Formatting script for natural speech...");

  // Load script from state or options
  let script;
  if (options.script) {
    script = options.script;
  } else {
    const saved = readJSON("./output/script.json");
    if (!saved) throw new Error("No script found. Run Step 1 first.");
    script = saved;
  }

  const toneKey = options.toneKey || "knowledge";
  const tone = TONES[toneKey] || TONES.knowledge;

  const formattedText = formatScript(script.fullScript, tone);
  const formattedSections = script.sections?.map((section) => ({
    ...section,
    formattedText: formatScript(section.text, tone),
  }));

  const outputData = {
    ...script,
    formattedText,
    formattedSections,
    tone: toneKey,
    formattedAt: new Date().toISOString(),
  };

  const outputPath = "./output/script-formatted.json";
  const ttsTextPath = "./output/tts-input.txt";

  writeFile(outputPath, JSON.stringify(outputData, null, 2));
  writeFile(ttsTextPath, formattedText);

  saveState({ step4: { completed: true, formattedScriptPath: outputPath } });

  logger.success(`Formatted script saved → ${outputPath}`);
  logger.info(`TTS input saved → ${ttsTextPath}`);
  logger.script(formattedText);

  return outputData;
}

function formatScript(text, tone) {
  if (!text) return "";

  let formatted = text;

  // Step 0: Micro-pauses after numbers (timestamps, statistics) — done FIRST,
  // before any [pauseN] markers exist, so the digit inside a marker like
  // [pause3] never gets an "..." appended (which broke the TTS marker stripper).
  formatted = formatted.replace(/(\d+(?:\.\d+)?)/g, "$1...");

  // Step 1: Add pauses after Myanmar sentence endings
  const pauseAfterPeriod = getPauseDuration(tone.pauseDuration, "after_period");
  const pauseAfterComma = getPauseDuration(tone.pauseDuration, "after_comma");

  // Add pause after full stop (။)
  formatted = formatted.replace(/။\s*/g, `။${pauseAfterPeriod} `);

  // Add shorter pause after comma (၊)
  formatted = formatted.replace(/၊\s*/g, `၊${pauseAfterComma} `);

  // Step 2: Add emphasis markers for important words
  EMPHASIS_TRIGGERS.forEach((word) => {
    if (formatted.includes(word)) {
      // Bold/uppercase equivalent in TTS = repeat the word with stress marker
      formatted = formatted.replace(
        new RegExp(word, "g"),
        `${word}${PAUSE_MARKERS.micro}`
      );
    }
  });

  // Step 4: Add breath pause before key section transitions
  if (tone.emphasisStyle === "dramatic") {
    formatted = formatted.replace(/\.\s+([က-အ])/g, (match, char) => {
      return `. [pause3] ${char}`;
    });
  }

  // Step 5: Slow down ending for documentary tone
  if (tone.style === "documentary") {
    const lastSentenceMatch = formatted.match(/(.*)([\u1000-\u109F\u200C-\u200D]+[^\u1000-\u109F\u200C-\u200D]*)$/s);
    if (lastSentenceMatch) {
      // Mark final sentence for slower delivery
      const lastPart = lastSentenceMatch[2];
      formatted = formatted.replace(lastPart, `[slow]${lastPart}[/slow]`);
    }
  }

  // Step 6: Clean up double spaces and normalize
  formatted = formatted.replace(/\s{2,}/g, " ").trim();

  return formatted;
}

function getPauseDuration(pauseType, position) {
  const pauseMap = {
    long: {
      after_period: " [pause3]",
      after_comma: " [pause2]",
    },
    medium: {
      after_period: " [pause2]",
      after_comma: " [pause]",
    },
    short: {
      after_period: " [pause]",
      after_comma: "...",
    },
    very_long: {
      after_period: " [pause3] [pause3]",
      after_comma: " [pause3]",
    },
  };

  return (pauseMap[pauseType] || pauseMap.medium)[position];
}

// Strip formatting markers so the TTS engine never speaks them aloud.
// (Gemini / Azure read a comma as a short pause.) Tolerant of corrupted
// markers like "[pause3...]" and any stray "[tag]" left in the text.
export function stripPauseMarkersForElevenLabs(text) {
  return text
    // [pause], [pause2], [pause3], and corrupted forms like [pause3...] → comma
    .replace(/\[\s*pause[0-9]*[^\]]*\]/gi, " , ")
    // [slow] / [/slow] style tags → nothing
    .replace(/\[\s*\/?\s*slow\s*\]/gi, " ")
    // any other short leftover [bracket tag] → space
    .replace(/\[[^\]\n]{0,40}\]/g, " ")
    // ellipsis (micro-pause) → comma
    .replace(/\.{2,}/g, " , ")
    // tidy: collapse runs of commas and spaces
    .replace(/(?:\s*,\s*){2,}/g, " , ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
