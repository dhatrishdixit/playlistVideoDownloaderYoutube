const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const readline = require('readline');
const ProgressBar = require('progress');


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('enter the video url: ',async (videoUrl)=>{
    
     rl.question('enter the download destination: ',async (folderLocation)=>{
         
       try {
         if(!fs.existsSync(folderLocation)){
             fs.mkdirSync(folderLocation,{
                 recursive:true
             });
         }
         
         const videoInfo = await ytdl.getInfo(videoUrl);
 
       
         
         const videoTitle = videoInfo.videoDetails.title.replace(/[/\\?%*:|"<>]/g, '-');
         console.log(`downloading video ${videoTitle}`)
         const filePath = path.join(folderLocation,`${videoTitle}.mp4`);
         
         const highestQualityFormat = ytdl.chooseFormat(videoInfo.formats, { quality: 'highestvideo' ,filter: 'videoandaudio' })
     
         
         const stream = ytdl(videoUrl, { format: highestQualityFormat });
         
         const contentLength = parseInt(highestQualityFormat.contentLength, 10);
         let bytesWritten = 0;
               const videoDurationSeconds = videoInfo.videoDetails.lengthSeconds;
        const estimatedTotalBytes = videoDurationSeconds * 1024 * 1024; 
         let progressBar;
         if (!isNaN(contentLength) && isFinite(contentLength)) {
           progressBar = new ProgressBar(`[:bar] :percent :etas`, {
             complete: '=',
             incomplete: ' ',
             width: 20,
             total: contentLength
           });
         }
         
         progressBar = new ProgressBar(`[:bar] :percent :etas`, {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: estimatedTotalBytes
          });

 
         stream.on('data', (chunk) => {
           bytesWritten += chunk.length;
           if (progressBar) {
             progressBar.tick(chunk.length);
           }
         });
 
         
         
         stream.pipe(fs.createWriteStream(filePath));
 
         stream.on("finish",()=>{
             console.log(`Finished downloading video: ${videoTitle}`);
         });
 
         stream.on("error",()=>{
             console.log(`Error in downloading video: ${videoTitle}`);
         });
 
       } catch (error) {
         console.error('Error:', error);
       }
        rl.close();
     })
})