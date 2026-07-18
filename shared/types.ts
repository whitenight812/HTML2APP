// ============================================================
// Shared types used by backend, worker, and frontend
// Backend and worker import this directly (relative path)
// Frontend has its own copy in frontend/src/types.ts (mirrors these)
// ============================================================

export interface BuildConfig {
  url: string;
  appName?: string;
  icon?: string;              // base64 data URL or HTTP URL
  splashBackground?: string;  // hex color e.g. "#2196F3"
  permissions?: Permission[];
  offlineCache?: boolean;
  pushNotifications?: PushNotificationsConfig;
  admob?: AdMobConfig;
  theme?: ThemeConfig;
}

export type Permission = 'camera' | 'gps' | 'storage' | 'microphone';

export interface PushNotificationsConfig {
  enabled: boolean;
  onesignalAppId?: string;
  fcmSenderId?: string;
}

export interface AdMobConfig {
  enabled: boolean;
  bannerId?: string;
  interstitialId?: string;
  rewardedId?: string;
}

export interface ThemeConfig {
  primaryColor?: string;
  darkMode?: boolean;
  pullToRefresh?: boolean;
  forceMobileViewport?: boolean;
}

export interface SitePreview {
  title: string;
  favicon: string;
  primaryColor: string;
  description: string;
}

export interface BuildStatus {
  taskId: string;
  status: 'queued' | 'building' | 'signing' | 'done' | 'failed';
  progress: number;           // 0-100
  currentStep: string;
  apkUrl: string | null;
  error: string | null;
}

export interface BuildJobData {
  taskId: string;
  config: BuildConfig;
}
