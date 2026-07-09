import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isPrivateHost } from '../ssrfGuard';

const previewSchema = z.object({
  url: z.string().url('请提供有效的网址'),
});

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Body-size guarding: stream the response and stop reading at MAX_BODY_BYTES
// ---------------------------------------------------------------------------

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const body = response.body;
  if (!body) return '';

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          // Stop reading – cancel the stream
          reader.cancel().catch(() => {});
          throw new Error('BODY_TOO_LARGE');
        }
        chunks.push(value);
      }
    }
  } catch (err) {
    reader.cancel().catch(() => {});
    throw err;
  }

  if (chunks.length === 0) return '';

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const decoder = new TextDecoder();
  return decoder.decode(combined);
}

// ---------------------------------------------------------------------------
// Regex helpers – attribute-order-independent extraction
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Two-pass approach: first find a <meta> tag whose `name` attribute equals
 * `nameValue`, then extract its `content` attribute.  Order-independent.
 */
function extractMetaContent(html: string, nameValue: string): string {
  const metaRegex = /<meta\b([^>]*)>/gi;
  const namePattern = new RegExp(
    `\\bname\\s*=\\s*["']${escapeRegex(nameValue)}["']`,
    'i',
  );
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];
    if (namePattern.test(attrs)) {
      const contentMatch = attrs.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
      if (contentMatch) return contentMatch[1];
    }
  }
  return '';
}

/**
 * Two-pass approach: first find a <link> tag whose `rel` attribute is
 * "icon" or "shortcut icon", then extract `href`.  Order-independent.
 */
function extractFaviconHref(html: string): string {
  const linkRegex = /<link\b([^>]*)>/gi;
  const iconRel = /\brel\s*=\s*["'](?:shortcut\s+)?icon["']/i;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const attrs = match[1];
    if (iconRel.test(attrs)) {
      const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
      if (hrefMatch) return hrefMatch[1];
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function previewRoutes(app: FastifyInstance) {
  app.post('/api/preview', async (request, reply) => {
    const parsed = previewSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { url } = parsed.data;

    // ---- SSRF guard: validate hostname before fetch ----
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return reply.status(400).send({ error: '网址格式不正确' });
    }
    if (isPrivateHost(hostname)) {
      return reply.status(400).send({ error: '不允许访问该地址' });
    }

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'HTML2APP-Bot/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), // timeout
      });

      if (!response.ok) {
        return reply
          .status(400)
          .send({ error: `无法访问目标网站 (HTTP ${response.status})` });
      }

      // ---- SSRF guard: re-validate hostname after redirects ----
      const finalHostname = new URL(response.url).hostname;
      if (isPrivateHost(finalHostname)) {
        return reply.status(400).send({ error: '不允许访问该地址' });
      }

      // Stream the body with a 5 MB cap
      const html = await readBodyWithLimit(response, MAX_BODY_BYTES);

      // Extract <title> – the original regex is already order-independent
      const titleMatch = html.match(/<title\b[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch?.[1]?.trim() || hostname;

      // Extract <meta name="description"> – order-independent
      const description = extractMetaContent(html, 'description');

      // Extract favicon – order-independent
      let favicon = extractFaviconHref(html);
      if (favicon && !favicon.startsWith('http')) {
        favicon = new URL(favicon, url).href;
      }
      if (!favicon) {
        favicon = new URL('/favicon.ico', url).href;
      }

      // Extract <meta name="theme-color"> – order-independent
      const primaryColor =
        extractMetaContent(html, 'theme-color') || '#2196F3';

      return { title, favicon, primaryColor, description };
    } catch (err: any) {
      // ---- Robust error discrimination ----

      // Body too large (thrown by readBodyWithLimit)
      if (err?.message === 'BODY_TOO_LARGE') {
        return reply
          .status(400)
          .send({ error: '目标网页过大，无法预览' });
      }

      // Abort / timeout errors (AbortSignal.timeout)
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        return reply
          .status(408)
          .send({ error: '请求超时，目标网站响应过慢' });
      }

      // DNS resolution / network errors – TypeError from fetch()
      if (err instanceof TypeError) {
        return reply
          .status(400)
          .send({ error: '无法解析该域名，请检查网址是否正确' });
      }

      // Fallback: Node-style error codes on cause
      const code = err?.cause?.code;
      if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ECONNRESET') {
        return reply
          .status(400)
          .send({ error: '无法解析该域名，请检查网址是否正确' });
      }

      return reply.status(500).send({ error: '预览失败，请稍后重试' });
    }
  });
}
