# HTML2APP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web tool where users input a URL and get a downloadable Android APK that wraps the website in a WebView, with optional native features.

**Architecture:** Monorepo with three packages — `frontend` (React + Vite + Tailwind), `backend` (Node.js + Fastify + BullMQ), `worker` (Capacitor + Android SDK + Gradle in Docker). Frontend talks to backend via REST API. Backend enqueues build jobs into Redis-backed BullMQ queue. Worker containers consume jobs, generate APKs, and upload results.

**Tech Stack:** TypeScript throughout, React 18, Vite 5, Tailwind CSS 3, Fastify 4, BullMQ, Redis 7, Capacitor 6, Android SDK 34, Gradle 8, Docker, Puppeteer (for site preview)

## Global Constraints

- All code in TypeScript with strict mode enabled
- Frontend runs on port 5173 (dev), backend on port 3000, Redis on port 6379
- Generated APKs stored in `backend/uploads/` directory, auto-cleaned after 2 hours
- Worker runs exclusively in Docker (no bare-metal Gradle)
- Minimum Node.js version: 20 LTS
- All API responses use JSON with `Content-Type: application/json`
- APK build timeout: 10 minutes (hard limit per job)

---

## File Structure

```
HTML2APP/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── types.ts
│   │   ├── api/client.ts
│   │   ├── components/
│   │   │   ├── UrlInput.tsx
│   │   │   ├── SitePreview.tsx
│   │   │   ├── BasicConfig.tsx
│   │   │   ├── AdvancedConfig.tsx
│   │   │   ├── BuildProgress.tsx
│   │   │   └── DownloadPanel.tsx
│   │   └── hooks/useBuildTask.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── routes/build.ts
│   │   ├── routes/preview.ts
│   │   ├── queue/buildQueue.ts
│   │   └── storage/apkStorage.ts
│   ├── package.json
│   └── tsconfig.json
├── worker/
│   ├── src/
│   │   ├── index.ts
│   │   ├── pipeline.ts
│   │   ├── siteScraper.ts
│   │   ├── templateManager.ts
│   │   ├── configInjector.ts
│   │   ├── iconGenerator.ts
│   │   ├── jsBridge.ts
│   │   ├── gradleBuilder.ts
│   │   └── signer.ts
│   ├── template/
│   │   └── (pre-built Capacitor Android project — copied at build time)
│   ├── docker/Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
└── .gitignore
```

---

### Task 1: Project Scaffold & Monorepo Setup

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`
- Create: `backend/src/config.ts`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/types.ts`
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`

**Interfaces:**
- Consumes: nothing
- Produces: Root package.json with workspace scripts, all three package.json files with correct dependencies, basic server that responds to health check

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "html2app",
  "private": true,
  "scripts": {
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    "build:worker": "cd worker && npm run build"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
.env
*.apk
*.aab
backend/uploads/
worker/template/android/app/build/
worker/template/android/build/
worker/template/android/.gradle/
worker/template/android/capacitor-cordova-android-plugins/
worker/template/node_modules/
```

- [ ] **Step 3: Create backend/package.json**

```json
{
  "name": "html2app-backend",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.1",
    "@fastify/multipart": "^8.1.0",
    "@fastify/static": "^7.0.4",
    "bullmq": "^5.1.0",
    "fastify": "^4.26.0",
    "ioredis": "^5.3.2",
    "sharp": "^0.33.2",
    "uuid": "^9.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/uuid": "^9.0.7",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 4: Create backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Create backend/src/config.ts**

```typescript
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  apkRetentionMs: 2 * 60 * 60 * 1000, // 2 hours
  buildTimeoutMs: 10 * 60 * 1000, // 10 minutes
};
```

- [ ] **Step 6: Create backend/src/index.ts (health check server)**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: true });

  app.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Backend running on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 7: Create frontend/package.json**

```json
{
  "name": "html2app-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "qrcode": "^1.5.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.12"
  }
}
```

- [ ] **Step 8: Create frontend/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 9: Create frontend/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

- [ ] **Step 10: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HTML2APP - 网址转APP</title>
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  </head>
  <body class="bg-gray-50 min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11: Create frontend/src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 12: Create frontend/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 13: Create frontend/src/App.tsx (placeholder)**

```tsx
export default function App() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">HTML2APP</h1>
      <p className="text-gray-500 text-center">将任意网址转换为 Android APK</p>
    </div>
  );
}
```

- [ ] **Step 14: Create frontend/src/types.ts**

```typescript
export interface BuildConfig {
  url: string;
  appName?: string;
  icon?: string;
  splashBackground?: string;
  permissions?: string[];
  offlineCache?: boolean;
  pushNotifications?: {
    enabled: boolean;
    onesignalAppId?: string;
  };
  admob?: {
    enabled: boolean;
    bannerId?: string;
    interstitialId?: string;
  };
  theme?: {
    primaryColor?: string;
    darkMode?: boolean;
    pullToRefresh?: boolean;
  };
}

export interface SitePreview {
  title: string;
  favicon: string;
  primaryColor: string;
  description: string;
}

