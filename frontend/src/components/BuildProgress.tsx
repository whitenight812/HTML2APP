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
  '正在注入JS桥接...': '注入交互桥接',
  '正在同步原生插件...': '同步原生模块',
  '正在编译APK': '编译安装包',
  '编译完成': '编译完成',
  '正在签名APK...': '签名打包',
  '构建完成': '即将完成',
};

export default function BuildProgress({ status, error, onDone }: Props) {
  useEffect(() => {
    if (status?.status === 'done') {
      onDone(status.apkUrl);
    }
  }, [status?.status]);

  const progress = status?.progress || 0;
  const currentLabel = status?.currentStep || '准备中...';
  const displayLabel = STEP_LABELS[currentLabel] || currentLabel;

  if (error) {
    return (
      <div className="mt-8 p-6 bg-white border border-red-200 rounded-lg text-center">
        <div className="text-red-600 text-lg mb-2">构建失败</div>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg">
      <h3 className="font-semibold text-gray-900 mb-4">正在构建 APK...</h3>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
        <div
          className="bg-blue-600 h-4 rounded-full transition-all duration-700 ease-in-out"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600">{displayLabel}</span>
        <span className="text-gray-400 font-mono">{progress}%</span>
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        预计需要 3-5 分钟，请耐心等待...
      </p>
    </div>
  );
}
