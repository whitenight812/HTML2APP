import type { SitePreview as SitePreviewType } from '../types';

interface Props {
  preview: SitePreviewType | null;
  loading: boolean;
}

export default function SitePreview({ preview, loading }: Props) {
  if (loading) {
    return (
      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-200 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-slate-200 rounded-lg w-2/5" />
            <div className="h-4 bg-slate-200 rounded-lg w-3/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
          {preview.favicon ? (
            <img
              src={preview.favicon}
              alt=""
              className="w-9 h-9 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 truncate text-lg leading-tight">
            {preview.title}
          </h3>
          <p className="text-sm text-slate-400 truncate mt-1.5 leading-tight">
            {preview.description || '暂无描述'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0 bg-white rounded-xl px-3 py-2 border border-slate-100 shadow-sm">
          <div
            className="w-3.5 h-3.5 rounded-full ring-2 ring-white"
            style={{ backgroundColor: preview.primaryColor }}
          />
          <span className="text-xs text-slate-500 font-mono font-medium">{preview.primaryColor}</span>
        </div>
      </div>
    </div>
  );
}
