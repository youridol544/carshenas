import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import pg from 'pg';

// Marked listings for the browser tests (CS-69). What happens to a listing after a buyer marked it, a price falling or
// the car selling, comes from the crawl, which tests never run; so a test writes the change the way the crawl does (a
// price event and the listing's new price, or a status the lifecycle allows) as the migration role, and then runs one pass
// of the producer, `pnpm marks:notify`, which is the worker's marks.notify job outside the queue. These tests need the
// database the app under test uses, and no worker running against it (it would run the same pass, harmlessly).

const REPOSITORY = fileURLToPath(new URL('../..', import.meta.url));

export const MARKS = {
  mark: 'نشان کردن',
  markNamed: /^نشان کردن آگهی /,
  pageTitle: 'آگهی‌های نشان‌شده',
  menuItem: 'آگهی‌های نشان‌شده',
  visitorHeading: 'برای نشان کردن وارد شوید',
  signIn: 'ورود',
  announcedBack: 'آگهی برایتان نشان شد.',
  failure: 'آگهی نشان نشد.',
  unmarkFailure: 'نشان آگهی برداشته نشد.',
  retry: 'تلاش دوباره',
  priceDown: 'قیمت کم شد',
  priceUp: 'قیمت بالا رفت',
  sold: 'فروخته شد',
  emptyHeading: 'هنوز آگهی‌ای نشان نکرده‌اید',
  filters: { all: 'همه', active: 'در بازار', dropped: 'قیمتشان کم شده', off: 'از بازار رفته' },
  unmarkedNotice: 'نشان برداشته شد.',
} as const;

function migrateUrl(): string {
  const fromEnvironment = process.env.DATABASE_MIGRATE_URL;
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const url = parseEnv(
    readFileSync(fileURLToPath(new URL('../../.env', import.meta.url)), 'utf8'),
  ).DATABASE_MIGRATE_URL;
  if (url === undefined || url === '') throw new Error('DATABASE_MIGRATE_URL is not set.');
  return url;
}

async function asOwner<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: migrateUrl(), application_name: 'carshenas-e2e' });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** The listing now asks `priceToman`: a price event after the listing's latest one, and the listing's own price. */
export async function changePrice(listingId: number, priceToman: number): Promise<void> {
  await asOwner(async (client) => {
    await client.query('BEGIN');
    const snapshot = await client.query<{ id: number }>(
      `INSERT INTO snapshot (listing_id, first_fetched_at, url, canonical_version, payload)
       VALUES ($1, now(), 'https://api.test.example/post/e2e-marks', 1, jsonb_build_object('price', $2::bigint, 'at', clock_timestamp()::text)) RETURNING id`,
      [listingId, priceToman],
    );
    await client.query(
      `INSERT INTO listing_price_event (listing_id, observed_at, price_type, asking_price_toman, snapshot_id)
       VALUES ($1, greatest(now(), (SELECT max(observed_at) + interval '1 minute' FROM listing_price_event WHERE listing_id = $1)),
               'asking', $2, $3)`,
      [listingId, priceToman, snapshot.rows[0]?.id],
    );
    await client.query('UPDATE listing SET asking_price_toman = $2 WHERE id = $1', [listingId, priceToman]);
    await client.query('COMMIT');
  });
}

/** The listing leaves the market (sold, expired or gone), or comes back (active), as the lifecycle allows. */
export async function setStatus(
  listingId: number,
  status: 'active' | 'sold' | 'expired' | 'gone',
): Promise<void> {
  await asOwner(async (client) => {
    await client.query(
      `UPDATE listing SET status = $2, delisted_at = CASE WHEN $2 = 'active' THEN NULL ELSE now() END,
                          last_seen_at = CASE WHEN $2 IN ('expired', 'gone') THEN now() - interval '1 hour' ELSE last_seen_at END
       WHERE id = $1`,
      [listingId, status],
    );
  });
}

export type NotifyOutcome = { priceDrops: number; offMarket: number; relisted: number; skipped: number };

/** One pass of the producer: tells every buyer who marked what changed. */
export function notifyMarks(): NotifyOutcome {
  const output = execFileSync('pnpm', ['--silent', 'marks:notify'], {
    cwd: REPOSITORY,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(output.trim().split('\n').at(-1) ?? '{}') as NotifyOutcome;
}
