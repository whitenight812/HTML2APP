import { exec } from 'child_process';
import { writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function buildApk(buildDir: string): Promise<string> {
  const androidDir = path.join(buildDir, 'android');

  // Use system Gradle (8.5) instead of ./gradlew to avoid downloading
  // another distribution from blocked servers
  await writeFile(
    path.join(androidDir, 'gradle.properties'),
    'org.gradle.jvmargs=-Xmx2048m\nandroid.useAndroidX=true\nandroid.enableJetifier=true\n',
  );

  await execAsync('gradle assembleDebug --no-daemon --stacktrace', {
    cwd: androidDir,
    env: {
      ...process.env,
      ANDROID_HOME: '/opt/android-sdk',
      ANDROID_SDK_ROOT: '/opt/android-sdk',
      GRADLE_OPTS: '-Xmx2048m',
    },
    timeout: 600000,
  });

  return path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
}

export async function syncCapacitor(buildDir: string): Promise<void> {
  await execAsync('npx cap sync android', { cwd: buildDir, timeout: 120000 });
}
