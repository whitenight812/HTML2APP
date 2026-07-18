import fs from 'fs/promises';
import path from 'path';
import type { BuildConfig } from '../../shared/types';
import type { SiteInfo } from './siteScraper';

const PERMISSION_MAP: Record<string, string> = {
  camera: 'android.permission.CAMERA',
  gps: 'android.permission.ACCESS_FINE_LOCATION',
  storage: 'android.permission.READ_EXTERNAL_STORAGE',
  microphone: 'android.permission.RECORD_AUDIO',
};

const PERMISSION_FEATURES: Record<string, string> = {
  camera: '<uses-feature android:name="android.hardware.camera" android:required="false"/>',
  gps: '<uses-feature android:name="android.hardware.location.gps" android:required="false"/>',
};

export async function injectConfig(
  buildDir: string,
  config: BuildConfig,
  siteInfo: SiteInfo
): Promise<void> {
  const appName = config.appName || siteInfo.title || 'My App';
  const primaryColor = config.theme?.primaryColor || config.splashBackground || siteInfo.primaryColor;

  // 1. Update capacitor.config.json
  const capConfigPath = path.join(buildDir, 'capacitor.config.json');
  const capConfig = JSON.parse(await fs.readFile(capConfigPath, 'utf-8'));
  capConfig.appName = appName;
  capConfig.appId = buildAppId(appName);
  capConfig.server = {
    url: config.url,
    cleartext: true,
    androidScheme: 'https',
  };
  await fs.writeFile(capConfigPath, JSON.stringify(capConfig, null, 2));

  // 2. Update AndroidManifest.xml with permissions
  const manifestPath = path.join(
    buildDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'
  );
  let manifest = await fs.readFile(manifestPath, 'utf-8');

  // Remove the default internet permission insertion point and add all at once
  const permissions = config.permissions || [];
  const permEntries = ['<uses-permission android:name="android.permission.INTERNET"/>',
    ...permissions.map(p => `<uses-permission android:name="${PERMISSION_MAP[p]}"/>`),
    ...permissions.filter(p => p in PERMISSION_FEATURES).map(p => PERMISSION_FEATURES[p]),
  ];

  const permBlock = permEntries.map(p => `    ${p}`).join('\n');
  manifest = manifest.replace(
    /<uses-permission android:name="android.permission.INTERNET"\/>/,
    permBlock
  );
  await fs.writeFile(manifestPath, manifest);

  // 3. Update strings.xml with app name
  const stringsPath = path.join(
    buildDir, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'
  );
  let strings = await fs.readFile(stringsPath, 'utf-8');
  strings = strings.replace(/>[^<]+<\/string>/g, `>${appName}</string>`);
  await fs.writeFile(stringsPath, strings);

  // 4. Inject theme colors into styles.xml
  const stylesPath = path.join(
    buildDir, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'
  );
  let styles = await fs.readFile(stylesPath, 'utf-8');
  styles = styles.replace(
    /<item name="colorPrimary">[^<]+<\/item>/,
    `<item name="colorPrimary">${primaryColor}</item>`
  );
  styles = styles.replace(
    /<item name="colorPrimaryDark">[^<]+<\/item>/,
    `<item name="colorPrimaryDark">${darken(primaryColor)}</item>`
  );
  styles = styles.replace(
    /<item name="colorAccent">[^<]+<\/item>/,
    `<item name="colorAccent">${primaryColor}</item>`
  );
  await fs.writeFile(stylesPath, styles);

  // 5. Inject pull-to-refresh dependency if enabled
  if (config.theme?.pullToRefresh) {
    const gradlePath = path.join(buildDir, 'android', 'app', 'build.gradle');
    let gradle = await fs.readFile(gradlePath, 'utf-8');
    if (!gradle.includes('swiperefreshlayout')) {
      gradle = gradle.replace(
        /(dependencies\s*\{)/,
        '$1\n    implementation "androidx.swiperefreshlayout:swiperefreshlayout:1.1.0"'
      );
      await fs.writeFile(gradlePath, gradle);
    }
  }
}

export function buildAppId(appName: string): string {
  return `com.html2app.${sanitizePackageId(appName)}.b${Date.now().toString(36)}`;
}

function sanitizePackageId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30) || 'app';
}

/**
 * Directly inject appId into Android build files.
 *
 * Capacitor's `npx cap sync android` can silently skip propagating appId
 * changes from capacitor.config.json when the Android project was already
 * generated with a different package name.  This function force-updates
 * the two files that matter: build.gradle (applicationId) and
 * AndroidManifest.xml (the package attribute).
 */
export async function injectAppId(buildDir: string, appId: string): Promise<void> {
  // 1. build.gradle — applicationId line
  const gradlePath = path.join(buildDir, 'android', 'app', 'build.gradle');
  let gradle = await fs.readFile(gradlePath, 'utf-8');
  gradle = gradle.replace(
    /applicationId\s+["'][^"']+["']/,
    `applicationId "${appId}"`,
  );
  await fs.writeFile(gradlePath, gradle);

  // 2. AndroidManifest.xml — package attribute in <manifest>
  const manifestPath = path.join(
    buildDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml',
  );
  let manifest = await fs.readFile(manifestPath, 'utf-8');
  manifest = manifest.replace(
    /package\s*=\s*"[^"]*"/,
    `package="${appId}"`,
  );
  await fs.writeFile(manifestPath, manifest);
}

function darken(hex: string): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
