import type { Kysely, Transaction } from 'kysely';
import type { DB, Json, JsonObject } from '@carshenas/db/db-types';
import {
  countListingsWithoutSnapshot,
  holdFreeListings,
  holdListing,
  latestSnapshots,
  nextListings,
  writeDerivedListingOrRefusal,
  type Refusal,
} from './db/attribute-store.ts';
import type { DerivedListing, UnparsedField } from './sources/attributes.ts';
import type { Parser } from './sources/parsers.ts';

// Re-deriving what every stored listing says from its latest snapshot, with each source's current parser (CS-34
// criterion 4): a parser change reaches every listing without a new crawl, and no request goes to any source. Listings
// are read in batches by id. A batch holds the listings no one else holds while it writes them, as the crawler holds
// the listing it writes, so the two never race; the listings the crawler or discovery held are derived afterwards, one
// at a time (attribute-store.ts says why neither can deadlock). The report says, field by field, what the parser read.

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

export type RefusedListing = Refusal & { readonly listingId: number };

export type DerivationReport = {
  /** Listings whose latest snapshot was read. */
  readonly derived: number;
  /** Listings another transaction held when their batch came, derived one at a time afterwards. */
  readonly heldElsewhere: number;
  /** Listings of these sources that no fetch ever stored a snapshot for. */
  readonly withoutSnapshot: number;
  /** Listings whose latest snapshot their parser refused as not one of its source's pages. */
  readonly unreadable: readonly number[];
  /** Listings whose derivation the database refused, with the rule it broke; their earlier derivation stays. */
  readonly refused: readonly RefusedListing[];
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
  const refused: RefusedListing[] = [];
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

  /** Derives listings the transaction holds, from their latest snapshots, read after they were held. */
  async function deriveHeld(trx: Transaction<DB>, listingIds: readonly number[]): Promise<void> {
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
      const outcome = await writeDerivedListingOrRefusal(trx, snapshot.listingId, listing);
      if (outcome.refused) {
        // Its earlier derivation stays; the report names it, and the batch goes on.
        refused.push({ listingId: snapshot.listingId, ...outcome.refused });
        continue;
      }
      derived += 1;
      if (outcome.written.attributes) attributesChanged += 1;
      if (outcome.written.photos) photosChanged += 1;
      if (outcome.written.unparsed) unparsedChanged += 1;
      count(listing);
    }
  }

  // A batch at a time, holding what no one else holds; what another transaction held is left for the pass after.
  const heldElsewhere: number[] = [];
  let afterListingId = 0;
  for (;;) {
    const batch = await nextListings(db, sourceIds, afterListingId, batchSize);
    const last = batch.at(-1);
    if (last === undefined) break;
    await db.transaction().execute(async (trx) => {
      const held = new Set(await holdFreeListings(trx, batch));
      heldElsewhere.push(...batch.filter((listingId) => !held.has(listingId)));
      await deriveHeld(trx, [...held]);
    });
    if (batch.length < batchSize) break;
    afterListingId = last;
  }
  // One at a time, waiting for whoever holds it: a transaction that holds only what it waits for closes no cycle.
  for (const listingId of heldElsewhere) {
    await db.transaction().execute(async (trx) => {
      if (await holdListing(trx, listingId)) await deriveHeld(trx, [listingId]);
    });
  }

  return {
    derived,
    heldElsewhere: heldElsewhere.length,
    withoutSnapshot: await countListingsWithoutSnapshot(db, sourceIds),
    unreadable,
    refused,
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
