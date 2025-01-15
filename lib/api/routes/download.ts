import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ValidationError } from '@/errors/ValidationError';

const schema = {
  body: {
    type: 'object',
    required: ['uri'],
    properties: {
      uri: { type: 'string' }
    }
  }
};

export function download(): FastifyPluginAsync {
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

        console.log('Download requested for URI:', uri);

        return { success: true };
      },
    );
  });
}