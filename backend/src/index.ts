import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: true });

  app.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Backend running on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
