import { useState } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export default function UrlInput({ onSubmit, loading }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let normalizedUrl = url.trim();
    if (!normalizedUrl) {
      setError('请输入网址');
      return;
    }

    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      setError('网址格式不正确，请输入完整网址');
      return;
    }

    onSubmit(normalizedUrl);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label className="block text-sm font-semibold text-slate-500 mb-3 uppercase tracking-widest text-[11px]">
        目标网址
      </label>
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            placeholder="输入网站地址，例如 example.com"
            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl
                       focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50
                       outline-none text-slate-800 text-base placeholder:text-slate-400
                       transition-all duration-200"
            disabled={loading}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-7 py-4 bg-indigo-500 text-white font-bold rounded-2xl
                     hover:bg-indigo-600 active:scale-95
                     disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30
                     transition-all duration-200 text-sm tracking-wide"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              分析中
            </span>
          ) : '开始'}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-500 flex items-center gap-1.5">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          {error}
        </p>
      )}
    </form>
  );
}
