const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const readline = require('readline');
const { google } = require('googleapis');

const cp = require('child_process');
const ffmpeg = require('ffmpeg-static');
// const dotenv = require('dotenv');
// dotenv.config({
//   path:'./env'
// })

const youtube = google.youtube({ 
    version: 'v3',
    auth: "AIzaSyAtOGR47IWCMgPwfytblIHgMG4zL9J2wgQ"
});
const ProgressBar = require('progress');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter the playlist URL: ', async (playlistUrl) => {
  const playlistId = playlistUrl.split('list=')[1];
  console.log("Playlist ID: ", playlistId);

  rl.question('Enter the folder location to save videos: ', async (folderLocation) => {
    try {
      const playlistResponse = await youtube.playlistItems.list({
        part: 'snippet',
        playlistId: playlistId,
        maxResults: 70, // Fetch up to 70 videos at a time
      });

      const length = playlistResponse.data.items.length;
      console.log(`${length} videos to be downloaded`);

      const videoUrls = playlistResponse.data.items.map((item) => `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`);

      if (!fs.existsSync(folderLocation)) {
        fs.mkdirSync(folderLocation, { recursive: true });
      }

      const overallBar = new ProgressBar('Overall Progress [:bar] :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 50,
        total: length
      });

      let curr = 0;

      for (const videoUrl of videoUrls) {
        const videoInfo = await ytdl.getInfo(videoUrl);
        const videoTitle = videoInfo.videoDetails.title.replace(/[\\/\\?%*:|"<>]/g, '-');
        const filePath = path.join(folderLocation, `${videoTitle}.mp4`);

        if (fs.existsSync(filePath)) {
          rl.question(`File '${filePath}' already exists. Do you want to overwrite? (y/n): `, (answer) => {
            if (answer.toLowerCase() === 'y') {
              downloadAndMergeVideo(videoUrl, filePath, videoInfo, length, curr, overallBar);
            } else {
              console.log('Skipping video download.');
              curr++;
              overallBar.update(curr / length);
            }
          });
        } else {
          downloadAndMergeVideo(videoUrl, filePath, videoInfo, length, curr, overallBar);
        }
      }
    } catch (error) {
      console.error('An error occurred:', error);
      rl.close();
    }
  });
});

function downloadAndMergeVideo(videoUrl, filePath, videoInfo, length, curr, overallBar) {
  const audioBar = new ProgressBar(`Audio Download [:bar] :percent :etas`, {
    complete: '=',
    incomplete: ' ',
    width: 50,
    total: 100
  });

  const videoBar = new ProgressBar(`Video Download [:bar] :percent :etas`, {
    complete: '=',
    incomplete: ' ',
    width: 50,
    total: 100
  });

  const mergingBar = new ProgressBar(`Merging Progress [:bar] :percent :etas`, {
    complete: '=',
    incomplete: ' ',
    width: 50,
    total: 100
  });

  const audio = ytdl(videoUrl, { quality: 'highestaudio' }).on('progress', (_, downloaded, total) => {
    audioBar.update(downloaded / total);
  });

  const video = ytdl(videoUrl, { quality: 'highestvideo' }).on('progress', (_, downloaded, total) => {
    videoBar.update(downloaded / total);
  });

  const ffmpegProcess = cp.spawn(ffmpeg, [
    '-loglevel', '8', '-hide_banner',
    '-progress', 'pipe:3',
    '-i', 'pipe:4', '-i', 'pipe:5',
    '-map', '0:a', '-map', '1:v',
    '-c:v', 'copy',
    '-y', // Add this line to overwrite existing files
    filePath,
  ], {
    windowsHide: true,
    stdio: [
      'inherit', 'inherit', 'inherit',
      'pipe', 'pipe', 'pipe',
    ],
  });

  ffmpegProcess.stdio[3].on('data', (chunk) => {
    const progress = chunk.toString().trim().split('=')[1];
    if (progress) {
      const progressValue = parseFloat(progress);
      mergingBar.update(progressValue / 100);
    }
  });

  ffmpegProcess.on('close', () => {
    console.log('Merging finished!');
    curr++;
    overallBar.update(curr / length);
    if (curr === length) {
      console.log('Download finished!');
      rl.close();
    }
  });

  ffmpegProcess.on('error', (error) => {
    console.error('Error during the merging process:', error);
    rl.close();
  });

  audio.pipe(ffmpegProcess.stdio[4]);
  video.pipe(ffmpegProcess.stdio[5]);

  console.log(`Downloading video: ${videoInfo.videoDetails.title}`);
}