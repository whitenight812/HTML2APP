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

export default function App() {
  const [preview, setPreview] = useState<SitePreviewType | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [config, setConfig] = useState<BuildConfig>({ url: '' });
  const [step, setStep] = useState<'input' | 'configure' | 'building' | 'done'>('input');
  const [taskId, setTaskId] = useState<string | null>(null);
  const { status, error } = useBuildTask(taskId);

  const handleUrlSubmit = async (url: string) => {
    const newConfig: BuildConfig = { url };
    setConfig(newConfig);
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

  // Transition from building to done when build completes
  useEffect(() => {
    if (step === 'building' && status?.status === 'done' && status.apkUrl) {
      setStep('done');
    }
  }, [step, status]);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-center mb-2">HTML2APP</h1>
      <p className="text-gray-500 text-center mb-8">将任意网址转换为 Android APK</p>

      {(step === 'input' || step === 'configure') && (
        <>
          <UrlInput onSubmit={handleUrlSubmit} loading={previewLoading} />
          <SitePreview preview={preview} loading={previewLoading} />

          {step === 'configure' && preview && (
            <div className="mt-6 space-y-4">
              <BasicConfig config={config} onChange={setConfig} preview={preview} />
              <AdvancedConfig config={config} onChange={setConfig} />

              <button
                onClick={handleBuild}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
            if (apkUrl) {
              setStep('done');
            }
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
  );
}
