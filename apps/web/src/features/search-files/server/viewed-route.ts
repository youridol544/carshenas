import 'server-only';
import { fileIdSchema } from '@/features/search-files/search-files-schemas';
import { markSearchFileViewed } from '@/features/search-files/server/file-mutations';
import { currentAccount } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError } from '@/server/observability/logger';

// POST /api/search-files/viewed with {"id": 12}: the file's page says the buyer is leaving it (CS-70). A beacon from the
// page's pagehide or visibilitychange, which a Server Action cannot be: the browser may drop an action's request when
// the page unloads, and a refresh must not lose what was new. Answered only to pages of this site, for the signed-in
// buyer's own file; no body in the answer, never cached.

/** The body is {"id": n}: far less than this. A larger one is refused before it is read. */
const MAX_BODY_BYTES = 256;

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function recordSearchFileLook(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request.headers)) return new Response(null, { status: 403, headers: NO_STORE });
  const account = await currentAccount();
  // Signed out meanwhile (the buyer signed out on this very page): nothing to record, and nothing to report.
  if (account === null) return new Response(null, { status: 204, headers: NO_STORE });
  const length = Number(request.headers.get('content-length'));
  if (!Number.isInteger(length) || length < 1 || length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413, headers: NO_STORE });
  }
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = fileIdSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400, headers: NO_STORE });
  try {
    await markSearchFileViewed(account.id, parsed.data.id);
  } catch (error) {
    captureError(error, {
      message: 'recording a search file look failed',
      fields: { accountId: account.id },
    });
    return new Response(null, { status: 500, headers: NO_STORE });
  }
  return new Response(null, { status: 204, headers: NO_STORE });
}
