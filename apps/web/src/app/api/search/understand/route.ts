import { answerUnderstand } from '@/features/search-understanding/server/understand-route';
import { withErrorReference } from '@/server/observability/route-errors';

// Plain-Farsi search (CS-62): a typed sentence in, the search it means and how it was read out.
export const POST = withErrorReference('/api/search/understand', answerUnderstand);
