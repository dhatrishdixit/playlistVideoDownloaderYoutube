const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const readline = require('readline');
const { google } = require('googleapis');


const youtube = google.youtube({
    version: 'v3',
    auth: 'AIzaSyAtOGR47IWCMgPwfytblIHgMG4zL9J2wgQ',
  });
  
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the playlist URL: ', async (playlistUrl) => {
    const playlistId = playlistUrl.split('list=')[1];
    console.log("playlistId: ",playlistId)
    rl.question('Enter the folder location to save videos: ', async (folderLocation) => {
      try {
        const playlistResponse = await youtube.playlistItems.list({
          part: 'snippet',
          playlistId: playlistId,
          maxResults: 50, // Fetch up to 50 videos at a time
        });
        const length = playlistResponse.data.items.length ;
        console.log(length," videos to be downloaded");
        let curr = 0;
        const videoUrls = playlistResponse.data.items.map(
          (item) => `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
        );
  
        if (!fs.existsSync(folderLocation)) {
          fs.mkdirSync(folderLocation, { recursive: true });
        }
  
        for (const videoUrl of videoUrls) {
          const videoInfo = await ytdl.getInfo(videoUrl);
          const videoTitle = videoInfo.videoDetails.title.replace(/[/\\?%*:|"<>]/g, '-');
          const filePath = path.join(folderLocation, `${videoTitle}.mp4`);
  
          const highestQualityFormat = ytdl.chooseFormat(videoInfo.formats, { quality: 'highestvideo' });
  
          console.log(`Downloading video: ${videoTitle}`);
          const stream = ytdl(videoUrl, { format: highestQualityFormat }).pipe(fs.createWriteStream(filePath));
  
          stream.on('finish', () => {
            console.log(`Downloaded video: ${videoTitle}`);
            curr ++;
            console.log(`downloaded ${curr} out of ${length}`)
          });
  
          stream.on('error', (error) => {
            console.error(`Error downloading video ${videoTitle}:`, error);
          });
        }
  
        console.log('Download finished!');
      } catch (error) {
        console.error('An error occurred:', error);
      }
  
      rl.close();
    });
  });