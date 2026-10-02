import 'server-only';
import { readDatabase } from '@/server/db/database';
import { captureError } from '@/server/observability/logger';

// Whether a model page exists for a make and model slug (CS-67). The proxy asks before the page is rendered, for the
// reason the listing page's probe exists (listing-existence.ts): with Cache Components a notFound() thrown by the page
// arrives inside a response that has begun to stream as a 200, and only the proxy can send a real 404. One index probe
// on the catalogue's unique slugs. A convenience for the status code, never an authorisation: the page reads the model
// itself and answers notFound() itself.

export async function modelPageExists(makeSlug: string, modelSlug: string): Promise<boolean> {
  const row = await readDatabase()
    .selectFrom('model as m')
    .innerJoin('make as mk', 'mk.id', 'm.make_id')
    .select('m.id')
    .where('mk.slug', '=', makeSlug)
    .where('m.slug', '=', modelSlug)
    .executeTakeFirst();
  return row !== undefined;
}

export type ModelProbe = 'exists' | 'missing' | 'unknown';

/** The proxy's probe: `unknown` when the database does not answer, so the page answers for itself. */
export async function probeModelPage(makeSlug: string, modelSlug: string): Promise<ModelProbe> {
  try {
    return (await modelPageExists(makeSlug, modelSlug)) ? 'exists' : 'missing';
  } catch (error) {
    captureError(error, { message: 'the model existence probe failed', fields: { component: 'proxy' } });
    return 'unknown';
  }
}