export interface BuildStatus {
  taskId: string;
  status: 'queued' | 'building' | 'signing' | 'done' | 'failed';
  progress: number;
  currentStep: string;
  apkUrl: string | null;
  error: string | null;
  estimatedTime?: string;
}
```

- [ ] **Step 15: Create worker/package.json**

```json
{
  "name": "html2app-worker",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.2",
    "puppeteer": "^22.1.0",
    "sharp": "^0.33.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/uuid": "^9.0.7",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 16: Create worker/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 17: Install all dependencies**

Run: `cd c:/Users/whitenight/Desktop/HTML2APP/backend && npm install`
Run: `cd c:/Users/whitenight/Desktop/HTML2APP/frontend && npm install`
Run: `cd c:/Users/whitenight/Desktop/HTML2APP/worker && npm install`

- [ ] **Step 18: Verify backend starts**

Run: `cd c:/Users/whitenight/Desktop/HTML2APP/backend && npx tsx src/index.ts`
Expected: "Backend running on port 3000"
Then test: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok","timestamp":...}`
Stop the server after verification.

- [ ] **Step 19: Verify frontend starts**

Run: `cd c:/Users/whitenight/Desktop/HTML2APP/frontend && npm run dev`
Expected: Vite dev server starts on port 5173
Open `http://localhost:5173` in browser — should see "HTML2APP" title.
Stop the dev server after verification.

- [ ] **Step 20: Commit**

```bash
git add -A
git commit -m "feat: project scaffold with backend, frontend, and worker packages"
```

---

### Task 2: Shared Types Package

**Files:**
- Create: `shared/types.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `BuildConfig`, `SitePreview`, `BuildStatus`, `BuildJobData` types exported for backend and worker use

- [ ] **Step 1: Create shared/types.ts**

```typescript
// ============================================================
// Shared types used by backend, worker, and frontend
// Backend and worker import this directly (relative path)
// Frontend has its own copy in frontend/src/types.ts (mirrors these)
// ============================================================

export interface BuildConfig {
  url: string;
  appName?: string;
  icon?: string;              // base64 data URL or HTTP URL
  splashBackground?: string;  // hex color e.g. "#2196F3"
  permissions?: Permission[];
  offlineCache?: boolean;
  pushNotifications?: PushNotificationsConfig;
  admob?: AdMobConfig;
  theme?: ThemeConfig;
}

export type Permission = 'camera' | 'gps' | 'storage' | 'microphone';

export interface PushNotificationsConfig {
  enabled: boolean;
  onesignalAppId?: string;
  fcmSenderId?: string;
}

export interface AdMobConfig {
  enabled: boolean;
  bannerId?: string;
  interstitialId?: string;
  rewardedId?: string;
}

export interface ThemeConfig {
  primaryColor?: string;
  darkMode?: boolean;
  pullToRefresh?: boolean;
}

export interface SitePreview {
  title: string;
  favicon: string;
  primaryColor: string;
  description: string;
}

export interface BuildStatus {
  taskId: string;
  status: 'queued' | 'building' | 'signing' | 'done' | 'failed';
  progress: number;           // 0-100
  currentStep: string;
  apkUrl: string | null;
  error: string | null;
}

export interface BuildJobData {
  taskId: string;
  config: BuildConfig;
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

### Task 3: Backend — Build Queue Setup

**Files:**
- Create: `backend/src/queue/buildQueue.ts`
- Modify: `backend/src/index.ts` (import and initialize queue)

**Interfaces:**
- Consumes: `BuildJobData` from `shared/types.ts`, `config` from `backend/src/config.ts`
- Produces: `buildQueue` (BullMQ Queue instance), `addBuildJob(config: BuildConfig): Promise<string>`, `getJobStatus(taskId: string): Promise<BuildStatus | null>`

- [ ] **Step 1: Create backend/src/queue/buildQueue.ts**

```typescript
import { Queue, Job, Worker } from 'bullmq';
import { config } from '../config';
import type { BuildJobData, BuildStatus } from '../../../shared/types';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

export const buildQueue = new Queue<BuildJobData>('build-apk', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    timeout: config.buildTimeoutMs,
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

export async function addBuildJob(
  taskId: string,
  buildConfig: BuildJobData['config']
): Promise<void> {
  await buildQueue.add('build', { taskId, config: buildConfig }, { jobId: taskId });
}

export function getJobProgress(job: Job): number {
  if (typeof job.progress === 'number') return job.progress;
  // BullMQ progress can be an object: { progress: number }
  if (job.progress && typeof job.progress === 'object' && 'progress' in job.progress) {
    return (job.progress as { progress: number }).progress;
  }
  return 0;
}

export function getJobStep(job: Job): string {
  if (job.progress && typeof job.progress === 'object' && 'step' in job.progress) {
    return (job.progress as { step: string }).step;
  }
  return '';
}

export async function getJobStatus(taskId: string): Promise<BuildStatus | null> {
  const job = await buildQueue.getJob(taskId);
  if (!job) return null;

  const state = await job.getState();
  const statusMap: Record<string, BuildStatus['status']> = {
    waiting: 'queued',
    active: 'building',
    completed: 'done',
    failed: 'failed',
    delayed: 'queued',
    paused: 'queued',
  };

  const isCompleted = state === 'completed';
  return {
    taskId,
    status: statusMap[state] || 'queued',
    progress: isCompleted ? 100 : getJobProgress(job),
    currentStep: isCompleted ? '完成' : getJobStep(job) || '等待中...',
    apkUrl: job.returnvalue?.apkUrl || null,
    error: job.failedReason || null,
  };
}
```

- [ ] **Step 2: Update backend/src/index.ts to test queue connection**

Add after the `cors` registration line:

```typescript
import { buildQueue } from './queue/buildQueue';

// ... inside start() function, after cors registration:

// Verify Redis connection
app.get('/api/health', async () => {
  let redisOk = false;
  try {
    await buildQueue.client.ping();
    redisOk = true;
  } catch {}
  return { status: redisOk ? 'ok' : 'degraded', redis: redisOk, timestamp: Date.now() };
});
```

- [ ] **Step 3: Verify Redis connection (requires Redis running locally or via Docker)**

Run Redis: `docker run -d --name redis -p 6379:6379 redis:7-alpine`
Then: `cd backend && npx tsx src/index.ts`
Test: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok","redis":true,...}`

- [ ] **Step 4: Commit**

```bash
git add backend/src/queue/buildQueue.ts backend/src/index.ts
git commit -m "feat: add BullMQ build queue with Redis connection"
```

---

### Task 4: Backend — POST /api/preview (Website Preview)

**Files:**
- Create: `backend/src/routes/preview.ts`
- Modify: `backend/src/index.ts` (register preview route)

**Interfaces:**
- Consumes: `config` from `backend/src/config.ts`, `SitePreview` from `shared/types.ts`
- Produces: `POST /api/preview` — accepts `{ url: string }`, returns `SitePreview`

- [ ] **Step 1: Create backend/src/routes/preview.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const previewSchema = z.object({
  url: z.string().url('请提供有效的网址'),
});

export async function previewRoutes(app: FastifyInstance) {
  app.post('/api/preview', async (request, reply) => {
    const parsed = previewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { url } = parsed.data;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'HTML2APP-Bot/1.0' },
        redirect: 'follow',
      });

      if (!response.ok) {
        return reply.status(400).send({ error: `无法访问目标网站 (HTTP ${response.status})` });
      }

      const html = await response.text();

      // Extract <title>
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch?.[1]?.trim() || new URL(url).hostname;

      // Extract <meta name="description">
      const descMatch = html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
      );
      const description = descMatch?.[1] || '';

      // Extract favicon
      const faviconMatch = html.match(
        /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i
      );
      let favicon = faviconMatch?.[1] || '';
      if (favicon && !favicon.startsWith('http')) {
        favicon = new URL(favicon, url).href;
      }
      if (!favicon) {
        favicon = new URL('/favicon.ico', url).href;
      }

      // Extract theme color
      const colorMatch = html.match(
        /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i
      );
      const primaryColor = colorMatch?.[1] || '#2196F3';

      return { title, favicon, primaryColor, description };
    } catch (err: any) {
      if (err.cause?.code === 'ENOTFOUND' || err.message?.includes('fetch')) {
        return reply.status(400).send({ error: '无法解析该域名，请检查网址是否正确' });
      }
      return reply.status(500).send({ error: '预览失败，请稍后重试' });
    }
  });
}
```

- [ ] **Step 2: Register route in backend/src/index.ts**

Add after the cors and health check lines:

```typescript
import { previewRoutes } from './routes/preview';

