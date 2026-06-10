import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const ffmpeg = require('fluent-ffmpeg');

const FFMPEG_FULL = '/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg';
const FFPROBE_FULL = '/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffprobe';

if (fs.existsSync(FFMPEG_FULL)) ffmpeg.setFfmpegPath(FFMPEG_FULL);
if (fs.existsSync(FFPROBE_FULL)) ffmpeg.setFfprobePath(FFPROBE_FULL);

export const FFMPEG_BIN = fs.existsSync(FFMPEG_FULL) ? FFMPEG_FULL : 'ffmpeg';
export const FFPROBE_BIN = fs.existsSync(FFPROBE_FULL) ? FFPROBE_FULL : 'ffprobe';

export function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) return reject(err);
      resolve(meta.format.duration || 0);
    });
  });
}

export function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) return reject(err);
      const vs = meta.streams.find(s => s.codec_type === 'video') || {};
      resolve({
        duration: meta.format.duration || 0,
        width: vs.width || 1920,
        height: vs.height || 1080,
      });
    });
  });
}

export function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

export function extractFrame(videoPath, outputPath, timeSeconds = 5) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timeSeconds)
      .frames(1)
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}
