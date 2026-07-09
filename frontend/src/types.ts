export type Permission = 'camera' | 'gps' | 'storage' | 'microphone';

export interface BuildConfig {
  url: string;
  appName?: string;
  icon?: string;
  splashBackground?: string;
  permissions?: Permission[];
  offlineCache?: boolean;
  pushNotifications?: {
    enabled: boolean;
    onesignalAppId?: string;
    fcmSenderId?: string;
  };
  admob?: {
    enabled: boolean;
    bannerId?: string;
    interstitialId?: string;
    rewardedId?: string;
  };
  theme?: {
    primaryColor?: string;
    darkMode?: boolean;
    pullToRefresh?: boolean;
  };
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
  progress: number;
  currentStep: string;
  apkUrl: string | null;
  error: string | null;
  estimatedTime?: string;
}
