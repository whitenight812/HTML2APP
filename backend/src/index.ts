import Fastify from 'fastify';
import cors from '@fastify/cors';
import Redis from 'ioredis';
import { config } from './config';

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: true });

  // Verify Redis connection
  app.get('/api/health', async () => {
    let redisOk = false;
    try {
      const pingClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        maxRetriesPerRequest: 0,
        connectTimeout: 2000,
        lazyConnect: false,
        retryStrategy: () => null,
      });
      await pingClient.ping();
      redisOk = true;
      pingClient.disconnect();
    } catch {}
    return { status: redisOk ? 'ok' : 'degraded', redis: redisOk, timestamp: Date.now() };
  });

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Backend running on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
