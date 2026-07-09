import { useEffect, useRef } from 'react';

interface Props {
  apkUrl: string;
  taskId: string;
  onNewBuild: () => void;
}

export default function DownloadPanel({ apkUrl, taskId, onNewBuild }: Props) {
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Generate QR code lazily
    import('qrcode').then((QRCode) => {
      if (qrRef.current) {
        QRCode.toCanvas(qrRef.current, new URL(apkUrl, window.location.origin).href, {
          width: 160,
          margin: 2,
          color: { dark: '#1f2937', light: '#ffffff' },
        });
      }
    });
  }, [taskId, apkUrl]);

  return (
    <div className="mt-8 p-6 bg-white border border-green-200 rounded-lg text-center">
      <div className="text-green-600 text-2xl mb-1">构建成功!</div>
      <p className="text-sm text-gray-500 mb-6">APK 已生成，请下载安装</p>

      {/* QR Code */}
      <div className="flex justify-center mb-4">
        <canvas ref={qrRef} />
      </div>
      <p className="text-xs text-gray-400 mb-6">手机扫码即可下载</p>

      {/* Download button */}
      <a
        href={apkUrl}
        className="inline-block px-8 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors mb-4"
        download
      >
        下载 APK
      </a>

      <div>
        <button
          onClick={onNewBuild}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          制作另一个 APK
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        下载链接有效期为 2 小时
      </p>
    </div>
  );
}
