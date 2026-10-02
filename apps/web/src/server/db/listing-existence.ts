import 'server-only';
import { readDatabase } from '@/server/db/database';
import { captureError } from '@/server/observability/logger';

// Whether a listing page exists for an id (CS-64). The proxy asks before the page is rendered, because with Cache Components
// a notFound() thrown by the page itself arrives inside a response that has already started streaming as a 200 (CS-30,
// measured again on the production build in CS-64), and only the proxy can send a real 404. One primary-key probe. A listing
// Carshenas took down (`removed`) has no page. This is a convenience for the status code, never an authorisation: the page
// reads the listing again and answers notFound() itself.

export async function listingPageExists(id: number): Promise<boolean> {
  const row = await readDatabase()
    .selectFrom('listing')
    .select('id')
    .where('id', '=', id)
    .where('status', '<>', 'removed')
    .executeTakeFirst();
  return row !== undefined;
}

export type ListingProbe = 'exists' | 'missing' | 'unknown';

/**
 * The probe the proxy uses: `unknown` when the database does not answer, so the request goes on to the page, which reads
 * the listing itself and shows its own error screen; a database failure must never turn every listing address into a 404.
 */
export async function probeListingPage(id: number): Promise<ListingProbe> {
  try {
    return (await listingPageExists(id)) ? 'exists' : 'missing';
  } catch (error) {
    captureError(error, { message: 'the listing existence probe failed', fields: { component: 'proxy' } });
    return 'unknown';
  }
}