// inside start(), after app.register(cors, ...):
await app.register(previewRoutes);
```

- [ ] **Step 3: Test the endpoint**

Start server: `cd backend && npx tsx src/index.ts`
Test: `curl -X POST http://localhost:3000/api/preview -H "Content-Type: application/json" -d '{"url":"https://example.com"}'`
Expected: JSON with title, favicon, primaryColor, description fields.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/preview.ts backend/src/index.ts
git commit -m "feat: add POST /api/preview for website metadata extraction"
```

---

### Task 5: Backend — Build Routes (POST /api/build + GET status + GET download)

**Files:**
- Create: `backend/src/routes/build.ts`
- Create: `backend/src/storage/apkStorage.ts`
- Modify: `backend/src/index.ts` (register build routes and static file serving)

**Interfaces:**
- Consumes: `buildQueue`, `addBuildJob`, `getJobStatus` from `backend/src/queue/buildQueue.ts`, `config` from `backend/src/config.ts`
- Produces: `POST /api/build`, `GET /api/build/:taskId`, `GET /api/build/:taskId/download`

- [ ] **Step 1: Create backend/src/storage/apkStorage.ts**

```typescript
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

export function getApkPath(taskId: string): string {
  return path.join(config.uploadDir, `${taskId}.apk`);
}

export async function apkExists(taskId: string): Promise<boolean> {
  try {
    await fs.access(getApkPath(taskId));
    return true;
  } catch {
    return false;
  }
}

export async function scheduleCleanup(taskId: string): Promise<void> {
  setTimeout(async () => {
    try {
      await fs.unlink(getApkPath(taskId));
    } catch {
      // File already gone — nothing to do
    }
  }, config.apkRetentionMs);
}

// Clean up any leftover APKs on startup
export async function cleanupStaleApks(): Promise<void> {
  await ensureUploadDir();
  const files = await fs.readdir(config.uploadDir);
  const now = Date.now();
  for (const file of files) {
    const filePath = path.join(config.uploadDir, file);
    try {
      const stat = await fs.stat(filePath);
      if (now - stat.mtimeMs > config.apkRetentionMs) {
        await fs.unlink(filePath);
      }
    } catch {
      // skip
    }
  }
}
```

- [ ] **Step 2: Create backend/src/routes/build.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { addBuildJob, getJobStatus } from '../queue/buildQueue';
import { ensureUploadDir, getApkPath, apkExists, scheduleCleanup } from '../storage/apkStorage';
import type { BuildConfig } from '../../../shared/types';

const buildSchema = z.object({
  url: z.string().url('请提供有效的网址'),
  appName: z.string().max(50).optional(),
  icon: z.string().optional(),
  splashBackground: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  permissions: z.array(z.enum(['camera', 'gps', 'storage', 'microphone'])).optional(),
  offlineCache: z.boolean().optional(),
  pushNotifications: z.object({
    enabled: z.boolean(),
    onesignalAppId: z.string().optional(),
    fcmSenderId: z.string().optional(),
  }).optional(),
  admob: z.object({
    enabled: z.boolean(),
    bannerId: z.string().optional(),
    interstitialId: z.string().optional(),
    rewardedId: z.string().optional(),
  }).optional(),
  theme: z.object({
    primaryColor: z.string().optional(),
    darkMode: z.boolean().optional(),
    pullToRefresh: z.boolean().optional(),
  }).optional(),
});

export async function buildRoutes(app: FastifyInstance) {
  await ensureUploadDir();

  // POST /api/build — submit a build job
  app.post('/api/build', async (request, reply) => {
    const parsed = buildSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: '参数验证失败',
        details: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      });
    }

    const taskId = uuidv4();
    const config = parsed.data as BuildConfig;

    await addBuildJob(taskId, config);

    return {
      taskId,
      status: 'queued' as const,
      estimatedTime: '3-5分钟',
    };
  });

  // GET /api/build/:taskId — query build status
  app.get('/api/build/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const status = await getJobStatus(taskId);

    if (!status) {
      return reply.status(404).send({ error: '任务不存在或已过期' });
    }

    return status;
  });

  // GET /api/build/:taskId/download — download the APK
  app.get('/api/build/:taskId/download', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };

    const exists = await apkExists(taskId);
    if (!exists) {
      return reply.status(404).send({ error: 'APK 文件不存在或已过期' });
    }

    const filePath = getApkPath(taskId);
    // Schedule cleanup after download
    scheduleCleanup(taskId);
    return reply.type('application/vnd.android.package-archive').send(
      await require('fs/promises').readFile(filePath)
    );
  });
}
```

- [ ] **Step 3: Register build routes in backend/src/index.ts**

```typescript
import { buildRoutes } from './routes/build';
import { cleanupStaleApks } from './storage/apkStorage';

// inside start():
await cleanupStaleApks();
await app.register(buildRoutes);
```

- [ ] **Step 4: Test the build submission endpoint**

