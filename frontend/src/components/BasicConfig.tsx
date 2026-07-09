import type { BuildConfig, SitePreview as SitePreviewType } from '../types';

interface Props {
  config: BuildConfig;
  onChange: (config: BuildConfig) => void;
  preview: SitePreviewType | null;
}

export default function BasicConfig({ config, onChange, preview }: Props) {
  const appName = config.appName || preview?.title || '';

  return (
    <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg space-y-4">
      <h3 className="font-semibold text-gray-900">基础配置</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">App 名称</label>
        <input
          type="text"
          value={appName}
          onChange={(e) => onChange({ ...config, appName: e.target.value })}
          placeholder="自动从网站抓取"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          maxLength={50}
        />
        {!config.appName && (
          <p className="text-xs text-gray-400 mt-1">
            留空则自动使用网站标题：{preview?.title || '(等待预览)'}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">启动画面背景色</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={config.splashBackground || preview?.primaryColor || '#2196F3'}
            onChange={(e) => onChange({ ...config, splashBackground: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer border border-gray-300"
          />
          <span className="text-sm text-gray-500 font-mono">
            {config.splashBackground || preview?.primaryColor || '#2196F3'}
          </span>
        </div>
      </div>
    </div>
  );
}
