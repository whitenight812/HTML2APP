import { useEffect, useRef } from 'react';

interface Props {
  apkUrl: string;
  taskId: string;
  onNewBuild: () => void;
}

export default function DownloadPanel({ apkUrl, taskId, onNewBuild }: Props) {
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    import('qrcode').then((QRCode) => {
      if (qrRef.current) {
        QRCode.toCanvas(qrRef.current, new URL(apkUrl, window.location.origin).href, {
          width: 176,
          margin: 1,
          color: { dark: '#1e1b4b', light: '#ffffff' },
        });
      }
    });
  }, [taskId, apkUrl]);

  return (
    <div className="text-center py-4">
      {/* Success icon */}
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-50 flex items-center justify-center">
        <svg className="w-9 h-9 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h3 className="text-xl font-semibold text-slate-800 mb-1">构建完成</h3>
      <p className="text-sm text-slate-500 mb-6">APK 安装包已生成，扫描二维码或点击下载</p>

      {/* QR Code */}
      <div className="inline-block p-3 bg-white rounded-2xl border border-slate-100 shadow-sm mb-4">
        <canvas ref={qrRef} className="block" />
      </div>

      <div>
        <a
          href={apkUrl}
          className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-500 text-white font-semibold
                     rounded-xl hover:bg-indigo-600 active:scale-95
                     shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
                     transition-all duration-200 text-sm tracking-wide"
          download
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载 APK
        </a>
      </div>

      <div className="mt-4">
        <button
          onClick={onNewBuild}
          className="text-sm text-slate-400 hover:text-indigo-500 transition-colors"
        >
          制作另一个 APK
        </button>
      </div>

      <p className="text-xs text-slate-300 mt-4">
        下载链接有效期为 2 小时
      </p>
    </div>
  );
}
