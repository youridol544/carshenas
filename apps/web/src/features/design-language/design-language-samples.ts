import { toToman } from '@carshenas/locale/toman';

// A number stays with its word on one line (ui-design craft.md, V-30).
const NBSP = '\u00A0';

// Fixed instants and amounts: the sample page never reads the clock, so it prerenders and its visual baseline
// stays still.

/** 15:30 on Sunday 5 Mehr 1405 in Tehran. */
export const SAMPLE_NOW = '2026-09-27T12:00:00Z';
/** Three hours and twenty minutes before SAMPLE_NOW. */
export const SAMPLE_LISTED_AT = '2026-09-27T08:40:00Z';
export const SAMPLE_RANGE_END = '2026-10-02T08:40:00Z';

export const SAMPLE_PRICE = toToman(1_250_000_000);
export const SAMPLE_ESTIMATE = toToman(1_263_456_789);
export const SAMPLE_ESTIMATE_LOW = toToman(1_196_000_000);
export const SAMPLE_ESTIMATE_HIGH = toToman(1_352_000_000);
export const SAMPLE_DROP = toToman(1_250_000_000 - 1_180_000_000);
export const SAMPLE_SCALE = toToman(850_000_000);
export const SAMPLE_MILEAGE_KM = 120_000;

export const DEAL_LEVELS = [
  { rating: 'great', label: 'معامله‌ی عالی', short: 'عالی' },
  { rating: 'good', label: 'معامله‌ی خوب', short: 'خوب' },
  { rating: 'fair', label: 'قیمت منصفانه', short: 'منصفانه' },
  { rating: 'high', label: 'گران', short: 'گران' },
  { rating: 'overpriced', label: 'خیلی گران', short: 'خیلی گران' },
] as const;

export type DealLevel = (typeof DEAL_LEVELS)[number]['rating'];

/** A listing with too few comparable listings to rate, shown in the neutral. */
export const NO_RATING_LABEL = 'بدون ارزیابی';

export const SAMPLE_LISTINGS = [
  {
    id: 'peugeot-206',
    title: `پژو${NBSP}۲۰۶ تیپ${NBSP}۲، مدل${NBSP}۱۴۰۰`,
    price: toToman(680_000_000),
    rating: 'good',
    gap: -0.08,
    facts: 'بدون رنگ · دنده‌ای · تهران',
  },
  {
    id: 'hyundai-sonata',
    title: `هیوندای سوناتا GLS، مدل${NBSP}۲۰۱۵`,
    price: toToman(2_450_000_000),
    rating: 'high',
    gap: 0.12,
    facts: 'یک لکه رنگ · اتوماتیک · شیراز',
  },
] as const satisfies readonly { rating: DealLevel; [key: string]: unknown }[];
