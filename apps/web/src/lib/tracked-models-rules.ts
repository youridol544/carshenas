// The rules of the tracked models the superadmin's screen and its form share (CS-53, ADR-0037); the database enforces
// the same values (tracked_model_priority_valid, tracked_model_change_action_valid) and a test fails when they differ.

export const TRACKED_PRIORITIES = ['high', 'normal', 'low'] as const;
export type TrackedPriority = (typeof TRACKED_PRIORITIES)[number];

/** What a press on the screen asks for; a priority is part of its own press («priority:high»). */
export const TRACKED_INTENTS = [
  'track',
  'pause',
  'resume',
  'untrack',
  'priority:high',
  'priority:normal',
  'priority:low',
] as const;
export type TrackedIntent = (typeof TRACKED_INTENTS)[number];

/** The state of a tracked model: read now, or kept with its last data. */
export type TrackedState = 'tracking' | 'paused';

/** How many untracked models the list shows at a time, most listed first. */
export const UNTRACKED_LIMIT = 40;
/** The longest search the untracked list takes. */
export const MAX_UNTRACKED_QUERY_LENGTH = 60;
