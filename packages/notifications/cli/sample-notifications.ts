import type { DB } from '@carshenas/db/db-types';
import { sql, type Kysely } from 'kysely';
import { createNotification } from '../src/create-notification.ts';

// For development and browser tests only (never run on main): notifies one account of real price drops, the most
// recent first, through the same helper and database function a producer uses, so muting and deduplication apply as
// they will for CS-69's marked listings. The facts come from the listing's price events and the catalogue.

export type SampleOptions = {
  readonly accountId: number;
  /** How many price drops. */
  readonly count: number;
  /** How many of the most recent drops to pass over first, for a set the account has not seen. */
  readonly skip: number;
};

export type SampleOutcome = { readonly created: number; readonly skipped: number };

export async function sampleNotifications(db: Kysely<DB>, options: SampleOptions): Promise<SampleOutcome> {
  // A drop is an asking price below the listing's latest earlier one (data-model.md, listing_price_event). The car is
  // named as the catalogue names it, its trim first (whose Persian name includes the model's), then the model, then
  // the listing's own title.
  const { rows } = await sql<{
    price_event_id: number;
    listing_id: number;
    car_name: string;
    model_year_sh: number | null;
    previous_price_toman: number;
    price_toman: number;
  }>`
    SELECT e.id AS price_event_id, e.listing_id,
           coalesce(t.name_fa, m.name_fa, l.title, l.source_model_key) AS car_name,
           l.model_year_sh, e.last_asking_price_toman AS previous_price_toman, e.asking_price_toman AS price_toman
    FROM listing_price_event e
    JOIN listing l ON l.id = e.listing_id
    LEFT JOIN model m ON m.id = l.model_id
    LEFT JOIN trim t ON t.id = l.trim_id
    WHERE e.price_type = 'asking' AND e.asking_price_toman < e.last_asking_price_toman
    ORDER BY e.observed_at DESC, e.id DESC
    LIMIT ${options.count} OFFSET ${options.skip}`.execute(db);
  let created = 0;
  for (const row of rows) {
    const outcome = await createNotification(db, {
      accountId: options.accountId,
      kind: 'listing_price_drop',
      listingId: row.listing_id,
      payload: {
        priceEventId: row.price_event_id,
        carName: row.car_name.trim().slice(0, 120),
        ...(row.model_year_sh === null ? {} : { modelYearSh: row.model_year_sh }),
        previousPriceToman: row.previous_price_toman,
        priceToman: row.price_toman,
      },
    });
    if (outcome.status === 'created') created += 1;
  }
  return { created, skipped: rows.length - created };
}
