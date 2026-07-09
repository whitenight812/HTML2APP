import type { SitePreview as SitePreviewType } from '../types';

interface Props {
  preview: SitePreviewType | null;
  loading: boolean;
}

export default function SitePreview({ preview, loading }: Props) {
  if (loading) {
    return (
      <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-4">
        {preview.favicon && (
          <img
            src={preview.favicon}
            alt="favicon"
            className="w-12 h-12 rounded-lg object-contain bg-gray-100"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-gray-900 truncate">
            {preview.title}
          </h3>
          {preview.description && (
            <p className="text-sm text-gray-500 truncate mt-1">{preview.description}</p>
          )}
        </div>
        {preview.primaryColor && (
          <div
            className="w-8 h-8 rounded-full border border-gray-200 flex-shrink-0"
            style={{ backgroundColor: preview.primaryColor }}
            title={`主题色: ${preview.primaryColor}`}
          />
        )}
      </div>
    </div>
  );
}
