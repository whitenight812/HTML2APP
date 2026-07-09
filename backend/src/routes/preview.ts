import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const previewSchema = z.object({
  url: z.string().url('请提供有效的网址'),
});

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// SSRF protection: block private IPs, link-local, and localhost hostnames
// ---------------------------------------------------------------------------

function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Block known localhost / loopback hostnames
  const blockedHostnames = [
    'localhost',
    'localhost.localdomain',
    'localhost6',
    'loopback',
  ];
  if (blockedHostnames.includes(lower)) return true;

  // ---- IPv4 private / reserved ranges ----
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  if (ipv4Regex.test(hostname)) {
    const parts = hostname.split('.').map(Number);
    const [a, b] = parts;
    if (a === 127) return true;             // 127.0.0.0/8
    if (a === 10) return true;               // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;  // 192.168.0.0/16
    if (a === 169 && b === 254) return true;  // 169.254.0.0/16
    if (a === 0) return true;                // 0.0.0.0/8
    return false;
  }

  // ---- IPv6 private / reserved ranges ----
  let ipv6 = hostname;
  const zoneIdx = ipv6.indexOf('%');
  if (zoneIdx !== -1) ipv6 = ipv6.slice(0, zoneIdx);
  if (ipv6.startsWith('[') && ipv6.endsWith(']')) ipv6 = ipv6.slice(1, -1);

  if (ipv6.includes(':')) {
    const expanded = expandIPv6(ipv6);
    if (expanded) {
      const parts = expanded.split(':');
      if (parts.length === 8) {
        // ::1 loopback
        if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
        const firstWord = parseInt(parts[0], 16);
        // fe80::/10 – link-local
        if ((firstWord & 0xffc0) === 0xfe80) return true;
        // fc00::/7 – unique local
        if ((firstWord & 0xfe00) === 0xfc00) return true;
      }
    }
  }

  return false;
}

/** Expand a compressed IPv6 address (containing "::") to its full 8-word form. */
function expandIPv6(addr: string): string | null {
  if (!addr.includes('::')) return addr;
  const sides = addr.split('::');
  if (sides.length !== 2) return null;
  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides[1] ? sides[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  const fill = new Array(missing).fill('0000');
  return [...left, ...fill, ...right].map((s) => s.padStart(4, '0')).join(':');
}

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
