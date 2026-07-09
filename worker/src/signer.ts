import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function signApk(
  apkPath: string,
  outputPath: string
): Promise<string> {
  // For debug builds, the APK is already signed with the debug keystore by Gradle.
  // This function handles zipalign and copying to the output location.

  // Find zipalign (usually in Android SDK build-tools)
  const androidHome = process.env.ANDROID_HOME || '/opt/android-sdk';
  const buildToolsDir = path.join(androidHome, 'build-tools');

  // Find the latest build-tools version
  const entries = await fs.readdir(buildToolsDir);
  const latestBuildTools = entries
    .filter(e => /^\d+\.\d+\.\d+$/.test(e))
    .sort()
    .pop();

  const zipalign = path.join(buildToolsDir, latestBuildTools || '34.0.0', 'zipalign');

  const alignedPath = apkPath.replace('.apk', '-aligned.apk');

  try {
    await execAsync(`"${zipalign}" -v -p 4 "${apkPath}" "${alignedPath}"`);
  } catch {
    // zipalign might not be available — just copy the APK
    await fs.copyFile(apkPath, alignedPath);
  }

  // Copy to final output location
  await fs.copyFile(alignedPath, outputPath);

  return outputPath;
}
