import * as z from 'zod';
import { TRACKED_INTENTS, type TrackedIntent, type TrackedPriority } from '@/lib/tracked-models-rules';

// What the tracked-model forms send (every field is hostile): the model, an optional trim, the press (an intent) and,
// for tracking, the chosen priority. The database function checks the same values again (tracked_model_priority_valid,
// tracked_model_change_action_valid) and that the person is a superadmin.

function formText() {
  return z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string());
}

const idText = z.string().regex(/^[1-9]\d{0,15}$/);

const changeSchema = z.object({
  modelId: formText().pipe(idText),
  trimId: formText().pipe(z.union([z.literal(''), idText])),
  intent: formText().pipe(z.enum(TRACKED_INTENTS)),
  priority: formText().pipe(z.enum(['', 'high', 'normal', 'low'])),
});

export type ChangeTrackedForm = {
  modelId: number;
  trimId: number | null;
  /** The function's action: track, pause, resume, untrack or set_priority. */
  action: 'track' | 'pause' | 'resume' | 'untrack' | 'set_priority';
  priority: TrackedPriority | null;
  intent: TrackedIntent;
};

/** Reads a tracked-model form; anything that is not a form this screen rendered comes back as undefined. */
export function readChangeTrackedForm(formData: FormData): ChangeTrackedForm | undefined {
  const parsed = changeSchema.safeParse({
    modelId: formData.get('modelId'),
    trimId: formData.get('trimId'),
    intent: formData.get('intent'),
    priority: formData.get('priority'),
  });
  if (!parsed.success) return undefined;
  const { modelId, trimId, intent, priority } = parsed.data;
  const model = Number(modelId);
  const trim = trimId === '' ? null : Number(trimId);
  if (!Number.isSafeInteger(model) || (trim !== null && !Number.isSafeInteger(trim))) return undefined;
  if (intent.startsWith('priority:')) {
    return {
      modelId: model,
      trimId: trim,
      action: 'set_priority',
      priority: intent.slice('priority:'.length) as TrackedPriority,
      intent,
    };
  }
  // Only tracking takes a priority from its own field; the others take none.
  if (intent === 'track') {
    return {
      modelId: model,
      trimId: trim,
      action: 'track',
      priority: priority === '' ? null : priority,
      intent,
    };
  }
  return {
    modelId: model,
    trimId: trim,
    action: intent as 'pause' | 'resume' | 'untrack',
    priority: null,
    intent,
  };
}