Start server: `cd backend && npx tsx src/index.ts`
Test: `curl -X POST http://localhost:3000/api/build -H "Content-Type: application/json" -d '{"url":"https://example.com"}'`
Expected: JSON with taskId, status "queued", estimatedTime.
Take note of the taskId and test status: `curl http://localhost:3000/api/build/<taskId>`
Expected: Job returns queued/failed status (failed since no worker yet).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/build.ts backend/src/storage/apkStorage.ts backend/src/index.ts
git commit -m "feat: add build submission, status query, and APK download routes"
```

---

### Task 6: Worker — Docker Image with Android SDK

**Files:**
- Create: `worker/docker/Dockerfile`
- Create: `worker/docker/android-sdk-accept-license.sh`

**Interfaces:**
- Consumes: nothing
- Produces: Docker image `html2app-worker` with Node.js 20, Android SDK 34, Gradle 8, Capacitor CLI

- [ ] **Step 1: Create worker/docker/Dockerfile**

```dockerfile
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    unzip \
    git \
    openjdk-17-jdk-headless \
    nodejs \
    npm \
    libgtk-3-0 \
    libasound2 \
    libnss3 \
    libxss1 \
    libxtst6 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Install Capacitor CLI globally
RUN npm install -g @capacitor/cli@latest @capacitor/core@latest @capacitor/android@latest

# Install Android SDK command-line tools
RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdtools.zip && \
    unzip /tmp/cmdtools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools && \
    mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest && \
    rm /tmp/cmdtools.zip

