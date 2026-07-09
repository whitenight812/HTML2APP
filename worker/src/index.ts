import { Worker } from 'bullmq';
import fs from 'fs/promises';
import path from 'path';
import type { BuildJobData } from '../../shared/types';
import { runPipeline } from './pipeline';
import { cleanupTemplate } from './templateManager';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const apkOutputDir = process.env.APK_OUTPUT_DIR || '/tmp/html2app-apks';

const worker = new Worker<BuildJobData>(
  'build-apk',
  async (job) => {
    const { taskId, config: buildConfig } = job.data;

    const result = await runPipeline(taskId, buildConfig, {
      updateProgress: async (value) => {
        await job.updateProgress(value);
      },
    });

    // Copy APK to shared output directory
    await fs.mkdir(apkOutputDir, { recursive: true });
    const destPath = path.join(apkOutputDir, `${taskId}.apk`);
    await fs.copyFile(result.apkPath, destPath);

    // Clean up build directory now that the APK is safely copied out
    await cleanupTemplate(result.buildDir);

    return { apkUrl: `/api/build/${taskId}/download`, appName: result.appName };
  },
  {
    connection,
    concurrency: 1, // One build at a time per worker (scale horizontally for parallelism)
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('Worker started, waiting for build jobs...');
