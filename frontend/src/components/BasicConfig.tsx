import { useRef } from 'react';
import type { BuildConfig, SitePreview as SitePreviewType } from '../types';

interface Props {
  config: BuildConfig;
  onChange: (config: BuildConfig) => void;
  preview: SitePreviewType | null;
}

function resizeIcon(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 192;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      // Cover-crop to square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function BasicConfig({ config, onChange, preview }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appName = config.appName ?? '';

  const iconSrc = config.icon || preview?.favicon || null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeIcon(file);
      onChange({ ...config, icon: dataUrl });
    } catch {
      // Ignore invalid images
    }
    // Reset so re-uploading the same file works
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
          App 图标
        </label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300
                       hover:border-indigo-400 hover:bg-indigo-50/50
                       transition-all duration-200 overflow-hidden flex-shrink-0
                       focus:outline-none focus:ring-4 focus:ring-indigo-50"
          >
            {iconSrc ? (
              <img src={iconSrc} alt="App icon" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 group-hover:text-indigo-400 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-[10px] mt-0.5">上传</span>
              </div>
            )}
            {iconSrc && (
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100
                              transition-opacity flex items-center justify-center">
                <span className="text-white text-[10px] font-medium">更换</span>
              </div>
            )}
          </button>
          <div className="text-xs text-slate-400">
            <p>点击上传自定义图标</p>
            <p>建议 192x192 PNG，自动裁剪为正方形</p>
            {!config.icon && preview?.favicon && (
              <p className="text-slate-300 mt-0.5">当前使用网站 favicon</p>
            )}
            {config.icon && (
              <button
                type="button"
                onClick={() => onChange({ ...config, icon: undefined })}
                className="text-indigo-500 hover:text-indigo-600 mt-0.5"
              >
                恢复默认图标
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
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
