import express from 'express';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readState, saveState, outputPath } from '../utils/state.js';
import { FFMPEG_BIN } from '../utils/ffmpeg.js';

const router = express.Router();
const PANGO = '/opt/homebrew/bin/pango-view';
const CONVERT = '/opt/homebrew/bin/convert';

// Render subtitle PNGs with Pango
function renderSubtitlePNGs(segments, videoWidth) {
  const tmpDir = path.join(os.tmpdir(), `sub-swap-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const pngPaths = [];

  for (let i = 0; i < segments.length; i++) {
    const text = (segments[i].translatedText || segments[i].text || '').trim();
    if (!text) { pngPaths.push(null); continue; }

    const txtFile = path.join(tmpDir, `seg${i}.txt`);
    const rawPng  = path.join(tmpDir, `seg${i}_raw.png`);
    const outPng  = path.join(tmpDir, `seg${i}.png`);

    fs.writeFileSync(txtFile, text, 'utf8');

    execFileSync(PANGO, [
      '--font=Noto Sans Myanmar Bold 14',
      '--background=transparent',
      '--foreground=#FFD700',
      '--align=center',
      `--width=${Math.floor(videoWidth * 0.85 * 0.75)}`,
      '--wrap=word',
      '-qo', rawPng,
      txtFile,
    ]);

    if (fs.existsSync(CONVERT)) {
      const shadowPng = path.join(tmpDir, `seg${i}_shadow.png`);
      execFileSync(CONVERT, [rawPng, '(', '+clone', '-background', 'black', '-shadow', '80x4+0+0', ')', '-reverse', '-background', 'none', '-layers', 'merge', shadowPng]);
      execFileSync(CONVERT, [shadowPng, '-channel', 'alpha', '-morphology', 'Dilate', 'Octagon:3', '-fill', 'black', '+opaque', 'none', shadowPng, '-composite', outPng]);
    } else {
      fs.copyFileSync(rawPng, outPng);
    }

    pngPaths.push(outPng);
  }

  return { tmpDir, pngPaths };
}

router.post('/', async (req, res) => {
  try {
    const state = readState();
    if (!state.segments?.length) return res.status(400).json({ error: 'Translation မရှိပါ' });
    if (!state.blurRegion) return res.status(400).json({ error: 'Blur region မရှိပါ' });

    const flipVideo  = req.body.flipVideo  !== false; // default ON
    const speedAudio = req.body.speedAudio !== false; // default ON
    const pitchShift = req.body.pitchShift !== false; // default ON

    const { x, y, w, h } = state.blurRegion;
    const segments = state.segments;
    const videoInfo = state.videoInfo || { width: 1920, height: 1080 };
    const outputFile = outputPath('output.mp4');

    console.log(`[Render] Options: flip=${flipVideo} speed=${speedAudio} pitch=${pitchShift}`);

    console.log('[Render] Starting render...');
    console.log(`[Render] Blur region: x=${x} y=${y} w=${w} h=${h}`);
    console.log(`[Render] Segments: ${segments.length}`);

    // Render Myanmar subtitle PNGs (fallback to Chinese text if translation missing)
    const { tmpDir, pngPaths } = renderSubtitlePNGs(segments, videoInfo.width);

    // Collect only valid (seg, png) pairs
    const validSubs = segments
      .map((seg, i) => ({ seg, png: pngPaths[i] }))
      .filter(s => s.png);

    console.log(`[Render] Valid subtitle PNGs: ${validSubs.length} / ${segments.length}`);

    // Build FFmpeg inputs
    const inputs = ['-i', state.videoPath];
    for (const { png } of validSubs) inputs.push('-i', png);

    // Blur filter for the Chinese subtitle region (gblur avoids boxblur chroma radius limit)
    let filterComplex = `[0:v]crop=${w}:${h}:${x}:${y},gblur=sigma=15[blurred];[0:v][blurred]overlay=${x}:${y}[blurred_v]`;

    let prevLabel = 'blurred_v';

    // Apply hflip BEFORE subtitles so subtitle text is not mirrored
    if (flipVideo) {
      const flipOut = validSubs.length > 0 ? 'pre_sub' : 'vout';
      filterComplex += `;[blurred_v]hflip[${flipOut}]`;
      prevLabel = flipOut;
    }

    for (let vi = 0; vi < validSubs.length; vi++) {
      const { seg } = validSubs[vi];
      const isLast = vi === validSubs.length - 1;
      const subX = `(W-w)/2`;
      const subY = `${y}+(${h}/2)-(h/2)`;
      const outLabel = isLast ? 'vout' : `mv${vi}`;
      filterComplex += `;[${prevLabel}][${vi + 1}:v]overlay=x=${subX}:y=${subY}:enable='between(t,${seg.start},${seg.end})'[${outLabel}]`;
      prevLabel = outLabel;
    }

    // No valid subtitle PNGs — pass blurred video straight through
    if (validSubs.length === 0 && !flipVideo) {
      filterComplex = filterComplex.replace('[blurred_v]', '[vout]');
    }

    // Build audio filter chain: pitch shift + speed up
    const audioFilters = [];
    if (pitchShift) {
      // Shift pitch up ~4% without changing speed
      audioFilters.push('asetrate=44100*1.04', 'aresample=44100', 'atempo=1/1.04');
    }
    if (speedAudio) {
      // Speed up 5% (barely noticeable, breaks fingerprint)
      audioFilters.push('atempo=1.05');
    }

    const args = [
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '0:a',
      '-c:v', 'libx264',
      ...(audioFilters.length ? ['-filter:a', audioFilters.join(','), '-c:a', 'aac'] : ['-c:a', 'copy']),
      '-crf', '18',
      '-preset', 'fast',
      '-movflags', '+faststart',
      '-y',
      outputFile,
    ];

    console.log('[Render] Running FFmpeg...');

    await new Promise((resolve, reject) => {
      const proc = spawn(FFMPEG_BIN, args);
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error('FFmpeg failed:\n' + stderr.slice(-1000)));
      });
      proc.on('error', reject);
    });

    // Cleanup temp PNGs
    fs.rmSync(tmpDir, { recursive: true, force: true });

    saveState({ step: 5, outputPath: outputFile });
    console.log('[Render] Done →', outputFile);

    res.json({ success: true, outputPath: outputFile });
  } catch (err) {
    console.error('[Render] ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
