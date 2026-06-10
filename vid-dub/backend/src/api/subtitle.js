import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import { readState, saveState, outputPath } from '../utils/state.js';

const router = express.Router();

const FFMPEG_BIN = fs.existsSync('/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg')
  ? '/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg'
  : 'ffmpeg';
const FFPROBE_BIN = fs.existsSync('/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffprobe')
  ? '/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffprobe'
  : 'ffprobe';
const PANGO = '/opt/homebrew/bin/pango-view';
const CONVERT = '/opt/homebrew/bin/convert';

if (fs.existsSync(FFMPEG_BIN)) ffmpeg.setFfmpegPath(FFMPEG_BIN);

function toSRT(segments) {
  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
  };
  return segments.map((seg, i) =>
    `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.translatedText}\n`
  ).join('\n');
}

function parseSRT(content) {
  const entries = [];
  const blocks = content.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const m = lines[1].match(/(\d+:\d+:\d+,\d+)\s*-->\s*(\d+:\d+:\d+,\d+)/);
    if (!m) continue;
    const parseTs = (ts) => {
      const [time, ms] = ts.split(',');
      const [h, mi, s] = time.split(':').map(Number);
      return h * 3600 + mi * 60 + s + parseInt(ms) / 1000;
    };
    entries.push({ start: parseTs(m[1]), end: parseTs(m[2]), text: lines.slice(2).join(' ').trim() });
  }
  return entries;
}

function getVideoDimensions(videoPath) {
  try {
    const out = execFileSync(FFPROBE_BIN, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0', videoPath
    ], { encoding: 'utf8' });
    const [w, h] = out.trim().split(',').map(Number);
    if (w && h) return { w, h };
  } catch (_) {}
  return { w: 1080, h: 1920 };
}

function renderSubtitlePNGs(entries, videoDims, tmpDir) {
  const pngPaths = [];
  const pangoAvailable = fs.existsSync(PANGO);
  const convertAvailable = fs.existsSync(CONVERT);

  for (let i = 0; i < entries.length; i++) {
    const textFile = path.join(tmpDir, `sub${i}.txt`);
    const rawPng   = path.join(tmpDir, `sub${i}_raw.png`);
    const finalPng = path.join(tmpDir, `sub${i}.png`);

    fs.writeFileSync(textFile, entries[i].text, 'utf8');

    if (pangoAvailable) {
      execFileSync(PANGO, [
        '--font=Noto Sans Myanmar Bold 14',
        '--background=transparent',
        '--foreground=#FFD700',
        '--align=center',
        `--width=${Math.floor(videoDims.w * 0.80 * 0.75)}`,
        '--wrap=word',
        '-qo', rawPng,
        textFile,
      ]);

      if (convertAvailable) {
        const shadowPng = path.join(tmpDir, `sub${i}_shadow.png`);
        execFileSync(CONVERT, [rawPng, '(', '+clone', '-background', 'black', '-shadow', '80x4+0+0', ')', '-reverse', '-background', 'none', '-layers', 'merge', shadowPng]);
        execFileSync(CONVERT, [shadowPng, '-channel', 'alpha', '-morphology', 'Dilate', 'Octagon:3', '-fill', 'black', '+opaque', 'none', shadowPng, '-composite', finalPng]);
      } else {
        fs.copyFileSync(rawPng, finalPng);
      }
    } else {
      // Fallback: drawtext (won't render Myanmar correctly but better than nothing)
      fs.copyFileSync(textFile, finalPng);
    }

    pngPaths.push(finalPng);
  }
  return pngPaths;
}

function overlaySubtitlePNGs(videoPath, entries, pngPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const inputs = [];
    for (const p of pngPaths) inputs.push('-i', p);

    let filterComplex = '';
    let prevLabel = '0:v';

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const outLabel = i < entries.length - 1 ? `mv${i}` : 'vout';
      filterComplex +=
        `[${prevLabel}][${i + 1}:v]overlay=x=(W-w)/2:y=H*0.70-h` +
        `:enable='between(t,${e.start},${e.end})'[${outLabel}]`;
      if (i < entries.length - 1) filterComplex += ';';
      prevLabel = outLabel;
    }

    const args = [
      '-i', videoPath,
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '0:a',
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'fast',
      '-movflags', '+faststart',
      '-y', outputPath,
    ];

    const proc = spawn(FFMPEG_BIN, args);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error('Subtitle overlay failed:\n' + stderr.slice(-800)));
    });
    proc.on('error', reject);
  });
}

router.post('/', async (req, res) => {
  try {
    const state = readState();
    if (!state.dubbedVideoPath || !state.translated) {
      return res.status(400).json({ error: 'Missing dubbed video or translation. Complete previous steps.' });
    }

    const subtitleDir = outputPath('subtitles');
    if (!fs.existsSync(subtitleDir)) fs.mkdirSync(subtitleDir, { recursive: true });

    const srtPath = path.join(subtitleDir, 'subtitles.srt');
    const subtitledVideo = outputPath('subtitled-video.mp4');

    fs.writeFileSync(srtPath, toSRT(state.translated));

    const entries = parseSRT(fs.readFileSync(srtPath, 'utf8'));
    const videoDims = getVideoDimensions(state.dubbedVideoPath);

    const tmpDir = path.join(os.tmpdir(), `vid-dub-subs-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    if (fs.existsSync(PANGO)) {
      // Pango/HarfBuzz path — proper Myanmar rendering
      const pngPaths = renderSubtitlePNGs(entries, videoDims, tmpDir);
      await overlaySubtitlePNGs(state.dubbedVideoPath, entries, pngPaths, subtitledVideo);
    } else {
      // Fallback: ffmpeg subtitles filter (Myanmar may not render correctly)
      console.warn('pango-view not found — falling back to ffmpeg subtitles filter');
      await new Promise((resolve, reject) => {
        ffmpeg(state.dubbedVideoPath)
          .outputOptions([`-vf subtitles='${srtPath}':force_style='FontName=Noto Sans Myanmar,FontSize=18,PrimaryColour=&H00FFD700,OutlineColour=&H00000000,Outline=2,Alignment=2'`])
          .output(subtitledVideo)
          .on('end', resolve).on('error', reject).run();
      });
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });

    saveState({ step: 5, subtitledVideoPath: subtitledVideo, srtPath });
    res.json({ success: true, output: 'subtitled-video.mp4' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
