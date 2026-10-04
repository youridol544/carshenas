// The places src/proxy.ts answers for itself, before a page renders: the buyer's account, the superadmin section, and
// the listing and model pages whose missing ids must be a real 404 (ADR-0020 point 10, CS-64, CS-67). Each is a prefix
// and everything under it. They are what the proxy's matcher listed until every response needed the deployment's
// headers (CS-119), when the matcher widened to all pages and this check took over the old one's job.

const GUARDED_PREFIXES = ['/account', '/admin', '/listings', '/models'] as const;

/** Whether the path is one of those places or below one, however its letters are cased. */
export function isGuardedPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return GUARDED_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`));
}
