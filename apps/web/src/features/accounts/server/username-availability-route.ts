import 'server-only';
import { usernameCheckSchema } from '@/features/accounts/accounts-schemas';
import type { UsernameAvailability } from '@/features/accounts/accounts-types';
import { checkUsernameAvailability } from '@/features/accounts/server/username-availability';
import { clientAddress } from '@/server/auth/client-address';
import { isSameOriginRequest } from '@/server/auth/request-origin';

// POST /api/accounts/username-availability with {"username": "…"}: the sign-up page's check while a name is typed.
// A POST with a JSON body, never a query string, so the typed name never lands in a request log line; answered only to
// pages of this site, never cached.

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function answerUsernameAvailability(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request.headers)) return new Response(null, { status: 403, headers: NO_STORE });
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = usernameCheckSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400, headers: NO_STORE });
  const answer: UsernameAvailability = await checkUsernameAvailability(
    parsed.data.username,
    clientAddress(request.headers),
  );
  return Response.json(answer, { status: answer.status === 'throttled' ? 429 : 200, headers: NO_STORE });
}
