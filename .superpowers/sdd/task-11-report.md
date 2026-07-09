### Task 11: Worker — Build Pipeline Orchestrator & Entry Point -- COMPLETED

**Commit:** `ebf68bf` - `feat: add build pipeline orchestrator and worker entry point`

**Files created:**
- `worker/src/pipeline.ts` -- Orchestrates the full 8-step build pipeline
- `worker/src/index.ts` -- BullMQ worker entry point consuming from `build-apk` queue

**Verification:**
- `npx tsc --noEmit` in `worker/` passes with zero errors
- All imports verified against existing module exports (templateManager, siteScraper, iconGenerator, configInjector, jsBridge, gradleBuilder, signer)
- `BuildJobData` and `BuildConfig` types from `shared/types.ts` confirmed compatible
- Redis connection uses `REDIS_HOST`/`REDIS_PORT` env vars directly (no backend import)
- `job.updateProgress` uses `{ progress: number, step: string }` format
- `fetch` used for favicon download (SSRF protection not needed -- URL validated by backend)

**Pipeline stages (pipeline.ts):**
1. Initialize -- creates Capacitor template via `createTemplate`
2. Scrape -- scrapes target site via `scrapeSiteInfo`
3. Inject config -- `injectConfig` + `generateIcons` + `injectJSBridge`
4. Sync Capacitor -- `syncCapacitor`
5. Build -- `buildApk` via Gradle
6. Sign -- `signApk` (zipalign + copy)
7. Cleanup in `finally` block (removes build dir, keeps APK)

**Entry point (index.ts):**
- BullMQ `Worker<BuildJobData>` on `'build-apk'` queue
- Concurrency: 1, with rate limiter (max 1 per second)
- Copies completed APK to `APK_OUTPUT_DIR` (defaults to `/tmp/html2app-apks`)
- Returns `{ apkUrl, appName }` as job result
- Logs `completed` and `failed` events

### Fix: Move build cleanup after APK copy to prevent premature deletion

**Commit:** (pending)

**Bug:** The `finally` block in `pipeline.ts` called `cleanupTemplate(buildDir)` which `rm -rf`'d the entire build directory, including the freshly signed APK file. Then `index.ts` tried to `fs.copyFile(result.apkPath, destPath)` but the file was already deleted.

**Changes:**
- `worker/src/pipeline.ts`:
  - Removed the `try/finally` block -- cleanup is now the caller's responsibility
  - Added `buildDir` to `PipelineResult` so the caller knows what to clean up
  - Removed `cleanupTemplate` import (no longer used in this module)
  - Changed `let buildDir = ''` + assignment to `const buildDir = await createTemplate(taskId)`
- `worker/src/index.ts`:
  - Added `import { cleanupTemplate } from './templateManager'`
  - Fixed redundant `path.join(apkOutputDir)` (single-arg `path.join` is a no-op) to just `apkOutputDir`
  - Added `await cleanupTemplate(result.buildDir)` AFTER `fs.copyFile` succeeds

**Verification:**
- `npx tsc --noEmit` in `worker/` passes with zero errors
- Execution order is now: build APK in temp dir -> copy APK to output dir -> cleanup temp dir
