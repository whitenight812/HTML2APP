import { useState } from 'react';
import type { BuildConfig, Permission } from '../types';

interface Props {
  config: BuildConfig;
  onChange: (config: BuildConfig) => void;
}

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
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        {expanded ? '收起高级配置 ▲' : '展开高级配置 ▼'}
      </button>

      {expanded && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg space-y-5">
          {/* Permissions */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">权限设置</h4>
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'camera' as const, label: '相机' },
                { key: 'gps' as const, label: 'GPS定位' },
                { key: 'storage' as const, label: '文件读写' },
                { key: 'microphone' as const, label: '麦克风' },
              ]).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(config.permissions || []).includes(key)}
                    onChange={() => togglePermission(key)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Offline Cache */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.offlineCache || false}
                onChange={(e) =>
                  onChange({ ...config, offlineCache: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">启用离线缓存</span>
            </label>
          </div>

          {/* Pull to Refresh */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.theme?.pullToRefresh || false}
                onChange={(e) =>
                  onChange({
                    ...config,
                    theme: { ...config.theme, pullToRefresh: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">启用下拉刷新</span>
            </label>
          </div>

          {/* Dark Mode */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.theme?.darkMode || false}
                onChange={(e) =>
                  onChange({
                    ...config,
                    theme: { ...config.theme, darkMode: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">强制深色模式</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
