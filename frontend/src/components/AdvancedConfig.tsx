import { useState } from 'react';
import type { BuildConfig, Permission } from '../types';

interface Props {
  config: BuildConfig;
  onChange: (config: BuildConfig) => void;
}

const PERMISSION_OPTIONS: { key: Permission; label: string; desc: string }[] = [
  { key: 'camera', label: '相机', desc: '拍照和录像' },
  { key: 'gps', label: 'GPS 定位', desc: '获取设备位置' },
  { key: 'storage', label: '文件读写', desc: '读取和保存文件' },
  { key: 'microphone', label: '麦克风', desc: '录音和语音' },
];

export default function AdvancedConfig({ config, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const togglePermission = (perm: Permission) => {
    const current = config.permissions || [];
    const next = current.includes(perm)
      ? current.filter(p => p !== perm)
      : [...current, perm];
    onChange({ ...config, permissions: next });
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider
                   hover:text-indigo-500 transition-colors group"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        高级配置
        <span className="text-[10px] text-slate-300 group-hover:text-indigo-400 transition-colors normal-case tracking-normal">
          {expanded ? '收起' : '展开'}
        </span>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          expanded ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-5">

            {/* Permissions */}
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-3">权限设置</h4>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_OPTIONS.map(({ key, label, desc }) => {
                  const checked = (config.permissions || []).includes(key);
                  return (
                    <label
                      key={key}
                      className={`
                        flex items-start gap-3 p-2.5 rounded-xl cursor-pointer border-2
                        transition-all duration-200
                        ${checked
                          ? 'border-indigo-200 bg-white shadow-sm'
                          : 'border-transparent hover:bg-white/60'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(key)}
                        className="mt-0.5 w-4 h-4 text-indigo-500 rounded focus:ring-indigo-400"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-700">{label}</div>
                        <div className="text-xs text-slate-400">{desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-200" />

            {/* Toggles */}
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-slate-700">离线缓存</div>
                  <div className="text-xs text-slate-400">无网络时也能打开应用</div>
                </div>
                <Toggle
                  checked={config.offlineCache || false}
                  onChange={(v) => onChange({ ...config, offlineCache: v })}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-slate-700">下拉刷新</div>
                  <div className="text-xs text-slate-400">支持手势下拉重新加载</div>
                </div>
                <Toggle
                  checked={config.theme?.pullToRefresh || false}
                  onChange={(v) => onChange({ ...config, theme: { ...config.theme, pullToRefresh: v } })}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm font-medium text-slate-700">强制深色模式</div>
                  <div className="text-xs text-slate-400">应用始终显示深色界面</div>
                </div>
                <Toggle
                  checked={config.theme?.darkMode || false}
                  onChange={(v) => onChange({ ...config, theme: { ...config.theme, darkMode: v } })}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none
        ${checked ? 'bg-indigo-500' : 'bg-slate-300'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
          ring-0 transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}
