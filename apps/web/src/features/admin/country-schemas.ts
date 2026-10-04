import * as z from 'zod';
import { COUNTRY_CODES, type CountryCode } from '@carshenas/search/specs';
import type { CountryIntent } from '@/features/admin/country-types';

// What the country form sends (every field is hostile): the make, an optional model (a correction for that model alone),
// the press and, for saving, the country from the closed list. Removing sends no country: the database function takes NULL.

function formText() {
  return z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string());
}

const idText = z.string().regex(/^[1-9]\d{0,15}$/);

const countrySchema = z.object({
  makeId: formText().pipe(idText),
  modelId: formText().pipe(z.union([z.literal(''), idText])),
  intent: formText().pipe(z.enum(['save', 'remove'])),
  country: formText().pipe(z.enum(['', ...COUNTRY_CODES])),
});

export type CountryForm = {
  makeId: number;
  modelId: number | null;
  intent: CountryIntent;
  country: CountryCode | null;
};

export type ReadCountryForm =
  { readonly ok: true; readonly form: CountryForm } | { readonly ok: false; readonly problem: boolean };

/** Reads the form; `problem` false means it was not a form this screen rendered, true that no country was chosen to save. */
export function readCountryForm(formData: FormData): ReadCountryForm {
  const parsed = countrySchema.safeParse({
    makeId: formData.get('makeId'),
    modelId: formData.get('modelId'),
    intent: formData.get('intent'),
    country: formData.get('country'),
  });
  if (!parsed.success) return { ok: false, problem: false };
  const { makeId, modelId, intent, country } = parsed.data;
  const make = Number(makeId);
  const model = modelId === '' ? null : Number(modelId);
  if (!Number.isSafeInteger(make) || (model !== null && !Number.isSafeInteger(model))) {
    return { ok: false, problem: false };
  }
  if (intent === 'remove') return { ok: true, form: { makeId: make, modelId: model, intent, country: null } };
  if (country === '') return { ok: false, problem: true };
  return { ok: true, form: { makeId: make, modelId: model, intent, country } };
}
