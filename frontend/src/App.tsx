import { useState, useEffect } from 'react';
import { previewSite, submitBuild } from './api/client';
import type { SitePreview as SitePreviewType, BuildConfig } from './types';
import UrlInput from './components/UrlInput';
import SitePreview from './components/SitePreview';
import BasicConfig from './components/BasicConfig';
import AdvancedConfig from './components/AdvancedConfig';
import BuildProgress from './components/BuildProgress';
import DownloadPanel from './components/DownloadPanel';
import { useBuildTask } from './hooks/useBuildTask';

const STEPS = [
  { key: 'input', label: '输入网址' },
  { key: 'configure', label: '应用配置' },
  { key: 'building', label: '构建打包' },
  { key: 'done', label: '下载安装' },
] as const;

export default function App() {
  const [preview, setPreview] = useState<SitePreviewType | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [config, setConfig] = useState<BuildConfig>({ url: '' });
  const [step, setStep] = useState<'input' | 'configure' | 'building' | 'done'>('input');
  const [taskId, setTaskId] = useState<string | null>(null);
  const { status, error } = useBuildTask(taskId);

  const handleUrlSubmit = async (url: string) => {
    config.url = url;
    setConfig({ ...config });
    setPreviewLoading(true);
    setStep('configure');

    try {
      const info = await previewSite(url);
      setPreview(info);
    } catch {
      // Preview is non-blocking
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBuild = async () => {
    setStep('building');
    try {
      const result = await submitBuild(config);
      setTaskId(result.taskId);
    } catch (err: any) {
      console.error('Build submission failed:', err.message);
      setStep('configure');
    }
  };

  useEffect(() => {
    if (step === 'building' && status?.status === 'done' && status.apkUrl) {
      setStep('done');
    }
  }, [step, status]);

  const currentStepIdx = STEPS.findIndex(s => s.key === step);

  return (
    <div className="w-full max-w-2xl px-6 py-12 sm:py-16">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-14">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-2">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-500 ease-out
                  ${i < currentStepIdx
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                    : i === currentStepIdx
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 ring-4 ring-indigo-100 scale-110'
                    : 'bg-white border-2 border-slate-200 text-slate-400'
                  }
                `}
              >
                {i < currentStepIdx ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-semibold whitespace-nowrap transition-colors duration-500 ${
                  i <= currentStepIdx ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={`w-14 sm:w-20 h-0.5 mx-2 mb-6 rounded transition-colors duration-500 ${
                  i < currentStepIdx ? 'bg-indigo-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 mb-4">
          HTML2APP
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed">
          输入一个网址，自动打包为 Android 应用安装包
        </p>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 sm:p-10">

        {(step === 'input' || step === 'configure') && (
          <>
            <UrlInput onSubmit={handleUrlSubmit} loading={previewLoading} />

            <div className="mt-8">
              <SitePreview preview={preview} loading={previewLoading} />
            </div>

            {step === 'configure' && preview && (
              <div className="mt-10 space-y-8">
                <BasicConfig config={config} onChange={setConfig} preview={preview} />
                <AdvancedConfig config={config} onChange={setConfig} />

                <button
                  onClick={handleBuild}
                  className="w-full py-4 bg-indigo-500 text-white font-bold rounded-2xl
                            hover:bg-indigo-600 active:scale-[0.98]
                            shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
                            transition-all duration-200 text-lg tracking-wide"
                >
                  开始构建 APK
                </button>
              </div>
            )}
          </>
        )}

        {step === 'building' && taskId && (
          <BuildProgress
            status={status}
            error={error}
            onDone={(apkUrl) => {
              if (apkUrl) setStep('done');
            }}
          />
        )}

        {step === 'done' && status?.apkUrl && taskId && (
          <DownloadPanel
            apkUrl={status.apkUrl}
            taskId={taskId}
            onNewBuild={() => {
              setStep('input');
              setTaskId(null);
              setPreview(null);
              setConfig({ url: '' });
            }}
          />
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400 mt-8">
        生成的 APK 保留 2 小时后自动删除
      </p>
    </div>
  );
}
