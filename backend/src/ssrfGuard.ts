// SSRF protection: block private IPs, link-local, and localhost hostnames

export function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // IPv4-mapped IPv6 detection (e.g., ::ffff:127.0.0.1)
  const mappedMatch = /^\[?::ffff:([\d.]+)\]?$/i.exec(lower);
  if (mappedMatch) {
    return isPrivateHost(mappedMatch[1]);
  }

  // Block known localhost / loopback hostnames
  const blockedHostnames = [
    'localhost',
    'localhost.localdomain',
    'localhost6',
    'loopback',
  ];
  if (blockedHostnames.includes(lower)) return true;

  // IPv4 private / reserved ranges
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  if (ipv4Regex.test(hostname)) {
    const parts = hostname.split('.').map(Number);
    const [a, b] = parts;
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    return false;
  }

  // IPv6 private / reserved ranges
  let ipv6 = hostname;
  const zoneIdx = ipv6.indexOf('%');
  if (zoneIdx !== -1) ipv6 = ipv6.slice(0, zoneIdx);
  if (ipv6.startsWith('[') && ipv6.endsWith(']')) ipv6 = ipv6.slice(1, -1);

  if (ipv6.includes(':')) {
    const expanded = expandIPv6(ipv6);
    if (expanded) {
      const parts = expanded.split(':');
      if (parts.length === 8) {
        if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
        const firstWord = parseInt(parts[0], 16);
        if ((firstWord & 0xffc0) === 0xfe80) return true;
        if ((firstWord & 0xfe00) === 0xfc00) return true;
      }
    }
  }

  return false;
}

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
