import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BUILD_ROOT = path.join(os.tmpdir(), 'html2app-builds');

export async function createTemplate(taskId: string): Promise<string> {
  const buildDir = path.join(BUILD_ROOT, taskId);
  // Clean stale directory from a previous failed attempt
  try { await fs.rm(buildDir, { recursive: true, force: true }); } catch {}
  await fs.mkdir(buildDir, { recursive: true });

  // Create package.json manually (avoid interactive @capacitor/create-app CLI)
  const pkg = {
    name: 'html2app-build',
    version: '1.0.0',
    private: true,
    dependencies: {
      '@capacitor/core': '^6.0.0',
      '@capacitor/android': '^6.0.0',
      '@capacitor/cli': '^6.0.0',
    },
  };
  await fs.writeFile(
    path.join(buildDir, 'package.json'),
    JSON.stringify(pkg, null, 2),
  );

  // Create capacitor.config.json
  const capConfig = {
    appId: 'com.html2app.temp',
    appName: 'App',
    webDir: 'www',
    server: { androidScheme: 'https' },
  };
  await fs.writeFile(
    path.join(buildDir, 'capacitor.config.json'),
    JSON.stringify(capConfig, null, 2),
  );

  // Create minimal www directory
  const wwwDir = path.join(buildDir, 'www');
  await fs.mkdir(wwwDir, { recursive: true });
  await fs.writeFile(
    path.join(wwwDir, 'index.html'),
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>',
  );

  // Install dependencies
  await execAsync('npm install', { cwd: buildDir, timeout: 120000 });

  // Add Android platform (skip if already exists from a cached template)
  try {
    await fs.access(path.join(buildDir, 'android'));
  } catch {
    await execAsync('npx cap add android', { cwd: buildDir, timeout: 120000 });
  }

  return buildDir;
}

export async function cleanupTemplate(buildDir: string): Promise<void> {
  try {
    await fs.rm(buildDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}
