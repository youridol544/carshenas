import { toLatinDigits } from '@carshenas/locale/digits';
import { ENGINE_VOLUME_BOUNDS, isEngineVolume } from '@carshenas/locale/engine-volume';
import { withoutBidiControls } from '@carshenas/locale/text';

// The rules of a model's or trim's engine volume and origin (CS-99, ADR-0039), stated once for the form that shows a
// problem in Farsi early and the action that checks again. The database enforces the same values
// (model_spec_engine_volume_cc_range, model_spec_car_origin_valid, model_spec_says_something); a test feeds both.

export type SpecProblem = 'volume_not_number' | 'volume_range' | 'empty';

export type VolumeRead =
  | { readonly ok: true; readonly cc: number | null }
  | { readonly ok: false; readonly problem: 'volume_not_number' | 'volume_range' };

/** The longest search the specs list takes. */
export const MAX_SPEC_QUERY_LENGTH = 60;
/** How many models the list shows at a time, the most listed first. */
export const SPEC_MODELS_LIMIT = 30;

/**
 * What a person typed as an engine volume, in whole cubic centimetres: digits in any script, thousands marks allowed,
 * an empty field is «no volume». A decimal («۱.۶») is refused rather than guessed as litres: the field says «سی‌سی».
 */
export function readVolumeText(text: string): VolumeRead {
  const plain = toLatinDigits(withoutBidiControls(text)).replace(/[\s,٬،]/g, '');
  if (plain === '') return { ok: true, cc: null };
  if (!/^\d{1,6}$/.test(plain)) return { ok: false, problem: 'volume_not_number' };
  const cc = Number(plain);
  return isEngineVolume(cc) ? { ok: true, cc } : { ok: false, problem: 'volume_range' };
}

export { ENGINE_VOLUME_BOUNDS };
