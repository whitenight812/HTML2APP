import { useEffect } from 'react';
import type { BuildStatus } from '../types';

interface Props {
  status: BuildStatus | null;
  error: string | null;
  onDone: (apkUrl: string | null) => void;
}

const STEP_LABELS: Record<string, string> = {
  '创建构建环境...': '初始化构建环境',
  '正在访问目标网站...': '分析目标网站',
  '正在注入应用配置...': '配置应用参数',
  '正在生成图标...': '生成应用图标',
  '正在同步原生插件...': '同步原生模块',
  '正在注入JS桥接...': '注入交互桥接',
  '配置注入完成': '配置完成',
  '正在编译APK (这可能需要几分钟)...': '编译安装包',
  '编译完成': '编译完成',
  '正在签名APK...': '签名打包',
  '构建完成': '构建完成',
};

export default function BuildProgress({ status, error, onDone }: Props) {
  useEffect(() => {
    if (status?.status === 'done') {
      onDone(status.apkUrl);
    }
  }, [status?.status]);

  const progress = status?.progress ?? 0;
  const currentLabel = status?.currentStep || '准备中...';
  const displayLabel = STEP_LABELS[currentLabel] || currentLabel;

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-1">构建失败</h3>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      {/* Animated icon */}
      <div className="w-20 h-20 mx-auto mb-6 relative">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
        <svg
          className="absolute inset-0 w-full h-full animate-spin text-indigo-500"
          viewBox="0 0 80 80"
          style={{ animationDuration: '3s' }}
        >
          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="4"
            strokeDasharray={`${progress * 2.14} 214`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-indigo-500 tabular-nums">
            {progress}%
          </span>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-800 mb-1">正在构建 APK</h3>
      <p className="text-sm text-slate-500 mb-4">{displayLabel}</p>

      {/* Thin progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-indigo-400 to-violet-500 h-full rounded-full
                     transition-all duration-1000 ease-out"
          style={{ width: `${Math.max(progress, 2)}%` }}
        />
      </div>

      <p className="text-xs text-slate-400 mt-5">
        预计需要 3-5 分钟，喝杯水稍等片刻
      </p>
    </div>
  );
}
