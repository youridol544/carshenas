import type { JsonObject } from '@carshenas/db/db-types';
import type { DerivedListing } from './attributes.ts';
import { deriveDivarListing } from './divar/attributes.ts';

// The parser that reads each source's snapshots (CS-34): `pnpm derive:listings` re-derives the listings of every source
// named here. A new source's parser (Bama, CS-54) joins this list.

/** Reads what a listing says from one of its source's snapshots; throws when the snapshot is not one it can read. */
export type Parser = (payload: JsonObject) => DerivedListing;

export const PARSERS: Readonly<Record<string, Parser>> = { divar: deriveDivarListing };
