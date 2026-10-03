import * as z from 'zod';
import { photoLinkProblem, type PhotoLinkProblem } from '@/lib/model-photo-link-rules';

// What the model-photo form sends (every field is hostile): the model, the press and, for setting, the address. The
// address is trimmed and checked by the same rules the table enforces (model_photo_link_*); a bad one comes back with
// its problem, never reaching the database.

function formText() {
  return z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string());
}

const photoSchema = z.object({
  modelId: formText().pipe(z.string().regex(/^[1-9]\d{0,15}$/)),
  intent: formText().pipe(z.enum(['set', 'clear'])),
  url: formText().transform((text) => text.trim()),
});

export type ModelPhotoForm = { modelId: number; intent: 'set' | 'clear'; url: string | null };

export type ReadPhotoForm =
  | { readonly ok: true; readonly form: ModelPhotoForm }
  | { readonly ok: false; readonly problem: PhotoLinkProblem | null };

/** Reads the form; `problem` null means it was not a form this screen rendered. */
export function readModelPhotoForm(formData: FormData): ReadPhotoForm {
  const parsed = photoSchema.safeParse({
    modelId: formData.get('modelId'),
    intent: formData.get('intent'),
    url: formData.get('url'),
  });
  if (!parsed.success) return { ok: false, problem: null };
  const { modelId, intent, url } = parsed.data;
  const id = Number(modelId);
  if (!Number.isSafeInteger(id)) return { ok: false, problem: null };
  if (intent === 'clear') return { ok: true, form: { modelId: id, intent, url: null } };
  const problem = photoLinkProblem(url);
  if (problem !== null) return { ok: false, problem };
  return { ok: true, form: { modelId: id, intent, url } };
}
