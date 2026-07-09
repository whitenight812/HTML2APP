import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

export function getApkPath(taskId: string): string {
  return path.join(config.uploadDir, `${taskId}.apk`);
}

export async function apkExists(taskId: string): Promise<boolean> {
  try {
    await fs.access(getApkPath(taskId));
    return true;
  } catch {
    return false;
  }
}

export function scheduleCleanup(taskId: string): void {
  // Single timer per taskId — clear any existing timer before creating a new one
  const existing = cleanupTimers.get(taskId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(async () => {
    cleanupTimers.delete(taskId);
    try {
      await fs.unlink(getApkPath(taskId));
    } catch {
      // File already gone — nothing to do
    }
  }, config.apkRetentionMs);

  cleanupTimers.set(taskId, timer);
}

// Clean up any leftover APKs on startup
export async function cleanupStaleApks(): Promise<void> {
  await ensureUploadDir();
  const files = await fs.readdir(config.uploadDir);
  const now = Date.now();
  for (const file of files) {
    const filePath = path.join(config.uploadDir, file);
    try {
      const stat = await fs.stat(filePath);
      if (now - stat.mtimeMs > config.apkRetentionMs) {
        await fs.unlink(filePath);
      }
    } catch {
      // skip
    }
  }
}
