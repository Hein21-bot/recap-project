import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import { readState, saveState, outputPath } from '../utils/state.js';
import fs from 'fs';

const router = express.Router();
const FFMPEG_FULL = '/opt/homebrew/Cellar/ffmpeg-full/8.1.1/bin/ffmpeg';
if (fs.existsSync(FFMPEG_FULL)) ffmpeg.setFfmpegPath(FFMPEG_FULL);

function getMediaDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(null);
      resolve(metadata?.format?.duration || null);
    });
  });
}

function mergeAudioVideo(videoPath, audioPath, out) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath).input(audioPath)
      .outputOptions(['-map 0:v:0', '-map 1:a:0', '-c:v libx264', '-c:a aac', '-crf 18', '-preset fast', '-shortest', '-movflags +faststart'])
      .output(out)
      .on('end', resolve).on('error', reject).run();
  });
}

function slowMotionSync(videoPath, audioPath, out, slowFactor) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath).input(audioPath)
      .complexFilter([`[0:v]setpts=${slowFactor.toFixed(4)}*PTS[v]`])
      .outputOptions(['-map [v]', '-map 1:a:0', '-c:v libx264', '-c:a aac', '-crf 18', '-preset fast', '-movflags +faststart'])
      .output(out)
      .on('end', resolve).on('error', reject).run();
  });
}

function trimAndMerge(videoPath, audioPath, out, targetDuration) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath).input(audioPath)
      .outputOptions(['-map 0:v:0', '-map 1:a:0', '-c:v libx264', '-c:a aac', '-crf 18', '-preset fast', '-t', targetDuration.toFixed(3), '-movflags +faststart'])
      .output(out)
      .on('end', resolve).on('error', reject).run();
  });
}

router.post('/', async (req, res) => {
  try {
    const state = readState();
    if (!state.audioPaths || !state.videoPath) {
      return res.status(400).json({ error: 'Missing audio or video. Complete previous steps first.' });
    }

    const segments = state.translated;
    const audioDir = outputPath('audio');
    const concatList = `${audioDir}/concat.txt`;
    const mergedAudio = outputPath('dubbed-audio.wav');
    const dubbedVideo = outputPath('dubbed-video.mp4');

    // Build silence-padded concat list
    const { execSync } = await import('child_process');
    const listLines = [];
    let cursor = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const gap = seg.start - cursor;

      if (gap > 0.05) {
        const silencePath = `${audioDir}/silence-${i}.wav`;
        execSync(`ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t ${gap.toFixed(3)} -acodec pcm_s16le ${silencePath} -y`, { stdio: 'pipe' });
        listLines.push(`file '${silencePath}'`);
      }

      listLines.push(`file '${state.audioPaths[i]}'`);
      cursor = seg.end;
    }

    fs.writeFileSync(concatList, listLines.join('\n'));
    execSync(`ffmpeg -f concat -safe 0 -i "${concatList}" -ar 24000 "${mergedAudio}" -y`, { stdio: 'pipe' });

    // Smart sync: compare durations and adjust
    const [videoDuration, audioDuration] = await Promise.all([
      getMediaDuration(state.videoPath),
      getMediaDuration(mergedAudio)
    ]);

    console.log(`Video: ${videoDuration?.toFixed(2)}s, Audio: ${audioDuration?.toFixed(2)}s`);

    if (!videoDuration || !audioDuration) {
      await mergeAudioVideo(state.videoPath, mergedAudio, dubbedVideo);
    } else {
      const diff = audioDuration - videoDuration;
      if (Math.abs(diff) < 0.5) {
        await mergeAudioVideo(state.videoPath, mergedAudio, dubbedVideo);
      } else if (diff > 0) {
        const slowFactor = audioDuration / videoDuration;
        console.log(`Audio longer by ${diff.toFixed(1)}s — slowing video ${slowFactor.toFixed(2)}x`);
        await slowMotionSync(state.videoPath, mergedAudio, dubbedVideo, slowFactor);
      } else {
        console.log(`Video longer by ${Math.abs(diff).toFixed(1)}s — trimming to match audio`);
        await trimAndMerge(state.videoPath, mergedAudio, dubbedVideo, audioDuration);
      }
    }

    saveState({ step: 4, dubbedVideoPath: dubbedVideo, videoDuration, audioDuration });
    res.json({ success: true, output: 'dubbed-video.mp4', videoDuration, audioDuration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
