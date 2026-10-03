import { recordSearchFileLook } from '@/features/search-files/server/viewed-route';
import { withErrorReference } from '@/server/observability/route-errors';

// The file page's «the buyer is leaving» beacon (CS-70): records the last look of one of the buyer's own files.
export const POST = withErrorReference('/api/search-files/viewed', recordSearchFileLook);
