import { FastifyInstance } from 'fastify';
import { readFile } from 'fs/promises';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { addBuildJob, getJobStatus } from '../queue/buildQueue';
import { ensureUploadDir, getApkPath, apkExists, scheduleCleanup } from '../storage/apkStorage';
import { isPrivateHost } from '../ssrfGuard';
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

    // SSRF guard: validate hostname before queueing
    try {
      const hostname = new URL(config.url).hostname;
      if (isPrivateHost(hostname)) {
        return reply.status(400).send({ error: '不允许访问该地址' });
      }
    } catch {
      return reply.status(400).send({ error: '网址格式不正确' });
    }

    try {
      await addBuildJob(taskId, config);
    } catch (err: any) {
      request.log.error({ err }, 'Build queue unavailable');
      return reply.status(503).send({
        error: '构建服务暂时不可用，请稍后重试',
        detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }

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
    scheduleCleanup(taskId);
    return reply
      .header('Content-Disposition', `attachment; filename="${taskId}.apk"`)
      .type('application/vnd.android.package-archive')
      .send(await readFile(filePath));
  });
}
