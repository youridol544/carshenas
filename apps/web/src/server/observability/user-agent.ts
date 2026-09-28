import 'server-only';
import { redactAndTruncate } from '@carshenas/observability/redact';

const MAX_USER_AGENT = 300;

/** The browser a request names, as a log line carries it: redacted, then cut, since the header is anyone's text. */
export function userAgentOf(header: string | null | undefined): string | undefined {
  return header === null || header === undefined ? undefined : redactAndTruncate(header, MAX_USER_AGENT);
}
