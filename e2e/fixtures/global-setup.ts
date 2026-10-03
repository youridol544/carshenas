import { removeListingPages, seedListingPages } from './listing-page';
import { removePasteListings, seedPasteListings } from './paste-link';

// Runs once before the whole run (playwright.config.ts): the listing page needs a listing to open for the stress matrix
// and the gorilla, which list their pages before any test starts (fixtures/app-pages.ts). The listing's id is handed to
// the workers through the environment, and the rows are removed when the run ends.
export default async function globalSetup(): Promise<(() => Promise<void>) | undefined> {
  // The harness's own self-tests run against the fixture site and need no database.
  if (process.env.E2E_ONLY_FIXTURE) return undefined;
  const seed = await seedListingPages();
  process.env.E2E_LISTING_ID = String(seed.ids.rated);
  process.env.E2E_LISTING_TOKEN = seed.token;
  // The pasted-link tests' listings, and the model's demand as it was, put back when the run ends (fixtures/paste-link.ts).
  const paste = await seedPasteListings();
  process.env.E2E_PASTE_SEED = JSON.stringify(paste);
  return async () => {
    await removePasteListings(paste);
    await removeListingPages(seed);
  };
}
