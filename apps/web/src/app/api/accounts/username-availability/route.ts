import { answerUsernameAvailability } from '@/features/accounts/server/username-availability-route';
import { withErrorReference } from '@/server/observability/route-errors';

// Whether a username is free, asked by the sign-up page while it is typed (ADR-0020 point 2).
export const POST = withErrorReference('/api/accounts/username-availability', answerUsernameAvailability);
