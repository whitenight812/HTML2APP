import { Queue, Job } from 'bullmq';
import { config } from '../config';
import type { BuildJobData, BuildStatus } from '../../../shared/types';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

export const buildQueue = new Queue<BuildJobData, any, string>('build-apk', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

export async function addBuildJob(
  taskId: string,
  buildConfig: BuildJobData['config']
): Promise<void> {
  await buildQueue.add('build', { taskId, config: buildConfig }, { jobId: taskId });
}

export function getJobProgress(job: Job): number {
  if (typeof job.progress === 'number') return job.progress;
  // BullMQ progress can be an object: { progress: number }
  if (job.progress && typeof job.progress === 'object' && 'progress' in job.progress) {
    return (job.progress as { progress: number }).progress;
  }
  return 0;
}

export function getJobStep(job: Job): string {
  if (job.progress && typeof job.progress === 'object' && 'step' in job.progress) {
    return (job.progress as { step: string }).step;
  }
  return '';
}

export async function getJobStatus(taskId: string): Promise<BuildStatus | null> {
  const job = await buildQueue.getJob(taskId);
  if (!job) return null;

  const state = await job.getState();
  const statusMap: Record<string, BuildStatus['status']> = {
    waiting: 'queued',
    active: 'building',
    completed: 'done',
    failed: 'failed',
    delayed: 'queued',
    paused: 'queued',
  };

  const isCompleted = state === 'completed';
  const returnvalue = job.returnvalue as { apkUrl?: string } | undefined | null;
  return {
    taskId,
    status: statusMap[state] || 'queued',
    progress: isCompleted ? 100 : getJobProgress(job),
    currentStep: isCompleted ? '完成' : getJobStep(job) || '等待中...',
    apkUrl: returnvalue?.apkUrl || null,
    error: job.failedReason || null,
  };
}
