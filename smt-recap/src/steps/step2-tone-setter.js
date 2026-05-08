/**
 * Step 3: Choose Feeling & Tone (Mood Setting)
 * Sets the emotional tone and pacing for the video
 */

import inquirer from "inquirer";
import { TONES } from "../config/voices.js";
import { logger } from "../utils/logger.js";
import { saveState } from "../utils/file-helper.js";

export async function step3SetTone(options = {}) {
  logger.step(3, "Setting mood and tone...");

  if (options.tone && TONES[options.tone]) {
    const tone = TONES[options.tone];
    logger.success(`Tone set: ${tone.name}`);
    saveState({ step3: { completed: true, tone, toneKey: options.tone } });
    return { tone, toneKey: options.tone };
  }

  // Interactive selection
  const choices = Object.entries(TONES).map(([key, t]) => ({
    name: `${t.name} — ${t.description}`,
    value: key,
  }));

  const { toneKey } = await inquirer.prompt([
    {
      type: "list",
      name: "toneKey",
      message: "ဗီဒီယိုရဲ့ Feeling/Tone ကို ရွေးချယ်ပါ:",
      choices,
      default: "knowledge",
    },
  ]);

  const tone = TONES[toneKey];

  logger.success(`Tone selected: ${tone.name}`);
  logger.info(`Speed: ${tone.speedMultiplier}x | Pauses: ${tone.pauseDuration} | Emphasis: ${tone.emphasisStyle}`);
  logger.info(`Recommended Voice: ${tone.voiceRecommendation}`);

  saveState({ step3: { completed: true, tone, toneKey } });
  return { tone, toneKey };
}
