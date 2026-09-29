import 'server-only';
import { isIPv4, isIPv6 } from 'node:net';

// The client address the sign-in throttle counts by (ADR-0020 point 8). Next.js fills X-Forwarded-For from the
// connection when a request has none; in a deployment our one reverse proxy writes the address it saw (CS-37:
// `proxy_set_header X-Forwarded-For $remote_addr`), so the last entry is the one to trust. The address is only ever
// hashed with the auth key, never stored or logged (ADR-0016).

type RequestHeaders = Pick<Headers, 'get'>;

export function clientAddress(headers: RequestHeaders): string {
  const last = (headers.get('x-forwarded-for') ?? '').split(',').at(-1)?.trim() ?? '';
  return addressKey(last);
}

/**
 * IPv4 as it is; IPv6 by its /56, because a provider gives each customer a whole range to move around in
 * (express-rate-limit keys the same way); an IPv4 address written as IPv6 (::ffff:1.2.3.4) as IPv4.
 */
export function addressKey(address: string): string {
  const plain = address.split('%')[0]?.toLowerCase() ?? '';
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(plain)?.[1];
  if (mapped !== undefined && isIPv4(mapped)) return mapped;
  if (isIPv4(plain)) return plain;
  if (isIPv6(plain)) {
    const groups = ipv6Hextets(plain);
    return `${groups.slice(0, 3).join(':')}:${(groups[3] ?? '0000').slice(0, 2)}00::/56`;
  }
  return 'unknown';
}

/** The eight groups of an IPv6 address, each four hex digits; the tail of an embedded IPv4 address is not needed. */
function ipv6Hextets(address: string): string[] {
  const [head = '', tail] = address.split('::');
  const headGroups = head === '' ? [] : head.split(':');
  const tailGroups = tail === undefined || tail === '' ? [] : tail.split(':');
  const missing = tail === undefined ? 0 : Math.max(0, 8 - headGroups.length - tailGroups.length);
  return [...headGroups, ...Array<string>(missing).fill('0'), ...tailGroups].map((group) =>
    group.padStart(4, '0'),
  );
}
