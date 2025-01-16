import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import path from 'path';

import { VideoDownloaderService } from '@/services/VideoDownloaderService';
import { ValidationError } from '@/errors/ValidationError';
import { Config } from '@/cli/commands/LibraryCommandLoader';

type Injects = {
  videoDownloaderService: VideoDownloaderService;
  config: Config;
};

const schema = {
  body: {
    type: 'object',
    required: ['uri'],
    properties: {
      uri: {
        type: 'string',
      },
    },
  },
};

export function postDownload({
                               videoDownloaderService,
                               config,
                             }: Injects): FastifyPluginAsync {
  return fp(async server => {
    server.post<{
      Body: { uri: string };
    }>(
      '/download',
      {
        schema,
        preHandler: server.auth([server.verifySession]),
      },
      async (request, reply) => {
        const { uri } = request.body;

        if (!uri) {
          throw new ValidationError('URI is required');
        }
        console.log(uri)
        if (!uri.startsWith('https://www.youtube.com/') &&
          !uri.startsWith('https://youtu.be/')) {
          throw new ValidationError('Invalid YouTube URL');
        }

        const timestamp = new Date().getTime();
        const outputPath = path.join(config.storageDir, `download_${timestamp}.mp3`);

        try {
          await videoDownloaderService.download(
            uri,
            outputPath,
            progress => {
              server.log.info({ progress }, 'Download progress');
            },
          );

          // Trigger library scan
//          await server.musicLibrary.scan();

          return reply.send({
            success: true,
            message: 'Download completed and library updated',
            path: outputPath,
          });
        } catch (error) {
          server.log.error(error, 'Download failed');
          throw error;
        }
      },
    );
  });
}