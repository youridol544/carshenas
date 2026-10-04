import * as z from 'zod';
import { CAR_ORIGINS, type CarOrigin } from '@carshenas/search/specs';
import { readVolumeText, type SpecProblem } from '@/lib/model-spec-rules';
import type { SpecIntent } from '@/features/admin/model-spec-types';

// What the model-spec form sends (every field is hostile): the model, an optional trim, the press and, for saving, the
// volume as typed and the origin. The volume is read by the same rules the table enforces; a bad one comes back with
// its problem, never reaching the database. Removing sends no values: the database function takes «both empty».

function formText() {
  return z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string());
}

const idText = z.string().regex(/^[1-9]\d{0,15}$/);

const specSchema = z.object({
  modelId: formText().pipe(idText),
  trimId: formText().pipe(z.union([z.literal(''), idText])),
  intent: formText().pipe(z.enum(['save', 'remove'])),
  volume: formText().pipe(z.string().max(40)),
  origin: formText().pipe(z.enum(['', ...CAR_ORIGINS])),
});

export type ModelSpecForm = {
  modelId: number;
  trimId: number | null;
  intent: SpecIntent;
  volumeCc: number | null;
  origin: CarOrigin | null;
};

export type ReadSpecForm =
  | { readonly ok: true; readonly form: ModelSpecForm }
  | { readonly ok: false; readonly problem: SpecProblem | null };

/** Reads the form; `problem` null means it was not a form this screen rendered. */
export function readModelSpecForm(formData: FormData): ReadSpecForm {
  const parsed = specSchema.safeParse({
    modelId: formData.get('modelId'),
    trimId: formData.get('trimId'),
    intent: formData.get('intent'),
    volume: formData.get('volume'),
    origin: formData.get('origin'),
  });
  if (!parsed.success) return { ok: false, problem: null };
  const { modelId, trimId, intent, volume, origin } = parsed.data;
  const model = Number(modelId);
  const trim = trimId === '' ? null : Number(trimId);
  if (!Number.isSafeInteger(model) || (trim !== null && !Number.isSafeInteger(trim))) {
    return { ok: false, problem: null };
  }
  if (intent === 'remove') {
    return { ok: true, form: { modelId: model, trimId: trim, intent, volumeCc: null, origin: null } };
  }
  const read = readVolumeText(volume);
  if (!read.ok) return { ok: false, problem: read.problem };
  const chosen = origin === '' ? null : origin;
  if (read.cc === null && chosen === null) return { ok: false, problem: 'empty' };
  return { ok: true, form: { modelId: model, trimId: trim, intent, volumeCc: read.cc, origin: chosen } };
}
