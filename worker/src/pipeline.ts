import path from 'path';
import type { BuildConfig } from '../../shared/types';
import { createTemplate } from './templateManager';
import { scrapeSiteInfo } from './siteScraper';
import { generateIcons } from './iconGenerator';
import { injectConfig } from './configInjector';
import { injectJSBridge } from './jsBridge';
import { buildApk, syncCapacitor } from './gradleBuilder';
import { signApk } from './signer';

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

export interface PipelineResult {
  apkPath: string;
  appName: string;
  buildDir: string;
}

export async function runPipeline(
  taskId: string,
  config: BuildConfig,
  job: { updateProgress: (value: { progress: number; step: string }) => Promise<void> }
): Promise<PipelineResult> {
  // Step 1: Initialize (0-10%)
  await job.updateProgress({ progress: 5, step: '创建构建环境...' });
  const buildDir = await createTemplate(taskId);
  await job.updateProgress({ progress: 10, step: '模板初始化完成' });

  // Step 2: Scrape site info (10-20%)
  await job.updateProgress({ progress: 12, step: '正在访问目标网站...' });
  const siteInfo = await scrapeSiteInfo(config.url);
  await job.updateProgress({ progress: 20, step: '网站信息采集完成' });

  // Step 3: Inject configuration (20-50%)
  await job.updateProgress({ progress: 25, step: '正在注入应用配置...' });
  const appName = config.appName || siteInfo.title || 'My App';

  await injectConfig(buildDir, config, siteInfo);
  await job.updateProgress({ progress: 35, step: '正在生成图标...' });

  const androidResDir = path.join(buildDir, 'android', 'app', 'src', 'main', 'res');
  if (config.icon) {
    await generateIcons(config.icon, androidResDir);
  } else if (siteInfo.faviconUrl) {
    try {
      // SSRF guard: validate favicon hostname before fetching
      const faviconHostname = new URL(siteInfo.faviconUrl).hostname;
      if (!isPrivateHost(faviconHostname)) {
        const response = await fetch(siteInfo.faviconUrl, {
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          const iconBuffer = Buffer.from(await response.arrayBuffer());
          await generateIcons(iconBuffer, androidResDir);
        }
      }
    } catch {
      // Continue without custom icons
    }
  }
  await job.updateProgress({ progress: 42, step: '正在同步原生插件...' });

  // Sync Capacitor first so Java source dirs match the injected appId,
  // then inject the JS bridge so it can find MainActivity.java
  await syncCapacitor(buildDir);
  await job.updateProgress({ progress: 50, step: '正在注入JS桥接...' });
  await injectJSBridge(buildDir, config);
  await job.updateProgress({ progress: 55, step: '配置注入完成' });

  // Step 5: Build APK (55-90%)
  await job.updateProgress({ progress: 55, step: '正在编译APK (这可能需要几分钟)...' });
  const unsignedApkPath = await buildApk(buildDir);
  await job.updateProgress({ progress: 90, step: '编译完成' });

  // Step 6: Sign & finalize (90-100%)
  await job.updateProgress({ progress: 92, step: '正在签名APK...' });
  const outputPath = path.join(buildDir, `${taskId}.apk`);
  await signApk(unsignedApkPath, outputPath);
  await job.updateProgress({ progress: 100, step: '构建完成' });

  return { apkPath: outputPath, appName, buildDir };
}
