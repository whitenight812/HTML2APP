import type { BuildConfig, SitePreview as SitePreviewType } from '../types';

interface Props {
  config: BuildConfig;
  onChange: (config: BuildConfig) => void;
  preview: SitePreviewType | null;
}

export default function BasicConfig({ config, onChange, preview }: Props) {
  const appName = config.appName ?? '';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        基础配置
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-2">
          App 名称
        </label>
        <input
          type="text"
          value={appName}
          onChange={(e) => onChange({ ...config, appName: e.target.value })}
          placeholder={preview?.title || '自动从网站标题获取'}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl
                     focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50
                     outline-none text-slate-800 placeholder:text-slate-300
                     transition-all duration-200 text-sm"
          maxLength={50}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-2">
          启动画面背景色
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={config.splashBackground || preview?.primaryColor || '#6366F1'}
            onChange={(e) => onChange({ ...config, splashBackground: e.target.value })}
            className="w-12 h-12 rounded-2xl cursor-pointer border-2 border-slate-200
                       hover:border-indigo-300 transition-colors bg-transparent"
          />
          <span className="text-sm text-slate-500 font-mono font-medium bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
            {config.splashBackground || preview?.primaryColor || '#6366F1'}
          </span>
        </div>
      </div>
    </div>
  );
}
