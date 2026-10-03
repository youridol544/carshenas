// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createMigratedDatabase } from '@/server/db/schema-test-database';

// Model photo links (CS-97, ADR-0038): what the schema enforces about an address and who may change it, proved by what
// PostgreSQL rejects (SQLSTATE and constraint name). Each test runs in a transaction that is rolled back.

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDatabase();
}, 60_000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec('BEGIN');
});
afterEach(async () => {
  await db.exec('ROLLBACK');
});

const HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';

async function returningId(statement: string, params: unknown[] = []): Promise<number> {
  const { rows } = await db.query<{ id: number | bigint }>(statement, params);
  const [row] = rows;
  if (!row) throw new Error(`no row returned: ${statement}`);
  return Number(row.id);
}

async function failure(statement: string, params: unknown[] = []): Promise<unknown> {
  await db.exec('SAVEPOINT expected_failure');
  try {
    await db.query(statement, params);
  } catch (error) {
    await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
    return error;
  }
  await db.exec('RELEASE SAVEPOINT expected_failure');
  throw new Error(`expected this statement to fail: ${statement}`);
}

async function fixtures() {
  const admin = await returningId(
    `INSERT INTO account (username, password_hash, role) VALUES ('admin_1', $1, 'superadmin') RETURNING id`,
    [HASH],
  );
  const buyer = await returningId(
    `INSERT INTO account (username, password_hash, role) VALUES ('ali_1403', $1, 'buyer') RETURNING id`,
    [HASH],
  );
  const makeId = await returningId(
    `INSERT INTO make (slug, name_en) VALUES ('peugeot', 'Peugeot') RETURNING id`,
  );
  const modelId = await returningId(
    `INSERT INTO model (make_id, slug, name_en) VALUES ($1, '206', '206') RETURNING id`,
    [makeId],
  );
  return { admin, buyer, modelId };
}

async function setLink(modelId: number, url: string | null, by: number): Promise<string | undefined> {
  const { rows } = await db.query<{ outcome: string }>(`SELECT set_model_photo_link($1, $2, $3) AS outcome`, [
    modelId,
    url,
    by,
  ]);
  return rows[0]?.outcome;
}

test('the superadmin sets, replaces and clears a link through the function, which records who and repeats safely', async () => {
  const { admin, modelId } = await fixtures();
  const first = 'https://images.example-cars.ir/pars/front.jpg';
  const second = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Peugeot_Pars.png?width=800';
  expect(await setLink(modelId, first, admin)).toBe('changed');
  expect(await setLink(modelId, first, admin)).toBe('unchanged');
  expect(await setLink(modelId, second, admin)).toBe('changed');
  expect(await setLink(modelId, null, admin)).toBe('changed');
  expect(await setLink(modelId, null, admin)).toBe('unchanged');
  expect(await setLink(999_999, first, admin)).toBe('missing');
  const { rows } = await db.query<{
    action: string;
    from_url: string | null;
    to_url: string | null;
    by: number;
  }>(
    `SELECT action, from_url, to_url, by_account_id::int AS by FROM model_photo_link_change WHERE model_id = $1 ORDER BY id`,
    [modelId],
  );
  expect(rows).toEqual([
    { action: 'set', from_url: null, to_url: first, by: admin },
    { action: 'replaced', from_url: first, to_url: second, by: admin },
    { action: 'cleared', from_url: second, to_url: null, by: admin },
  ]);
  const { rows: left } = await db.query(`SELECT * FROM model_photo_link`);
  expect(left).toHaveLength(0);
});

