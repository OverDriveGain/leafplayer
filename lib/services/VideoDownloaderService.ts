import fs, { createReadStream } from 'fs';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import path from 'path';
import { Config } from '@/cli/commands/LibraryCommandLoader';
import { ValidationError } from '@/errors/ValidationError';
import { isReadable, statFile } from '@/helpers/filesystem';
import { ArtworksService } from '@/services/ArtworksService';

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export interface DownloadProgress {
  percent: number;
  timemark?: string;
  bitrate?: string;
  currentTime?: string;
  totalDuration?: string;
}

export interface VideoDownloaderService {
  download(
    videoUrl: string,
    outputPath: string,
    onProgress?: ProgressCallback
  ): Promise<void>
}

type ProgressCallback = (progress: DownloadProgress) => void;

class VideoDownloader {
  private tempDir: string;

  constructor({ config }: { config: Config }) {
    this.tempDir = path.join('/tmp', 'leafplayer-downloads');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private cleanup(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private timemarkToSeconds(timemark: string): number {
    const [hours, minutes, secondsAndMs] = timemark.split(':');
    const [seconds, ms] = secondsAndMs.split('.');
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + (ms ? parseFloat(`0.${ms}`) : 0);
  }

  private getVideoDuration(inputFile: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputFile, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        if (metadata?.format?.duration) {
          resolve(metadata.format.duration);
        } else {
          reject(new Error('Could not get video duration'));
        }
      });
    });
  }

  private async convertToMp3(
    inputFile: string,
    outputFile: string,
    onProgress: ProgressCallback = () => {}
  ): Promise<void> {
    try {
      const duration = await this.getVideoDuration(inputFile);
      console.log(`[FFmpeg] Video duration: ${duration} seconds`);

      return new Promise((resolve, reject) => {
        ffmpeg(inputFile)
          .toFormat('mp3')
          .on('start', () => {
            console.log(`[FFmpeg] Starting conversion...`);
          })
          .on('progress', (progress) => {
            let percent = 0;

            if (progress.timemark) {
              const currentTime = this.timemarkToSeconds(progress.timemark);
              percent = Math.min(Math.round((currentTime / duration) * 100), 100);
            }

            const progressInfo: DownloadProgress = {
              percent,
              timemark: progress.timemark,
              bitrate: `${progress.currentKbps}kbps`,
              currentTime: `${Math.round(this.timemarkToSeconds(progress.timemark))}s`,
              totalDuration: `${Math.round(duration)}s`
            };

            onProgress(progressInfo);
          })
          .on('end', () => {
            console.log('\n[FFmpeg] Conversion completed successfully');
            resolve();
          })
          .on('error', (err) => {
            console.error(`[FFmpeg] Error during conversion: ${err.message}`);
            reject(err);
          })
          .save(outputFile);
      });
    } catch (error) {
      throw new Error(`Failed to get video duration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async downloadVideo(
    videoUrl: string,
    onProgress: ProgressCallback = () => {}
  ): Promise<string> {
    const info = await ytdl.getInfo(videoUrl);

    const format = info.formats
      .filter(format => format.hasAudio && format.hasVideo)
      .sort((a, b) => {
        if (a.audioBitrate && b.audioBitrate) {
          return b.audioBitrate - a.audioBitrate;
        }
        const qualityOrder: Record<string, number> = {
          'AUDIO_QUALITY_HIGH': 3,
          'AUDIO_QUALITY_MEDIUM': 2,
          'AUDIO_QUALITY_LOW': 1
        };
        return (qualityOrder[b.audioQuality || ''] || 0) - (qualityOrder[a.audioQuality || ''] || 0);
      })[0];

    if (!format) {
      throw new ValidationError('No suitable video/audio format found');
    }

    const tempFile = path.join(this.tempDir, `${info.videoDetails.videoId}.tmp`);
    const writeStream = fs.createWriteStream(tempFile);
    const stream = ytdl(videoUrl, { format });

    return new Promise((resolve, reject) => {
      let startTime = Date.now();

      stream.once('response', () => {
        console.log('[Download] Started downloading video...');
      });

      stream.on('progress', (_, downloaded, total) => {
        const percent = Math.round((downloaded / total) * 100);
        onProgress({ percent });
      });

      stream.pipe(writeStream);

      writeStream.on('finish', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n[Download] Completed in ${duration} seconds`);
        resolve(tempFile);
      });

      writeStream.on('error', (error) => {
        this.cleanup(tempFile);
        reject(error);
      });

      stream.on('error', (error) => {
        this.cleanup(tempFile);
        reject(error);
      });
    });
  }

  public async downloadAndConvertToMp3(
    videoUrl: string,
    outputPath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    let tempFile: string | undefined;

    try {
      tempFile = await this.downloadVideo(videoUrl, onProgress);
      await this.convertToMp3(tempFile, outputPath, onProgress);
      console.log(`[Success] File saved as: ${outputPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Error]', errorMessage);
      throw new Error(errorMessage);
    } finally {
      if (tempFile) {
        this.cleanup(tempFile);
      }
    }
  }
}
type Injects = {
  config: {
    storageDir: string;
  };
};
export default function createDownloadService({
                                                config,
                                              }: Injects) : VideoDownloaderService {
  return {
    async download(videoUrl,
                   outputPath,
                   onProgress){
      const videoDownloader = new VideoDownloader({ config });
      videoDownloader.downloadAndConvertToMp3(videoUrl, outputPath, onProgress);
    },
  };
}
