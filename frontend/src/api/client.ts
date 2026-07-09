import type { BuildConfig, BuildStatus, SitePreview } from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function submitBuild(config: BuildConfig): Promise<{ taskId: string; status: string; estimatedTime: string }> {
  return request('/build', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function getBuildStatus(taskId: string): Promise<BuildStatus> {
  return request(`/build/${taskId}`);
}

export function getDownloadUrl(taskId: string): string {
  return `${API_BASE}/build/${taskId}/download`;
}

export async function previewSite(url: string): Promise<SitePreview> {
  return request('/preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}
