const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const readline = require('readline');
const cp = require('child_process');
const ffmpeg = require('ffmpeg-static');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter the video URL: ', async (videoUrl) => {
  rl.question('Enter the folder location to save video: ', async (folderLocation) => {
    try {
      const videoInfo = await ytdl.getInfo(videoUrl);
      const videoTitle = videoInfo.videoDetails.title.replace(/[\\/\\?%*:|"<>]/g, '-');
      const filePath = path.join(folderLocation, `${videoTitle}.mp4`);

      if (!fs.existsSync(folderLocation)) {
        fs.mkdirSync(folderLocation, { recursive: true });
      }

      if (fs.existsSync(filePath)) {
        rl.question(`File '${filePath}' already exists. Do you want to overwrite? (y/n): `, (answer) => {
          if (answer.toLowerCase() === 'y') {
            downloadAndMergeVideo(videoUrl, filePath, videoInfo);
          } else {
            console.log('Skipping video download.');
            rl.close();
          }
        });
      } else {
        downloadAndMergeVideo(videoUrl, filePath, videoInfo);
      }
    } catch (error) {
      console.error('An error occurred:', error);
      rl.close();
    }
  });
});

function downloadAndMergeVideo(videoUrl, filePath, videoInfo) {
  const tracker = {
    start: Date.now(),
    audio: { downloaded: 0, total: Infinity },
    video: { downloaded: 0, total: Infinity },
    merged: { frame: 0, speed: '0x', fps: 0 },
  };

  const audio = ytdl(videoUrl, { quality: 'highestaudio' })
    .on('progress', (_, downloaded, total) => {
      tracker.audio = { downloaded, total };
    });

  const video = ytdl(videoUrl, { quality: 'highestvideo' })
    .on('progress', (_, downloaded, total) => {
      tracker.video = { downloaded, total };
    });

  const showProgress = () => {
    readline.cursorTo(process.stdout, 0);
    const toMB = i => (i / 1024 / 1024).toFixed(2);
    process.stdout.write(`Audio | ${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}% processed `);
    process.stdout.write(`(${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB).${' '.repeat(10)}\n`);
    process.stdout.write(`Video | ${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}% processed `);
    process.stdout.write(`(${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB).${' '.repeat(10)}\n`);
    process.stdout.write(`Merged | processing frame ${tracker.merged.frame} `);
    process.stdout.write(`(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${' '.repeat(10)}\n`);
    process.stdout.write(`running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`);
    readline.moveCursor(process.stdout, 0, -3);
  };

  const ffmpegProcess = cp.spawn(ffmpeg, [
    '-loglevel', '8', '-hide_banner',
    '-progress', 'pipe:3',
    '-i', 'pipe:4', '-i', 'pipe:5',
    '-map', '0:a', '-map', '1:v',
    '-c:v', 'copy',
    '-y',
    filePath,
  ], {
    windowsHide: true,
    stdio: [
      'inherit', 'inherit', 'inherit',
      'pipe', 'pipe', 'pipe',
    ],
  });

  ffmpegProcess.on('close', () => {
    console.log('Merging finished!');
    process.stdout.write('\n\n\n\n');
    clearInterval(progressbarHandle);
  });

  let progressbarHandle = null;
  const progressbarInterval = 1000;

  ffmpegProcess.stdio[3].on('data', chunk => {
    if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
    const lines = chunk.toString().trim().split('\n');
    const args = {};
    for (const l of lines) {
      const [key, value] = l.split('=');
      args[key.trim()] = value.trim();
    }
    tracker.merged = args;
  });

  audio.pipe(ffmpegProcess.stdio[4]);
  video.pipe(ffmpegProcess.stdio[5]);

  console.log(`Downloading video: ${videoInfo.videoDetails.title}`);

  const stream = ytdl(videoUrl, { format: ytdl.chooseFormat(videoInfo.formats, { quality: 'highestvideo' }) }).pipe(fs.createWriteStream(filePath));

  stream.on('finish', () => {
    console.log(`Downloaded video: ${videoInfo.videoDetails.title}`);
  });

  stream.on('error', (error) => {
    console.error(`Error downloading video ${videoInfo.videoDetails.title}:`, error);
  });
}