test('a link must be one line of plain https with a real host, at most 500 characters', async () => {
  const { admin, modelId } = await fixtures();
  const refused = async (url: string, constraint: string) => {
    expect(await failure(`SELECT set_model_photo_link($1, $2, $3)`, [modelId, url, admin])).toMatchObject({
      code: '23514',
      constraint,
    });
  };
  await refused('http://cdn.example.ir/a.jpg', 'model_photo_link_host');
  // PostgreSQL names the first failing check in name order: a host check comes before https.
  await refused('ftp://cdn.example.ir/a.jpg', 'model_photo_link_host');
  await refused('https://', 'model_photo_link_host');
  await refused(`https://cdn.example.ir/${'a'.repeat(500)}.jpg`, 'model_photo_link_length');
  await refused('https://cdn.example.ir/a b.jpg', 'model_photo_link_plain');
  await refused('https://cdn.example.ir/a.jpg"onerror=1', 'model_photo_link_plain');
  await refused('https://cdn.example.ir/<a>.jpg', 'model_photo_link_plain');
  await refused(`https://cdn.example.ir/a${String.fromCharCode(0x200e)}.jpg`, 'model_photo_link_plain');
  await refused('https://user:pass@cdn.example.ir/a.jpg', 'model_photo_link_host');
  await refused('https://localhost/a.jpg', 'model_photo_link_host');
  await refused('https://intranet/a.jpg', 'model_photo_link_host');
  await refused('https://127.0.0.1/a.jpg', 'model_photo_link_host');
  await refused('https://192.168.1.5:8080/a.jpg', 'model_photo_link_host');
  await refused('https://printer.local/a.jpg', 'model_photo_link_host');
  await refused('https://-bad.example.ir/a.jpg', 'model_photo_link_host');
  await refused('https://0x7f.0.0.1/a.jpg', 'model_photo_link_host');
  await refused('https://2130706433/a.jpg', 'model_photo_link_host');
  await refused('https://cdn.example.ir:0/a.jpg', 'model_photo_link_host');
  await refused('https://cdn.example.ir:65536/a.jpg', 'model_photo_link_host');
  await refused(`https://${'a'.repeat(64)}.example.ir/a.jpg`, 'model_photo_link_host');
  await refused('https://123.example.ir/a.jpg', 'model_photo_link_host');
  await refused('https://cdn.example.1/a.jpg', 'model_photo_link_host');
  expect(await setLink(modelId, 'https://CDN.Example.ir:8443/a/b.JPG?w=1', admin)).toBe('changed');
  expect(await setLink(modelId, 'https://cdn.example.ir:65535/a.jpg', admin)).toBe('changed');
});

test('only a superadmin changes a link, and the web role reads the address and nothing else', async () => {
  const { admin, buyer, modelId } = await fixtures();
  expect(
    await failure(`SELECT set_model_photo_link($1, 'https://cdn.example.ir/a.jpg', $2)`, [modelId, buyer]),
  ).toMatchObject({
    code: '23514',
    constraint: 'model_photo_link_by_superadmin',
  });
  await setLink(modelId, 'https://cdn.example.ir/a.jpg', admin);
  expect(await failure(`DELETE FROM model_photo_link_change`)).toBeDefined();
  expect(await failure(`UPDATE model_photo_link_change SET to_url = 'https://x.example.ir/a'`)).toBeDefined();
  await db.exec('SET LOCAL ROLE carshenas_web');
  await db.query(`SELECT model_id, url FROM model_photo_link`);
  expect(await failure(`SELECT set_by_account_id FROM model_photo_link`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT * FROM model_photo_link_change`)).toMatchObject({ code: '42501' });
  expect(await failure(`DELETE FROM model_photo_link`)).toMatchObject({ code: '42501' });
  expect(await failure(`SELECT set_model_photo_link($1, NULL, $2)`, [modelId, admin])).toMatchObject({
    code: '42501',
  });
  await db.exec('RESET ROLE');
  await db.exec('SET LOCAL ROLE carshenas_admin');
  await db.query(`SELECT * FROM model_photo_link`);
  expect(await failure(`UPDATE model_photo_link SET url = 'https://x.example.ir/a'`)).toMatchObject({
    code: '42501',
  });
  expect(await setLink(modelId, null, admin)).toBe('changed');
  await db.exec('RESET ROLE');
});
