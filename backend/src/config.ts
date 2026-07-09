export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  apkRetentionMs: 2 * 60 * 60 * 1000, // 2 hours
  buildTimeoutMs: 10 * 60 * 1000, // 10 minutes
};
