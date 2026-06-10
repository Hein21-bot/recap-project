import ffmpeg from 'fluent-ffmpeg';

export function extractAudio(videoPath, outputAudioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputAudioPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

export function replaceAudio(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .input(audioPath)
      .outputOptions(['-map 0:v:0', '-map 1:a:0', '-c:v copy', '-shortest'])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

export function burnSubtitles(videoPath, srtPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        `-vf subtitles='${srtPath}':force_style='FontName=Arial,FontSize=18,PrimaryColour=&H00FFFF00,OutlineColour=&H00000000,Outline=2,Alignment=2'`
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}
