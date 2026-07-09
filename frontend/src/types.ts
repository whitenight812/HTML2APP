export interface BuildConfig {
  url: string;
  appName?: string;
  icon?: string;
  splashBackground?: string;
  permissions?: string[];
  offlineCache?: boolean;
  pushNotifications?: {
    enabled: boolean;
    onesignalAppId?: string;
  };
  admob?: {
    enabled: boolean;
    bannerId?: string;
    interstitialId?: string;
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
