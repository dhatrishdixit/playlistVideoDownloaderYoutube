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
      const videoTitle = videoInfo.videoDetails.title.replace(/[\\/?%*:|"<>]/g, '-');
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
  console.log(`Downloading video: ${videoInfo.videoDetails.title}`);
  
  const audio = ytdl(videoUrl, { quality: 'highestaudio' }).on('progress', (_, downloaded, total) => {
    console.log(`Audio Download Progress: ${(downloaded / total * 100).toFixed(2)}%`);
  });
  
  const video = ytdl(videoUrl, { quality: 'highestvideo' }).on('progress', (_, downloaded, total) => {
    console.log(`Video Download Progress: ${(downloaded / total * 100).toFixed(2)}%`);
  });
  
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

  ffmpegProcess.stdio[3].on('data', (chunk) => {
    // Here you can process the ffmpeg progress output if needed
    console.log(chunk.toString());
  });

  ffmpegProcess.on('close', () => {
    console.log('Merging finished!');
    rl.close(); // Ensure readline interface is closed after operation completion
  });

  ffmpegProcess.on('error', (error) => {
    console.error('Error during the merging process:', error);
    rl.close();
  });

  audio.pipe(ffmpegProcess.stdio[4]);
  video.pipe(ffmpegProcess.stdio[5]);
}
