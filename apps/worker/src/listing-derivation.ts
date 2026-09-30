import type { Kysely } from 'kysely';
import type { DB, Json, JsonObject } from '@carshenas/db/db-types';
import {
  countListingsWithoutSnapshot,
  holdListings,
  latestSnapshots,
  writeDerivedListing,
} from './db/attribute-store.ts';
import type { DerivedListing, UnparsedField } from './sources/attributes.ts';
import type { Parser } from './sources/parsers.ts';

// Re-deriving what every stored listing says from its latest snapshot, with each source's current parser (CS-34
// criterion 4): a parser change reaches every listing without a new crawl, and no request goes to any source. Listings
// are read in batches by id; each batch is held while it is written, as the crawler holds the listing it writes, so the
// two never race. The report says, field by field, what the parser read.

export type FieldCounts = {
  /** Listings that stated a value the parser read. */
  read: number;
  /** Listings that stated a form meaning unknown, such as Divar's 1,000,000 km. */
  statedUnknown: number;
  /** Listings whose value the parser could not read, kept in listing_unparsed_value. */
  unparsed: number;
  /** Listings that stated nothing. */
  absent: number;
};

export type DerivationReport = {
  /** Listings whose latest snapshot was read. */
  readonly derived: number;
  /** Listings of these sources that no fetch ever stored a snapshot for. */
  readonly withoutSnapshot: number;
  /** Listings whose latest snapshot their parser refused as not one of its source's pages. */
  readonly unreadable: readonly number[];
  readonly attributesChanged: number;
  readonly photosChanged: number;
  readonly unparsedChanged: number;
  readonly fields: Readonly<Record<UnparsedField, FieldCounts>>;
  /** «field: raw text» the parser could not read, with how many listings state it, most common first. */
  readonly unparsedTexts: readonly (readonly [string, number])[];
  /** Rows the parsers do not know, with how many listings have them, most common first. */
  readonly unknownLabels: readonly (readonly [string, number])[];
  readonly photosKept: number;
  readonly photosSkipped: number;
};

function counts(): FieldCounts {
  return { read: 0, statedUnknown: 0, unparsed: 0, absent: 0 };
}

/** One counter per field; the type asks for every field the database lists. */
function fieldCounts(): Record<UnparsedField, FieldCounts> {
  return {
    model_year: counts(),
    mileage_km: counts(),
    fuel: counts(),
    gearbox: counts(),
    insurance_months_left: counts(),
    price: counts(),
    accepts_swap: counts(),
    accepts_installments: counts(),
    seller_type: counts(),
    body_condition: counts(),
    engine_condition: counts(),
    gearbox_condition: counts(),
    chassis_condition: counts(),
  };
}

function isObject(payload: Json): payload is JsonObject {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function valueOf(derived: DerivedListing, field: UnparsedField): unknown {
  const { attributes } = derived;
  switch (field) {
    case 'model_year':
      return attributes.modelYear;
    case 'mileage_km':
      return attributes.mileageKm;
    case 'fuel':
      return attributes.fuel;
    case 'gearbox':
      return attributes.gearbox;
    case 'insurance_months_left':
      return attributes.insuranceMonthsLeft;
    case 'price':
      return attributes.price;
    case 'accepts_swap':
      return attributes.acceptsSwap;
    case 'accepts_installments':
      return attributes.acceptsInstallments;
    case 'seller_type':
      return attributes.sellerType;
    case 'body_condition':
      return attributes.bodyCondition;
    case 'engine_condition':
      return attributes.engineCondition;
    case 'gearbox_condition':
      return attributes.gearboxCondition;
    case 'chassis_condition':
      return attributes.frontChassisCondition;
  }
}

function tallied(tally: Map<string, number>): (readonly [string, number])[] {
  return [...tally].sort(([a, first], [b, second]) => second - first || a.localeCompare(b));
}

/** Re-derives every listing of the sources in `parsers` from its latest snapshot, and reports what was read. */
export async function deriveStoredListings(
  db: Kysely<DB>,
  parsers: Readonly<Record<string, Parser>>,
  options: { readonly batchSize?: number } = {},
): Promise<DerivationReport> {
  const sourceIds = Object.keys(parsers);
  const batchSize = options.batchSize ?? 200;
  const fields = fieldCounts();
  const unparsedTexts = new Map<string, number>();
  const unknownLabels = new Map<string, number>();
  const unreadable: number[] = [];
  let derived = 0;
  let attributesChanged = 0;
  let photosChanged = 0;
  let unparsedChanged = 0;
  let photosKept = 0;
  let photosSkipped = 0;

  function count(listing: DerivedListing): void {
    const unparsed = new Set(listing.unparsed.map((value) => value.field));
    const statedUnknown = new Set(listing.statedUnknown);
    for (const [field, tally] of Object.entries(fields) as [UnparsedField, FieldCounts][]) {
      if (unparsed.has(field)) tally.unparsed += 1;
      else if (statedUnknown.has(field)) tally.statedUnknown += 1;
      else if (valueOf(listing, field) === null) tally.absent += 1;
      else tally.read += 1;
    }
    for (const value of listing.unparsed) {
      const key = `${value.field}: ${value.rawText}`;
      unparsedTexts.set(key, (unparsedTexts.get(key) ?? 0) + 1);
    }
    for (const label of new Set(listing.unknownLabels))
      unknownLabels.set(label, (unknownLabels.get(label) ?? 0) + 1);
    photosKept += listing.photos.length;
    photosSkipped += listing.skippedPhotos;
  }

  let afterListingId = 0;
  for (;;) {
    const held = await db.transaction().execute(async (trx) => {
      const listingIds = await holdListings(trx, sourceIds, afterListingId, batchSize);
      for (const snapshot of await latestSnapshots(trx, listingIds)) {
        const parser = parsers[snapshot.sourceId];
        let listing: DerivedListing | undefined;
        try {
          listing = parser && isObject(snapshot.payload) ? parser(snapshot.payload) : undefined;
        } catch {
          // Not one of its source's pages: counted and reported, never written.
          listing = undefined;
        }
        if (listing === undefined) {
          unreadable.push(snapshot.listingId);
          continue;
        }
        const written = await writeDerivedListing(trx, snapshot.listingId, listing);
        derived += 1;
        if (written.attributes) attributesChanged += 1;
        if (written.photos) photosChanged += 1;
        if (written.unparsed) unparsedChanged += 1;
        count(listing);
      }
      return listingIds;
    });
    const last = held.at(-1);
    if (last === undefined || held.length < batchSize) break;
    afterListingId = last;
  }

  return {
    derived,
    withoutSnapshot: await countListingsWithoutSnapshot(db, sourceIds),
    unreadable,
    attributesChanged,
    photosChanged,
    unparsedChanged,
    fields,
    unparsedTexts: tallied(unparsedTexts),
    unknownLabels: tallied(unknownLabels),
    photosKept,
    photosSkipped,
  };
}
