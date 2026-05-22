/**
 * Step 1: Content Analysis & Script Generation
 * Uses Gemini API to analyze video and generate Myanmar storytelling script
 * Word count scales with video duration: ~180-200 words per minute
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import ora from "ora";
import { logger } from "../utils/logger.js";
import { saveState, writeFile } from "../utils/file-helper.js";

const FFPROBE = "/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffprobe";

function getVideoDurationSeconds(videoPath) {
  try {
    const out = execFileSync(FFPROBE, [
      "-v", "quiet", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1", videoPath,
    ], { encoding: "utf8" });
    return parseFloat(out.split("=")[1]) || null;
  } catch (_) {
    return null;
  }
}

const TONE_INSTRUCTIONS = {
  knowledge: {
    label: "Knowledge Sharing",
    style: "တည်ငြိမ်ပြီး အသိပညာမျှဝေသော စတိုင် — ရှင်းလင်းတိကျသော ဘာသာစကား၊ အချက်အလက်အပေါ် အာရုံစိုက်ပါ",
  },
  funny: {
    label: "Funny / Entertainment",
    style: "ဖျော်ဖြေသော မြင့်မားသောသံတမ်း — ရှုပ်ထွေးမှုနှင့် ပျော်ရွှင်မှု၊ Punchline များ ထည့်သွင်းပါ",
  },
  documentary: {
    label: "Documentary / Sad",
    style: "နက်ရှိုင်းသော Emotional Documentary စတိုင် — ဆင်ဆင်ခြင်ခြင် ဖော်ပြပြီး Dramatic pause ကောင်းအောင် ရေးပါ",
  },
  educational: {
    label: "Educational",
    style: "ပညာသင် Explainer စတိုင် — အဆင့်ဆင့် ရှင်းပြပြီး ရိုးရိုးရှင်းရှင်း ဘာသာစကား သုံးပါ",
  },
};

function buildVideoPrompt(durationSeconds, toneKey = "knowledge", speedMultiplier = 1.0) {
  const minutes = durationSeconds ? durationSeconds / 60 : 1;
  // Adjust word count for speed: faster voice (>1x) needs more words to fill same duration
  const minWords = Math.round(180 * minutes * speedMultiplier);
  const maxWords = Math.round(200 * minutes * speedMultiplier);
  const durationLabel = durationSeconds
    ? `${Math.floor(minutes)}:${String(Math.round((minutes % 1) * 60)).padStart(2, "0")} မိနစ်`
    : "အချိန်မသတ်မှတ်ရသေး";
  const tone = TONE_INSTRUCTIONS[toneKey] || TONE_INSTRUCTIONS.knowledge;

  return `
သင်သည် မြန်မာဘာသာဖြင့် ဗီဒီယိုအတွက် Script ရေးသားသူ ကျွမ်းကျင်သူတစ်ဦးဖြစ်သည်။

ဤဗီဒီယိုကို ကြည့်ပြီး အောက်ပါ လိုအပ်ချက်များအတိုင်း Script ရေးပေးပါ:

**ဗီဒီယိုအချိန်: ${durationLabel}**
**Tone / Style: ${tone.label}**
${tone.style}

**လိုအပ်ချက်များ:**
1. မြန်မာစာလုံးရေ ${minWords} မှ ${maxWords} အတွင်းသာ ရှိရမည် (အသံဖတ်နှုန်း ${speedMultiplier}x ကိုထည့်တွက်ပြီး ဗီဒီယိုအချိန်နှင့် ကိုက်ညီစေရမည်)
2. အထက်ဖော်ပြပါ Tone ကို ကြည့်ပြီး ထိုသင့်လျောသော ရေးဟန်ဖြင့် ရေးရမည်
3. Storytelling စတိုင်ဖြင့် ရေးရမည် - နိဒါန်း၊ အဓိကအကြောင်းအရာ၊ နိဂုံး
4. Timestamp ပါ ထည့်ပေးပါ (ဗီဒီယိုအချိန်နှင့် ကိုက်ညီအောင်)
5. ဗီဒီယိုရဲ့ အဓိက Message ကို ပြတ်သားစွာ ဖော်ပြပါ
6. ကြည့်ရှုသူ စိတ်ဝင်စားအောင် ဆွဲဆောင်မှုရှိသော ဘာသာစကား သုံးပါ
7. မြန်မာလူမျိုးတွေနားလည်ပြီး စိတ်ဝင်စားစရာကောင်းအောင် ဘာသာပြန်ပေးပါ

**Output Format:**
\`\`\`
[SCRIPT]
[00:00-00:XX] (နိဒါန်း)
...script text...

[00:XX-00:XX] (အဓိကအကြောင်းအရာ)
...script text...

[00:XX-END] (နိဂုံး)
...script text...

[WORD_COUNT: xxx]
[SUMMARY: တစ်ကြောင်းချုပ်]
\`\`\`

မြန်မာဘာသာဖြင့်သာ ရေးပါ။ English မသုံးပါနှင့်။ ဗီဒီယိုအကြောင်းအရာနှင့် သက်ဆိုင်သောအချက်များကိုသာ ဖော်ပြပါ။
`;
}

// function buildTextPrompt(content, toneKey = "knowledge", speedMultiplier = 1.0, videoDurationSeconds = null) {
//   const tone = TONE_INSTRUCTIONS[toneKey] || TONE_INSTRUCTIONS.knowledge;

//   let baseMinutes;
//   if (videoDurationSeconds) {
//     baseMinutes = videoDurationSeconds / 60;
//   } else {
//     const words = content.split(/\s+/).filter(Boolean).length;
//     baseMinutes = Math.max(0.5, words / 150);
//   }

//   // ±30% buffer so all content can be covered without skipping
//   const minWords = Math.round(180 * baseMinutes * speedMultiplier * 0.9);
//   const maxWords = Math.round(200 * baseMinutes * speedMultiplier * 1.3);
//   const durationLabel = `${Math.floor(baseMinutes)}:${String(Math.round((baseMinutes % 1) * 60)).padStart(2, "0")} မိနစ်`;

//   return `
// သင်သည် မြန်မာဘာသာဖြင့် ဗီဒီယိုအတွက် Script ရေးသားသူ ကျွမ်းကျင်သူတစ်ဦးဖြစ်သည်။

// အောက်ပါ YouTube Transcript ကို မြန်မာဘာသာ Script အဖြစ် ပြန်ရေးပေးပါ:

// **Input Content (YouTube Transcript):**
// ${content}

// **ဗီဒီယိုအချိန်: ${durationLabel}**
// **Tone / Style: ${tone.label}**
// ${tone.style}

// **လိုအပ်ချက်များ:**
// 1. မြန်မာစာလုံးရေ ${minWords} မှ ${maxWords} အတွင်းသာ ရှိရမည် (အသံဖတ်နှုန်း ${speedMultiplier}x ကိုထည့်တွက်ပြီး ဗီဒီယိုအချိန်နှင့် ကိုက်ညီစေရမည်)
// 2. Transcript ထဲရှိ **အကြောင်းအရာများကိုသာ ပြန်ရေးပါ** — transcript မှာ မပါတဲ့ နိဒါန်း၊ hook၊ extra introduction တွေ ထပ်မထည့်ပါနှင့်
// 3. Transcript မှာ intro ပါရင်သာ ထည့်ပါ၊ မပါရင် content ကနေ တိုက်ရိုက် စပါ
// 4. Transcript ထဲရှိ **အဓိကအချက်များအားလုံး ပါဝင်ရမည်** — content skip မလုပ်ပဲ condense လုပ်ပါ
// 5. အထက်ဖော်ပြပါ Tone ကို သုံးပြီး ရေးပါ
// 6. Timestamp ပါ ထည့်ပေးပါ
// 7. ကြည့်ရှုသူ စိတ်ဝင်စားအောင် ဆွဲဆောင်မှုရှိသော ဘာသာစကား သုံးပါ

// **Output Format:**
// \`\`\`
// [SCRIPT]
// [00:00-00:XX] (section label)
// ...script text...

// [00:XX-END] (section label)
// ...script text...

// [WORD_COUNT: xxx]
// [SUMMARY: တစ်ကြောင်းချုပ်]
// \`\`\`

// မြန်မာဘာသာဖြင့်သာ ရေးပါ။ English မသုံးပါနှင့်။
// `;
// }

function buildTextPrompt(content, toneKey = "storytelling", speedMultiplier = 1.0, videoDurationSeconds = null) {
  const tone = TONE_INSTRUCTIONS[toneKey] || TONE_INSTRUCTIONS.knowledge;

  let durationSeconds;
  if (videoDurationSeconds) {
    durationSeconds = videoDurationSeconds;
  } else {
    const chars = content.replace(/\s+/g, '').length;
    durationSeconds = Math.max(30, chars / 10);
  }

  // Myanmar TTS: ~10 chars/sec at 1.0x, multiply by speedMultiplier
  const targetChars = Math.round(durationSeconds * 10 * speedMultiplier);
  const minChars = Math.round(targetChars * 0.85);
  const maxChars = Math.round(targetChars * 1.15);
  const baseMinutes = durationSeconds / 60;
  const durationLabel = `${Math.floor(baseMinutes)}:${String(Math.round((baseMinutes % 1) * 60)).padStart(2, "0")} မိနစ်`;

  return `
သင်သည် မြန်မာ TikTok/Social Media Script ရေးသားသူ ကျွမ်းကျင်သူတစ်ဦးဖြစ်သည်။

**Input Content (YouTube Transcript):**
${content}

**ဗီဒီယိုအချိန်: ${durationLabel}**
**Tone / Style: ${tone.label}**
${tone.style}

**လိုအပ်ချက်များ:**
1. Storytelling Arc: အကြောင်းအရာကို အပိုင်း ၃ ပိုင်း ခွဲရေးပါ (၁. Hook/အစ၊ ၂. Process/အလယ်၊ ၃. Unexpected Reveal/အဆုံး)။
2. မြန်မာစာလုံးအရေအတွက် (space မပါ) ${minChars} မှ ${maxChars} အကြားဖြစ်ရမည် — ဗီဒီယို ${durationLabel} အချိန်နှင့် ကိုက်ညီအောင် ရေးပါ။
3. Natural Flow: စာဖတ်သလို မဟုတ်ဘဲ လူတစ်ယောက်က စိတ်ဝင်တစား ပြန်ပြောပြနေသလို ရေးပါ။
4. Transcript ထဲရှိ အဓိကအချက်များအားလုံး ပါဝင်ရမည် — skip မလုပ်ပဲ condense လုပ်ပါ။
5. အထက်ဖော်ပြပါ Tone ကို သုံးပြီး ရေးပါ။
6. Timestamp ပါ ထည့်ပေးပါ။
7. မြန်မာလူမျိုးတွေနားလည်ပြီး စိတ်ဝင်စားစရာကောင်းအောင် ဘာသာပြန်ပေးပါ

**Output Format:**
\`\`\`
[SCRIPT]
[00:00-00:XX] (Visual Hook - ဆွဲဆောင်မှုရှိသော အစ)
...script text...

[00:XX-00:XX] (Concept Build-up - အသေးစိတ် ရှင်းလင်းချက်)
...script text...

[00:XX-END] (Mind-blowing Reveal - အံ့သြဖွယ် အဆုံးသတ်)
...script text...

[WORD_COUNT: xxx]
[SUMMARY: ရင်သပ်ရှုမောဖွယ် တစ်ကြောင်းချုပ်]
\`\`\`

မြန်မာဘာသာဖြင့်သာ ရေးပါ။ English မသုံးပါနှင့်။
`;
}

// Available models for this API key
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

async function callGeminiWithRetry(genAI, buildPrompt, spinner, maxRetries = 3) {
  for (const modelName of MODELS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        spinner.text = `Using ${modelName} (attempt ${attempt})...`;
        const model = genAI.getGenerativeModel({ model: modelName });
        const response = await model.generateContent(buildPrompt());
        spinner.text = "Processing response...";
        return response.response.text();
      } catch (err) {
        const is429 = err.message?.includes("429") || err.message?.includes("quota");
        const retryMatch = err.message?.match(/retry[^0-9]*(\d+)s/i);
        const waitSec = retryMatch ? parseInt(retryMatch[1]) + 2 : 15;

        if (is429 && attempt < maxRetries) {
          spinner.text = `Rate limited on ${modelName}. Waiting ${waitSec}s...`;
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          continue;
        }
        if (is429) break; // exhausted retries for this model → try next
        throw err;        // non-quota error → rethrow immediately
      }
    }
  }
  throw new Error(
    "All Gemini models quota exhausted.\n" +
    "→ Enable billing at https://aistudio.google.com or wait for quota reset."
  );
}

export async function step1GenerateScript(options = {}) {
  logger.step(1, "Starting script generation...");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not found in .env file");

  const genAI = new GoogleGenerativeAI(apiKey);
  const spinner = ora("Connecting to Gemini API...").start();

  try {
    let result;

    if (options.videoPath && fs.existsSync(options.videoPath)) {
      spinner.text = "Reading video file...";
      const videoData = fs.readFileSync(options.videoPath);
      const base64Video = videoData.toString("base64");
      const mimeType = getMimeType(options.videoPath);

      const durationSec = getVideoDurationSeconds(options.videoPath);
      const speedMultiplier = options.speedMultiplier || 1.0;
      if (durationSec) {
        const adjMin = Math.round(180 * (durationSec / 60) * speedMultiplier);
        const adjMax = Math.round(200 * (durationSec / 60) * speedMultiplier);
        logger.info(`Video duration: ${(durationSec / 60).toFixed(1)} min | speed: ${speedMultiplier}x → targeting ${adjMin}–${adjMax} words`);
      }
      const scriptPrompt = buildVideoPrompt(durationSec, options.toneKey, speedMultiplier);

      result = await callGeminiWithRetry(
        genAI,
        () => [{ inlineData: { data: base64Video, mimeType } }, scriptPrompt],
        spinner
      );
    } else if (options.textContent) {
      const prompt = buildTextPrompt(options.textContent, options.toneKey, options.speedMultiplier, options.videoDurationSeconds);
      result = await callGeminiWithRetry(
        genAI,
        () => prompt,
        spinner
      );
    } else {
      throw new Error("Provide either videoPath or textContent");
    }

    spinner.succeed("Script generated successfully!");

    // Parse and save the script
    const parsed = parseScript(result);
    const outputPath = "./output/script.json";
    const rawScriptPath = "./output/script-raw.txt";

    saveState({ step1: { completed: true, scriptPath: outputPath } });
    writeFile(outputPath, JSON.stringify(parsed, null, 2));
    writeFile(rawScriptPath, result);

    logger.success(`Script saved → ${outputPath}`);
    logger.info(`Word count: ${parsed.wordCount}`);
    logger.info(`Summary: ${parsed.summary}`);
    logger.script(parsed.fullScript);

    return parsed;
  } catch (err) {
    spinner.fail("Script generation failed");
    throw err;
  }
}

function parseScript(rawText) {
  const lines = rawText.split("\n");
  const sections = [];
  let currentSection = null;
  let fullScript = "";
  let wordCount = 0;
  let summary = "";

  for (const line of lines) {
    const timestampMatch = line.match(/\[(\d{2}:\d{2})-(\d{2}:\d{2}|END)\]\s*\((.+?)\)/);
    const wordCountMatch = line.match(/\[WORD_COUNT:\s*(\d+)\]/);
    const summaryMatch = line.match(/\[SUMMARY:\s*(.+)\]/);

    if (timestampMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        start: timestampMatch[1],
        end: timestampMatch[2],
        label: timestampMatch[3],
        text: "",
      };
    } else if (wordCountMatch) {
      wordCount = parseInt(wordCountMatch[1]);
    } else if (summaryMatch) {
      summary = summaryMatch[1];
    } else if (currentSection && line.trim() && !line.startsWith("[SCRIPT]") && !line.startsWith("```")) {
      currentSection.text += (currentSection.text ? " " : "") + line.trim();
      fullScript += line.trim() + " ";
    }
  }

  if (currentSection) sections.push(currentSection);

  // Fallback: if parsing failed, use raw text as full script
  if (sections.length === 0) {
    fullScript = rawText
      .replace(/\[SCRIPT\]/g, "")
      .replace(/\[WORD_COUNT:.*\]/g, "")
      .replace(/\[SUMMARY:.*\]/g, "")
      .replace(/```/g, "")
      .replace(/\[.*?\]/g, "")
      .trim();
  }

  // Count Myanmar words (rough estimate by splitting on spaces)
  const actualWordCount = wordCount || fullScript.split(/\s+/).filter(Boolean).length;

  return {
    sections,
    fullScript: fullScript.trim(),
    wordCount: actualWordCount,
    summary: summary || "Myanmar video script",
    rawOutput: rawText,
    generatedAt: new Date().toISOString(),
  };
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
  };
  return mimeTypes[ext] || "video/mp4";
}
