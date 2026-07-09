import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function buildApk(buildDir: string): Promise<string> {
  const androidDir = path.join(buildDir, 'android');

  // Make gradlew executable
  await execAsync('chmod +x gradlew', { cwd: androidDir });

  // Run Gradle assembleDebug
  await execAsync('./gradlew assembleDebug --no-daemon --stacktrace', {
    cwd: androidDir,
    timeout: 600000, // 10 minutes
  });

  const apkPath = path.join(
    androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'
  );

  return apkPath;
}

export async function syncCapacitor(buildDir: string): Promise<void> {
  // Run cap sync before building to make sure Capacitor plugins are wired up
  await execAsync('npx cap sync android', { cwd: buildDir, timeout: 120000 });
}
