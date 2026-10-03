import { isAssumedMileage, mileageNote, reallyLowNote } from '@carshenas/search/mileage-reading';

// What a page says about a mileage that was read, not taken as written (CS-101, ADR-0040): the sentence under the
// mileage and the rule for the info control beside it. The words are @carshenas/search's (mileage-reading.ts); this only
// shapes them for the screens, so the card, the listing page and the lists that name a mileage can never say two things.

export const MILEAGE_INFO_LABEL = 'توضیح درباره‌ی کارکرد تخمینی';
export const MILEAGE_INFO_CLOSE = 'بستن توضیح کارکرد';
/** Said before an assumed mileage where only the figure fits: a comparable, a similar listing. */
export const ASSUMED_PREFIX = 'احتمالاً';

/** The shape the info control (components/ui/info-popover) takes. */
export type MileageInfo = {
  readonly title: string;
  readonly sections: readonly { readonly id: string; readonly paragraphs: readonly string[] }[];
};

export type MileageNoteView = {
  readonly line: string;
  /** The rule, for the info control; null for a sentence that needs none (a really low mileage). */
  readonly info: MileageInfo | null;
};

type Reading = {
  readonly mileageKm: number | null;
  readonly mileageReading: 'really_low' | 'thousands_text' | 'thousands_price' | 'unread' | null;
  readonly mileageWrittenKm: number | null;
};

/** The note under a mileage, or null when it was taken as written (or is not known at all). */
export function mileageNoteView(listing: Reading): MileageNoteView | null {
  const input = {
    reading: listing.mileageReading,
    writtenKm: listing.mileageWrittenKm,
    mileageKm: listing.mileageKm,
  };
  const assumed = mileageNote(input);
  if (assumed !== null) {
    return {
      line: assumed.line,
      info: { title: assumed.info.title, sections: [{ id: 'rule', paragraphs: assumed.info.paragraphs }] },
    };
  }
  const low = reallyLowNote(input);
  return low === null ? null : { line: low, info: null };
}

/** «احتمالاً ۱۰۰٬۰۰۰ کیلومتر» for a figure assumed in thousands; the figure alone otherwise. */
export function withAssumption(text: string, reading: Reading['mileageReading']): string {
  return isAssumedMileage(reading) ? `${ASSUMED_PREFIX} ${text}` : text;
}

/** The note for a mileage assumed in thousands only (a card's), or null. */
export function assumedNoteView(listing: Reading): MileageNoteView | null {
  const note = mileageNoteView(listing);
  return note?.info === null ? null : note;
}
