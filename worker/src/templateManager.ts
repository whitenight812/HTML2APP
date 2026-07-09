import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BUILD_ROOT = path.join(os.tmpdir(), 'html2app-builds');

/**
 * Create a ready-to-configure Capacitor Android project by running
 * the Capacitor CLI programmatically in a temp directory.
 *
 * Returns the absolute path to the generated project directory.
 */
export async function createTemplate(taskId: string): Promise<string> {
  const buildDir = path.join(BUILD_ROOT, taskId);

  await fs.mkdir(buildDir, { recursive: true });

  // Initialize a Capacitor project via @capacitor/create-app
  try {
    await execAsync(
      'npx @capacitor/create-app@latest . --name "App" --package-id "com.html2app.temp" --web-dir "www" --npm-client npm',
      { cwd: buildDir },
    );
  } catch (err) {
    // Clean up the partially-created directory on failure
    await cleanupTemplate(buildDir);
    throw new Error(
      `Failed to create Capacitor project for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Create a minimal web directory with a placeholder index.html
  const wwwDir = path.join(buildDir, 'www');
  await fs.mkdir(wwwDir, { recursive: true });
  await fs.writeFile(
    path.join(wwwDir, 'index.html'),
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>',
  );

  // Add the Android platform
  try {
    await execAsync('npx cap add android', { cwd: buildDir });
  } catch (err) {
    // Clean up on failure
    await cleanupTemplate(buildDir);
    throw new Error(
      `Failed to add Android platform for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return buildDir;
}

/**
 * Remove a previously created template directory.
 * Best-effort — errors are silently swallowed.
 */
export async function cleanupTemplate(buildDir: string): Promise<void> {
  try {
    await fs.rm(buildDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}
