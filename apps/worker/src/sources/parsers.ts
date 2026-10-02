import type { JsonObject } from '@carshenas/db/db-types';
import type { DerivedListing } from './attributes.ts';
import { deriveDivarListing } from './divar/attributes.ts';

// The parser that reads each source's snapshots (CS-34): `pnpm derive:listings` re-derives the listings of every source
// named here. A new source's parser (Bama, CS-54) joins this list.

/**
 * Reads what a listing says from one of its source's snapshots, given when that snapshot was first fetched
 * (`snapshot.first_fetched_at`: the date the post was read at, never the clock, so a snapshot derived twice gives the
 * same listing); throws when the snapshot is not one it can read.
 */
export type Parser = (payload: JsonObject, fetchedAt: Date) => DerivedListing;

export const PARSERS: Readonly<Record<string, Parser>> = { divar: deriveDivarListing };
