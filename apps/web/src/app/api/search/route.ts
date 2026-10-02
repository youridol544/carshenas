import { answerSearch } from '@/features/search/server/search-route';
import { withErrorReference } from '@/server/observability/route-errors';

// The search API (CS-59): a page of results, the total and optionally the facets for the search in the query string.
export const GET = withErrorReference('/api/search', answerSearch);
