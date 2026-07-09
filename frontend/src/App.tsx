import { useState } from 'react';
import { previewSite } from './api/client';
import type { SitePreview as SitePreviewType, BuildConfig } from './types';
import UrlInput from './components/UrlInput';
import SitePreview from './components/SitePreview';

export default function App() {
  const [preview, setPreview] = useState<SitePreviewType | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [config, setConfig] = useState<BuildConfig>({ url: '' });
  const [step, setStep] = useState<'input' | 'configure' | 'building' | 'done'>('input');

  const handleUrlSubmit = async (url: string) => {
    setConfig({ url });
    setPreviewLoading(true);
    setStep('configure');

    try {
      const info = await previewSite(url);
      setPreview(info);
    } catch (err: any) {
      console.error('Preview failed:', err.message);
      // Continue anyway — preview is non-blocking
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-center mb-2">HTML2APP</h1>
      <p className="text-gray-500 text-center mb-8">将任意网址转换为 Android APK</p>

      {step === 'input' && (
        <UrlInput onSubmit={handleUrlSubmit} loading={previewLoading} />
      )}

      {step === 'configure' && (
        <>
          <UrlInput onSubmit={handleUrlSubmit} loading={previewLoading} />
          <SitePreview preview={preview} loading={previewLoading} />
          {config.url && (
            <p className="mt-4 text-sm text-gray-400 text-center">
              目标: {config.url}
            </p>
          )}
        </>
      )}
    </div>
  );
}