# Accept Android SDK licenses
RUN yes | ${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager --licenses

# Install required SDK packages
RUN ${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager \
    "platform-tools" \
    "platforms;android-34" \
    "build-tools;34.0.0" \
    "extras;google;m2repository" \
    "extras;android;m2repository"

# Create working directory
WORKDIR /app

# Copy worker package files
COPY worker/package.json worker/package-lock.json* ./
RUN npm install

# Copy worker source
COPY worker/src/ ./src/
COPY worker/template/ ./template/
COPY shared/ ./shared/

RUN npm run build

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Commit**

```bash
git add worker/docker/Dockerfile
git commit -m "feat: add worker Docker image with Android SDK and Gradle"
```

---

### Task 7: Worker — Template Manager (Capacitor Android Template)

**Files:**
- Create: `worker/src/templateManager.ts`

**Interfaces:**
- Consumes: BuildJobData config
- Produces: `createTemplate(taskId: string): Promise<string>` — returns the path to a ready-to-configure Capacitor Android project

This task creates a pre-built Capacitor Android template in `worker/template/`. The template is a minimal Capacitor project. During runtime, `templateManager.ts` copies this template to a temp directory for each build.

- [ ] **Step 1: Create the template project structure**

Create the template by hand (since we can't run capacitor CLI here easily):

```
worker/template/
├── capacitor.config.json
├── package.json
└── android/
    ├── build.gradle
    ├── gradle.properties
    ├── gradle/
    │   └── wrapper/
    │       ├── gradle-wrapper.jar
    │       └── gradle-wrapper.properties
    ├── gradlew
    ├── gradlew.bat
    ├── settings.gradle
    ├── app/
    │   ├── build.gradle
    │   └── src/
    │       └── main/
    │           ├── AndroidManifest.xml
    │           ├── java/com/html2app/wrapper/
    │           │   └── MainActivity.java
    │           └── res/
    │               ├── values/
    │               │   ├── strings.xml
    │               │   ├── styles.xml
    │               │   └── colors.xml
    │               └── drawable/
    │                   └── ic_launcher_foreground.xml (placeholder)
    └── variables.gradle
```

**Note:** The template APK pre-includes Capacitor WebView shell. Actual template files need to be created via `npx @capacitor/create-app` at build time. For the initial implementation, the worker will run Capacitor CLI programmatically. The templateManager wraps this.

- [ ] **Step 1: Create worker/src/templateManager.ts**

```typescript
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function createTemplate(taskId: string): Promise<string> {
  const buildDir = path.join(os.tmpdir(), 'html2app-builds', taskId);

  await fs.mkdir(buildDir, { recursive: true });

  // Initialize a Capacitor project
  await execAsync('npx @capacitor/create-app@latest . --name "App" --package-id "com.html2app.temp" --web-dir "www" --npm-client npm', {
    cwd: buildDir,
  });

  // Create a minimal web directory with a placeholder
  const wwwDir = path.join(buildDir, 'www');
  await fs.mkdir(wwwDir, { recursive: true });
  await fs.writeFile(
    path.join(wwwDir, 'index.html'),
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>'
  );

  // Add Android platform
  await execAsync('npx cap add android', { cwd: buildDir });

  return buildDir;
}

export async function cleanupTemplate(buildDir: string): Promise<void> {
  try {
    await fs.rm(buildDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/templateManager.ts
git commit -m "feat: add worker template manager for Capacitor project creation"
```

---

### Task 8: Worker — Site Scraper & Icon Generator

**Files:**
- Create: `worker/src/siteScraper.ts`
- Create: `worker/src/iconGenerator.ts`

**Interfaces:**
- Consumes: target URL string
- Produces: 
  - `scrapeSiteInfo(url: string): Promise<{ title: string; faviconUrl: string; primaryColor: string; screenshot: Buffer }>`
  - `generateIcons(sourceImage: string | Buffer, buildDir: string): Promise<void>` — writes 6 icon sizes to Android res directories

- [ ] **Step 1: Create worker/src/siteScraper.ts**

```typescript
import puppeteer from 'puppeteer';

export interface SiteInfo {
  title: string;
  faviconUrl: string;
  primaryColor: string;
  screenshot: Buffer;
}

export async function scrapeSiteInfo(url: string): Promise<SiteInfo> {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Extract page title
    const title = await page.title();

    // Extract favicon
    let faviconUrl = '';
    try {
      faviconUrl = await page.$eval('link[rel="icon"], link[rel="shortcut icon"]', el => {
        const href = (el as HTMLLinkElement).href;
        return href || '';
      });
    } catch {
      faviconUrl = new URL('/favicon.ico', url).href;
    }

    // Extract theme color
    let primaryColor = '#2196F3';
    try {
      primaryColor = await page.$eval('meta[name="theme-color"]', el => {
        const content = (el as HTMLMetaElement).content;
        return content || '#2196F3';
      });
    } catch {
      // default color
    }

    // Take a screenshot for the splash screen
    const screenshot = Buffer.from(await page.screenshot({ type: 'png' }));

    return { title, faviconUrl, primaryColor, screenshot };
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Create worker/src/iconGenerator.ts**

```typescript
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const ANDROID_ICON_SIZES = [
  { name: 'mdpi', size: 48, density: 'mdpi' },
  { name: 'hdpi', size: 72, density: 'hdpi' },
  { name: 'xhdpi', size: 96, density: 'xhdpi' },
  { name: 'xxhdpi', size: 144, density: 'xxhdpi' },
  { name: 'xxxhdpi', size: 192, density: 'xxxhdpi' },
];

export async function generateIcons(
  imageSource: string | Buffer,
  androidResDir: string
): Promise<void> {
  const baseImage = sharp(imageSource).resize(192, 192);

  for (const { name, size } of ANDROID_ICON_SIZES) {
    const dir = path.join(androidResDir, `mipmap-${name}`);
    await fs.mkdir(dir, { recursive: true });

    await baseImage
      .clone()
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // Also create round icon
    await baseImage
      .clone()
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/siteScraper.ts worker/src/iconGenerator.ts
git commit -m "feat: add site scraper and icon generator for worker"
```

---

### Task 9: Worker — Config Injector & JS Bridge

**Files:**
- Create: `worker/src/configInjector.ts`
- Create: `worker/src/jsBridge.ts`

**Interfaces:**
- Consumes: `BuildConfig` from shared types, path to generated Capacitor project
- Produces:
  - `injectConfig(buildDir: string, config: BuildConfig, siteInfo: SiteInfo): Promise<void>`
  - `injectJSBridge(buildDir: string, config: BuildConfig): Promise<void>`

- [ ] **Step 1: Create worker/src/configInjector.ts**

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { BuildConfig } from '../../shared/types';
import type { SiteInfo } from './siteScraper';

const PERMISSION_MAP: Record<string, string> = {
  camera: 'android.permission.CAMERA',
  gps: 'android.permission.ACCESS_FINE_LOCATION',
  storage: 'android.permission.READ_EXTERNAL_STORAGE',
  microphone: 'android.permission.RECORD_AUDIO',
};

const PERMISSION_FEATURES: Record<string, string> = {
  camera: '<uses-feature android:name="android.hardware.camera" android:required="false"/>',
  gps: '<uses-feature android:name="android.hardware.location.gps" android:required="false"/>',
};

export async function injectConfig(
  buildDir: string,
  config: BuildConfig,
  siteInfo: SiteInfo
): Promise<void> {
  const appName = config.appName || siteInfo.title || 'My App';
  const primaryColor = config.theme?.primaryColor || config.splashBackground || siteInfo.primaryColor;

  // 1. Update capacitor.config.json
  const capConfigPath = path.join(buildDir, 'capacitor.config.json');
  const capConfig = JSON.parse(await fs.readFile(capConfigPath, 'utf-8'));
  capConfig.appName = appName;
  capConfig.appId = `com.html2app.${sanitizePackageId(appName)}`;
  capConfig.server = {
    url: config.url,
    cleartext: true,
    androidScheme: 'https',
  };
  await fs.writeFile(capConfigPath, JSON.stringify(capConfig, null, 2));

  // 2. Update AndroidManifest.xml with permissions
  const manifestPath = path.join(
    buildDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'
  );
  let manifest = await fs.readFile(manifestPath, 'utf-8');

  // Remove the default internet permission insertion point and add all at once
  const permissions = config.permissions || [];
  const permEntries = ['<uses-permission android:name="android.permission.INTERNET"/>',
    ...permissions.map(p => `<uses-permission android:name="${PERMISSION_MAP[p]}"/>`),
    ...permissions.filter(p => p in PERMISSION_FEATURES).map(p => PERMISSION_FEATURES[p]),
  ];

  const permBlock = permEntries.map(p => `    ${p}`).join('\n');
  manifest = manifest.replace(
    /<uses-permission android:name="android.permission.INTERNET"\/>/,
    permBlock
  );
  await fs.writeFile(manifestPath, manifest);

  // 3. Update strings.xml with app name
  const stringsPath = path.join(
    buildDir, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'
  );
  let strings = await fs.readFile(stringsPath, 'utf-8');
  strings = strings.replace(/>[^<]+<\/string>/g, `>${appName}</string>`);
  await fs.writeFile(stringsPath, strings);

  // 4. Inject theme colors into styles.xml
  const stylesPath = path.join(
    buildDir, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'
  );
  let styles = await fs.readFile(stylesPath, 'utf-8');
  styles = styles.replace(
    /<item name="colorPrimary">[^<]+<\/item>/,
    `<item name="colorPrimary">${primaryColor}</item>`
  );
  styles = styles.replace(
    /<item name="colorPrimaryDark">[^<]+<\/item>/,
    `<item name="colorPrimaryDark">${darken(primaryColor)}</item>`
  );
  styles = styles.replace(
    /<item name="colorAccent">[^<]+<\/item>/,
    `<item name="colorAccent">${primaryColor}</item>`
  );
  await fs.writeFile(stylesPath, styles);
}

function sanitizePackageId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30) || 'app';
}

function darken(hex: string): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Create worker/src/jsBridge.ts**

```typescript
import fs from 'fs/promises';
import path from 'path';
import type { BuildConfig } from '../../shared/types';

export async function injectJSBridge(
  buildDir: string,
  config: BuildConfig
): Promise<void> {
  // Find MainActivity.java
  const mainActivityPath = path.join(
    buildDir, 'android', 'app', 'src', 'main', 'java',
    'com', 'html2app', sanitizeDir(config.appName || 'app'),
    'MainActivity.java'
  );

  let activityContent: string;
  try {
    activityContent = await fs.readFile(mainActivityPath, 'utf-8');
  } catch {
    console.warn('MainActivity.java not found, skipping JS bridge injection');
    return;
  }

  // Add WebView settings and JS interface
  const bridgeCode = `
  // HTML2APP JS Bridge — auto-injected
  import android.webkit.JavascriptInterface;
  import android.webkit.WebSettings;

  // Add this inside the MainActivity class, after loadUrl:
  // configureWebView();

  private void configureWebView() {
    WebSettings settings = getBridge().getWebView().getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    ${config.offlineCache ? `
    settings.setAppCacheEnabled(true);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    ` : ''}
    ${(config.theme?.pullToRefresh) ? `
    // Pull to refresh is handled by Capacitor's SwipeRefreshLayout
    ` : ''}

    // Register JS Bridge
    getBridge().getWebView().addJavascriptInterface(
      new HTML2APPBridge(this), "HTML2APP"
    );
  }

  public class HTML2APPBridge {
    private final MainActivity activity;

    HTML2APPBridge(MainActivity activity) {
      this.activity = activity;
    }

    @JavascriptInterface
    public void showToast(String message) {
      activity.runOnUiThread(() ->
        android.widget.Toast.makeText(activity, message,
          android.widget.Toast.LENGTH_SHORT).show()
      );
    }

    @JavascriptInterface
    public String getAppVersion() {
      return android.os.BuildConfig.VERSION_NAME;
    }

    @JavascriptInterface
    public void exitApp() {
      activity.finish();
    }
  }
  `;

  // Inject the bridge before the closing brace of the class
  activityContent = activityContent.replace(
    /}\s*$/,
    bridgeCode + '\n}'
  );

  await fs.writeFile(activityPath, activityContent);
}

function sanitizeDir(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'wrapper';
}
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/configInjector.ts worker/src/jsBridge.ts
git commit -m "feat: add worker config injector and JS bridge"
```

---

### Task 10: Worker — Gradle Builder & APK Signer

**Files:**
- Create: `worker/src/gradleBuilder.ts`
- Create: `worker/src/signer.ts`

**Interfaces:**
- Consumes: path to Capacitor Android project
- Produces:
  - `buildApk(buildDir: string): Promise<string>` — runs Gradle, returns path to unsigned APK
  - `signApk(apkPath: string, outputPath: string): Promise<void>` — debug-signs the APK

- [ ] **Step 1: Create worker/src/gradleBuilder.ts**

```typescript
import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function buildApk(buildDir: string): Promise<string> {
  const androidDir = path.join(buildDir, 'android');

  // Make gradlew executable
  await execAsync('chmod +x gradlew', { cwd: androidDir });

  // Run Gradle assembleDebug
  await execAsync('./gradlew assembleDebug --no-daemon --stacktrace', {
    cwd: androidDir,
    timeout: 600000, // 10 minutes
  });

  const apkPath = path.join(
    androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'
  );

  return apkPath;
}

export async function syncCapacitor(buildDir: string): Promise<void> {
  // Run cap sync before building to make sure Capacitor plugins are wired up
  await execAsync('npx cap sync android', { cwd: buildDir, timeout: 120000 });
}
```

- [ ] **Step 2: Create worker/src/signer.ts**

```typescript
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function signApk(
  apkPath: string,
  outputPath: string
): Promise<string> {
  // For debug builds, the APK is already signed with the debug keystore by Gradle.
  // This function handles zipalign and copying to the output location.

  // Find zipalign (usually in Android SDK build-tools)
  const androidHome = process.env.ANDROID_HOME || '/opt/android-sdk';
  const buildToolsDir = path.join(androidHome, 'build-tools');

  // Find the latest build-tools version
  const entries = await fs.readdir(buildToolsDir);
  const latestBuildTools = entries
    .filter(e => /^\d+\.\d+\.\d+$/.test(e))
    .sort()
    .pop();

  const zipalign = path.join(buildToolsDir, latestBuildTools || '34.0.0', 'zipalign');

  const alignedPath = apkPath.replace('.apk', '-aligned.apk');

  try {
    await execAsync(`"${zipalign}" -v -p 4 "${apkPath}" "${alignedPath}"`);
  } catch {
    // zipalign might not be available — just copy the APK
    await fs.copyFile(apkPath, alignedPath);
  }

  // Copy to final output location
  await fs.copyFile(alignedPath, outputPath);

  return outputPath;
}
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/gradleBuilder.ts worker/src/signer.ts
git commit -m "feat: add Gradle builder and APK signer for worker"
```

---

### Task 11: Worker — Build Pipeline Orchestrator & Entry Point

**Files:**
- Create: `worker/src/pipeline.ts`
- Create: `worker/src/index.ts`

**Interfaces:**
- Consumes: All worker modules, BullMQ job data
- Produces: Full end-to-end build pipeline, worker entry point that consumes from queue

- [ ] **Step 1: Create worker/src/pipeline.ts**

```typescript
import path from 'path';
import type { BuildConfig } from '../../shared/types';
import { createTemplate, cleanupTemplate } from './templateManager';
import { scrapeSiteInfo } from './siteScraper';
import { generateIcons } from './iconGenerator';
import { injectConfig } from './configInjector';
import { injectJSBridge } from './jsBridge';
import { buildApk, syncCapacitor } from './gradleBuilder';
import { signApk } from './signer';

export interface PipelineResult {
  apkPath: string;
  appName: string;
}

export async function runPipeline(
  taskId: string,
  config: BuildConfig,
  job: { updateProgress: (value: { progress: number; step: string }) => Promise<void> }
): Promise<PipelineResult> {
  let buildDir = '';

  try {
    // Step 1: Initialize (0-10%)
    await job.updateProgress({ progress: 5, step: '创建构建环境...' });
    buildDir = await createTemplate(taskId);
    await job.updateProgress({ progress: 10, step: '模板初始化完成' });

    // Step 2: Scrape site info (10-20%)
    await job.updateProgress({ progress: 12, step: '正在访问目标网站...' });
    const siteInfo = await scrapeSiteInfo(config.url);
    await job.updateProgress({ progress: 20, step: '网站信息采集完成' });

    // Step 3: Inject configuration (20-50%)
    await job.updateProgress({ progress: 25, step: '正在注入应用配置...' });
    const appName = config.appName || siteInfo.title || 'My App';

    await injectConfig(buildDir, config, siteInfo);
    await job.updateProgress({ progress: 35, step: '正在生成图标...' });

    const androidResDir = path.join(buildDir, 'android', 'app', 'src', 'main', 'res');
    if (config.icon) {
      await generateIcons(config.icon, androidResDir);
    } else if (siteInfo.faviconUrl) {
      try {
        const response = await fetch(siteInfo.faviconUrl);
        if (response.ok) {
          const iconBuffer = Buffer.from(await response.arrayBuffer());
          await generateIcons(iconBuffer, androidResDir);
        }
      } catch {
        // Continue without custom icons
      }
    }
    await job.updateProgress({ progress: 45, step: '正在注入JS桥接...' });
    await injectJSBridge(buildDir, config);
    await job.updateProgress({ progress: 50, step: '配置注入完成' });

    // Step 4: Sync Capacitor (50-55%)
    await job.updateProgress({ progress: 52, step: '正在同步原生插件...' });
    await syncCapacitor(buildDir);

    // Step 5: Build APK (55-90%)
    await job.updateProgress({ progress: 55, step: '正在编译APK (这可能需要几分钟)...' });
    const unsignedApkPath = await buildApk(buildDir);
    await job.updateProgress({ progress: 90, step: '编译完成' });

    // Step 6: Sign & finalize (90-100%)
    await job.updateProgress({ progress: 92, step: '正在签名APK...' });
    const outputPath = path.join(buildDir, `${taskId}.apk`);
    await signApk(unsignedApkPath, outputPath);
    await job.updateProgress({ progress: 100, step: '构建完成' });

    return { apkPath: outputPath, appName };

  } finally {
    // Cleanup the build directory (but keep the APK)
    if (buildDir) {
      await cleanupTemplate(buildDir);
    }
  }
}
```

- [ ] **Step 2: Create worker/src/index.ts**

```typescript
import { Worker } from 'bullmq';
import fs from 'fs/promises';
import path from 'path';
import type { BuildJobData } from '../../shared/types';
import { runPipeline } from './pipeline';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

const apkOutputDir = process.env.APK_OUTPUT_DIR || '/tmp/html2app-apks';

const worker = new Worker<BuildJobData>(
  'build-apk',
  async (job) => {
    const { taskId, config: buildConfig } = job.data;

    const result = await runPipeline(taskId, buildConfig, {
      updateProgress: async (value) => {
        await job.updateProgress(value);
      },
    });

    // Copy APK to shared output directory
    const outputDir = path.join(apkOutputDir);
    await fs.mkdir(outputDir, { recursive: true });
    const destPath = path.join(outputDir, `${taskId}.apk`);
    await fs.copyFile(result.apkPath, destPath);

    return { apkUrl: `/api/build/${taskId}/download`, appName: result.appName };
  },
  {
    connection,
    concurrency: 1, // One build at a time per worker (scale horizontally for parallelism)
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('Worker started, waiting for build jobs...');
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/pipeline.ts worker/src/index.ts
git commit -m "feat: add build pipeline orchestrator and worker entry point"
```

---

### Task 12: Frontend — API Client & Build Hook

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/hooks/useBuildTask.ts`

**Interfaces:**
- Consumes: types from `frontend/src/types.ts`
- Produces:
  - `submitBuild(config: BuildConfig): Promise<{ taskId: string }>`
  - `getBuildStatus(taskId: string): Promise<BuildStatus>`
  - `previewSite(url: string): Promise<SitePreview>`
  - `useBuildTask()` — React hook with polling

- [ ] **Step 1: Create frontend/src/api/client.ts**

```typescript
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
```

- [ ] **Step 2: Create frontend/src/hooks/useBuildTask.ts**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import type { BuildStatus } from '../types';
import { getBuildStatus } from '../api/client';

export function useBuildTask(taskId: string | null) {
  const [status, setStatus] = useState<BuildStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    if (!taskId) return;
    try {
      const result = await getBuildStatus(taskId);
      setStatus(result);
      setError(null);

      if (result.status === 'done' || result.status === 'failed') {
        setLoading(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;

    setLoading(true);
    setStatus(null);
    setError(null);

    // Poll every 2 seconds
    poll(); // Immediate first poll
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [taskId, poll]);

  return { status, loading, error };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/hooks/useBuildTask.ts
git commit -m "feat: add frontend API client and build status polling hook"
```

---

### Task 13: Frontend — URL Input & Site Preview Components

**Files:**
- Create: `frontend/src/components/UrlInput.tsx`
- Create: `frontend/src/components/SitePreview.tsx`
- Modify: `frontend/src/App.tsx` (wire up)

**Interfaces:**
- Consumes: `previewSite` from API client, `SitePreview` type
- Produces: React components for URL input with validation and live preview card

- [ ] **Step 1: Create frontend/src/components/UrlInput.tsx**

```tsx
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

    // Auto-add https:// if no protocol
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Basic URL validation
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
      <label className="block text-sm font-medium text-gray-700 mb-2">
        输入目标网址
      </label>
      <div className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          placeholder="https://example.com"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '加载中...' : '开始'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Create frontend/src/components/SitePreview.tsx**

```tsx
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
```

- [ ] **Step 3: Update frontend/src/App.tsx to wire up components**

```tsx
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
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/UrlInput.tsx frontend/src/components/SitePreview.tsx frontend/src/App.tsx
git commit -m "feat: add URL input and site preview components to frontend"
```

---

### Task 14: Frontend — Basic & Advanced Config Components

**Files:**
- Create: `frontend/src/components/BasicConfig.tsx`
- Create: `frontend/src/components/AdvancedConfig.tsx`
- Modify: `frontend/src/App.tsx` (integrate config components, submit build)

**Interfaces:**
- Consumes: `BuildConfig` type, `SitePreview`, `submitBuild` API
- Produces: Config form components, full app flow from input → configure → build → download

- [ ] **Step 1: Create frontend/src/components/BasicConfig.tsx**

```tsx
import type { BuildConfig, SitePreview as SitePreviewType } from '../types';

interface Props {
  config: BuildConfig;
  onChange: (config: BuildConfig) => void;
  preview: SitePreviewType | null;
}

export default function BasicConfig({ config, onChange, preview }: Props) {
  const appName = config.appName || preview?.title || '';

  return (
    <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg space-y-4">
      <h3 className="font-semibold text-gray-900">基础配置</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">App 名称</label>
        <input
          type="text"
          value={appName}
          onChange={(e) => onChange({ ...config, appName: e.target.value })}
          placeholder="自动从网站抓取"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          maxLength={50}
        />
        {!config.appName && (
          <p className="text-xs text-gray-400 mt-1">
            留空则自动使用网站标题：{preview?.title || '(等待预览)'}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">启动画面背景色</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={config.splashBackground || preview?.primaryColor || '#2196F3'}
            onChange={(e) => onChange({ ...config, splashBackground: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer border border-gray-300"
          />
          <span className="text-sm text-gray-500 font-mono">
            {config.splashBackground || preview?.primaryColor || '#2196F3'}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create frontend/src/components/AdvancedConfig.tsx**

```tsx
import { useState } from 'react';
import type { BuildConfig } from '../types';

interface Props {
  config: BuildConfig;
  onChange: (config: BuildConfig) => void;
}

export default function AdvancedConfig({ config, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const togglePermission = (perm: string) => {
    const current = config.permissions || [];
    const next = current.includes(perm)
      ? current.filter(p => p !== perm)
      : [...current, perm];
    onChange({ ...config, permissions: next as BuildConfig['permissions'] });
  };

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        {expanded ? '收起高级配置 ▲' : '展开高级配置 ▼'}
      </button>

      {expanded && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg space-y-5">
          {/* Permissions */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">权限设置</h4>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'camera', label: '相机' },
                { key: 'gps', label: 'GPS定位' },
                { key: 'storage', label: '文件读写' },
                { key: 'microphone', label: '麦克风' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(config.permissions || []).includes(key)}
                    onChange={() => togglePermission(key)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Offline Cache */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.offlineCache || false}
                onChange={(e) =>
                  onChange({ ...config, offlineCache: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">启用离线缓存</span>
            </label>
          </div>

          {/* Pull to Refresh */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.theme?.pullToRefresh || false}
                onChange={(e) =>
                  onChange({
                    ...config,
                    theme: { ...config.theme, pullToRefresh: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">启用下拉刷新</span>
            </label>
          </div>

          {/* Dark Mode */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.theme?.darkMode || false}
                onChange={(e) =>
                  onChange({
                    ...config,
                    theme: { ...config.theme, darkMode: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">强制深色模式</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update frontend/src/App.tsx to integrate all components**

```tsx
import { useState } from 'react';
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

  // Transition to done when build completes
  if (step === 'building' && status?.status === 'done') {
    // Controlled via effect below to avoid render-in-render
  }

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
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BasicConfig.tsx frontend/src/components/AdvancedConfig.tsx frontend/src/App.tsx
git commit -m "feat: add basic and advanced config components, full app flow"
```

---

### Task 15: Frontend — Build Progress & Download Panel

**Files:**
- Create: `frontend/src/components/BuildProgress.tsx`
- Create: `frontend/src/components/DownloadPanel.tsx`

**Interfaces:**
- Consumes: `BuildStatus` type, `useBuildTask` hook
- Produces: Real-time progress bar and APK download UI with QR code

- [ ] **Step 1: Create frontend/src/components/BuildProgress.tsx**

```tsx
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
```

- [ ] **Step 2: Create frontend/src/components/DownloadPanel.tsx**

```tsx
import { useEffect, useRef } from 'react';
import { getDownloadUrl } from '../api/client';

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
        const downloadUrl = new URL(getDownloadUrl(taskId), window.location.origin).href;
        QRCode.toCanvas(qrRef.current, downloadUrl, {
          width: 160,
          margin: 2,
          color: { dark: '#1f2937', light: '#ffffff' },
        });
      }
    });
  }, [taskId]);

  const downloadUrl = getDownloadUrl(taskId);

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
        href={downloadUrl}
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
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BuildProgress.tsx frontend/src/components/DownloadPanel.tsx
git commit -m "feat: add build progress and download panel with QR code"
```

---

### Task 16: Docker Compose Orchestration

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: All three packages, worker Dockerfile
- Produces: `docker compose up` starts Redis + Backend + Frontend + Worker

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - UPLOAD_DIR=/app/uploads
    volumes:
      - apk_uploads:/app/uploads
      - ./shared:/app/shared:ro
    depends_on:
      redis:
        condition: service_healthy

  worker:
    build:
      context: .
      dockerfile: worker/docker/Dockerfile
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - APK_OUTPUT_DIR=/app/uploads
    volumes:
      - apk_uploads:/app/uploads
      - ./shared:/app/shared:ro
    depends_on:
      redis:
        condition: service_healthy
    deploy:
      replicas: 2

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:80"
    depends_on:
      - backend

volumes:
  redis_data:
  apk_uploads:
```

- [ ] **Step 2: Create backend/Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/src/ ./src/
COPY shared/ ./shared/
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 4: Create frontend/nginx.conf**

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 5: Build and verify**

Run: `docker compose build`
Expected: All images build successfully.

Run: `docker compose up -d`
Expected: All services start. Visit `http://localhost:5173` to see the frontend.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile frontend/nginx.conf
git commit -m "feat: add Docker Compose orchestration for all services"
```

---

### Task 17: End-to-End Integration Test

**Files:**
- No new files — manual verification

- [ ] **Step 1: Full stack startup**

Run: `docker compose up -d`
Expected: All 4 services (redis, backend, worker, frontend) are healthy.

- [ ] **Step 2: Test preview endpoint**

```bash
curl -X POST http://localhost:3000/api/preview \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```
Expected: JSON with title, favicon, primaryColor, description.

- [ ] **Step 3: Test build submission**

```bash
curl -X POST http://localhost:3000/api/build \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","appName":"测试应用"}'
```
Expected: JSON with taskId and status "queued".

- [ ] **Step 4: Poll build status**

```bash
curl http://localhost:3000/api/build/<taskId>
```
Expected: Status progresses from "queued" → "building" → "done" over ~3-5 minutes.

- [ ] **Step 5: Download APK**

```bash
curl -O http://localhost:3000/api/build/<taskId>/download
```
Expected: Downloads a valid APK file. Transfer to an Android device and install to verify.

- [ ] **Step 6: Test frontend flow**

Open `http://localhost:5173` in browser:
1. Enter `https://example.com` in the URL input
2. Verify site preview appears
3. Click "开始构建 APK"
4. Verify progress bar updates in real-time
5. Verify download button and QR code appear on completion
6. Click "制作另一个 APK" to reset

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "test: end-to-end integration verified"
```

---

## Phase 2 (Future Enhancements)

After the MVP is working end-to-end, add these features:

1. **AdMob Integration** — Add `@capacitor-community/admob` plugin to the Capacitor template, inject AdMob IDs into AndroidManifest and MainActivity
2. **Push Notifications** — Integrate Firebase Cloud Messaging: add `google-services.json` injection, `@capacitor/push-notifications` plugin
3. **Release Signing** — Allow users to upload their own keystore files for Google Play Store release builds
4. **Rate Limiting** — Add IP-based rate limiting (5 builds/hour per IP) to prevent abuse
5. **Build History** — Store build records in SQLite/Postgres for user history
6. **Custom Plugin Store** — Let users choose from a library of Capacitor plugins to include
7. **AAB Output** — Generate Android App Bundle (`.aab`) in addition to APK for Play Store distribution
