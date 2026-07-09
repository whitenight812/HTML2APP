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
