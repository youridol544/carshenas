// Measures how well the catalogue's names read the car from an ad's title (CS-115, ADR-0046): every listing of the database
// DATABASE_URL names whose own page was read has a title (what the seller wrote, which Divar puts in the ad's address with
// dashes for spaces) and a model Divar itself filed it under (the structured field, which the catalogue maps to a model).
// The title is turned into the address's form, read back with the link reader's own steps, and the car the matcher names is
// compared with the model the listing is filed under. One markdown report on stdout; with `--json <file>` the rows too.
//
//   pnpm --filter @carshenas/search measure:title-car [--sample 300] [--json out.json]
//
// A listing of a model the matcher names a trim of counts as that model. The measure reads titles of the models Carshenas
// reads in depth (the index holds nothing else), so it says how well a covered car is told from its link; the match of
// an uncovered car is checked on the hand-written titles in title-car.test.ts, which are labelled as such.
import { writeFileSync } from 'node:fs';
import type { ReadonlyKysely } from 'kysely/readonly';
import { createDatabase } from '@carshenas/db/database';
import type { DB } from '@carshenas/db/db-types';
import { buildLexicon } from '../src/understand/lexicon.ts';
import { readLexiconRows } from '../src/understand/lexicon-queries.ts';
import { readCarFromTitle, titleOfSlug } from '../src/understand/title-car.ts';

const url = process.env.DATABASE_URL;
if (url === undefined) {
  process.stderr.write('DATABASE_URL names the database to measure\n');
  process.exit(2);
}
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
const sampleSize = Number(flag('--sample') ?? '0');
const jsonFile = flag('--json');

const db = createDatabase({
  connectionString: url,
  applicationName: 'carshenas-title-car-measure',
  max: 1,
  onIdleError: () => undefined,
});

/** A title as it is shown in the report: a run of seven digits or more (a phone number) is never copied out of the database. */
function shown(title: string): string {
  return title
    .replace(/[0-9\u06F0-\u06F9\u0660-\u0669](?:[\s-]?[0-9\u06F0-\u06F9\u0660-\u0669]){6,}/g, '#')
    .replaceAll('|', '/');
}

/** A title as Divar writes it in an address: spaces are dashes, the rest as typed. */
function slugOf(title: string): string {
  return title.trim().replace(/\s+/g, '-');
}

/** Seeded, so a sample can be drawn again: mulberry32. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Row = { id: number; title: string; truth: string };
type Outcome = 'model_right' | 'model_wrong' | 'make_right' | 'make_wrong' | 'ambiguous' | 'none';

try {
  const rows = await readLexiconRows(db as unknown as ReadonlyKysely<DB>);
  const lexicon = buildLexicon(rows);
  const found = await db
    .selectFrom('listing as l')
    .innerJoin('model as m', 'm.id', 'l.model_id')
    .innerJoin('make as k', 'k.id', 'm.make_id')
    .select(['l.id', 'l.title', 'k.slug as make_slug', 'm.slug as model_slug'])
    .where('l.title', 'is not', null)
    .orderBy('l.id')
    .execute();
  let all: Row[] = found.flatMap((row) =>
    row.title === null ? [] : [{ id: row.id, title: row.title, truth: `${row.make_slug}.${row.model_slug}` }],
  );
  if (sampleSize > 0 && sampleSize < all.length) {
    const next = random(115);
    const picked = new Set<number>();
    while (picked.size < sampleSize) picked.add(Math.floor(next() * all.length));
    all = [...picked]
      .sort((a, b) => a - b)
      .flatMap((index) => (all[index] === undefined ? [] : [all[index]]));
  }

  const counts: Record<Outcome, number> = {
    model_right: 0,
    model_wrong: 0,
    make_right: 0,
    make_wrong: 0,
    ambiguous: 0,
    none: 0,
  };
  const perModel = new Map<string, { n: number; right: number; wrong: number; unread: number }>();
  const misses: { id: number; title: string; truth: string; read: string }[] = [];
  const detail: { id: number; title: string; truth: string; outcome: Outcome; read: string }[] = [];
  for (const row of all) {
    const car = readCarFromTitle(titleOfSlug(slugOf(row.title)), lexicon);
    let outcome: Outcome;
    let read = '';
    if (car.kind === 'model') {
      read = car.model.key;
      outcome = car.model.key === row.truth ? 'model_right' : 'model_wrong';
    } else if (car.kind === 'make') {
      read = car.make.key;
      outcome = car.make.key === row.truth.split('.')[0] ? 'make_right' : 'make_wrong';
    } else if (car.kind === 'ambiguous') {
      read = car.entities.map((entity) => entity.key).join(' | ');
      outcome = 'ambiguous';
    } else {
      outcome = 'none';
    }
    counts[outcome] += 1;
    const per = perModel.get(row.truth) ?? { n: 0, right: 0, wrong: 0, unread: 0 };
    per.n += 1;
    if (outcome === 'model_right') per.right += 1;
    else if (outcome === 'model_wrong' || outcome === 'make_wrong') per.wrong += 1;
    else per.unread += 1;
    perModel.set(row.truth, per);
    if (outcome !== 'model_right') misses.push({ id: row.id, title: row.title, truth: row.truth, read });
    detail.push({ id: row.id, title: row.title, truth: row.truth, outcome, read });
  }

  const total = all.length;
  const pct = (n: number) => `${((100 * n) / Math.max(total, 1)).toFixed(1)} %`;
  const answered = counts.model_right + counts.model_wrong;
  const out: string[] = [];
  out.push(`# Car read from the title, ${String(total)} real titles`);
  out.push('');
  out.push(
    `Source: listings of ${url.replace(/\/\/[^@]*@/, '//')} whose own page was read; truth = the model Divar filed the listing under.`,
  );
  out.push('');
  out.push('| Outcome | Listings | Share |');
  out.push('|---|---:|---:|');
  out.push(`| the right model | ${String(counts.model_right)} | ${pct(counts.model_right)} |`);
  out.push(`| a wrong model | ${String(counts.model_wrong)} | ${pct(counts.model_wrong)} |`);
  out.push(`| only the right make | ${String(counts.make_right)} | ${pct(counts.make_right)} |`);
  out.push(`| only a wrong make | ${String(counts.make_wrong)} | ${pct(counts.make_wrong)} |`);
  out.push(`| ambiguous (more than one) | ${String(counts.ambiguous)} | ${pct(counts.ambiguous)} |`);
  out.push(`| nothing named | ${String(counts.none)} | ${pct(counts.none)} |`);
  out.push('');
  out.push(
    `Accuracy where a model is named: ${String(counts.model_right)} of ${String(answered)} (${answered === 0 ? '0' : ((100 * counts.model_right) / answered).toFixed(1)} %). ` +
      `Recall (the right model of all titles): ${pct(counts.model_right)}.`,
  );
  out.push('');
  out.push('| Model | Titles | Right | Wrong | Unread |');
  out.push('|---|---:|---:|---:|---:|');
  for (const [model, per] of [...perModel].sort((a, b) => b[1].n - a[1].n)) {
    out.push(
      `| ${model} | ${String(per.n)} | ${String(per.right)} | ${String(per.wrong)} | ${String(per.unread)} |`,
    );
  }
  out.push('');
  out.push('First 40 titles that were not read as their model:');
  out.push('');
  out.push('| id | title | filed as | read as |');
  out.push('|---:|---|---|---|');
  for (const miss of misses.slice(0, 40)) {
    out.push(`| ${String(miss.id)} | ${shown(miss.title)} | ${miss.truth} | ${miss.read || '-'} |`);
  }
  process.stdout.write(`${out.join('\n')}\n`);
  if (jsonFile !== undefined) {
    const keepTitles = args.includes('--titles');
    const rowsOut = detail.map((row) =>
      keepTitles
        ? { ...row, title: shown(row.title) }
        : { id: row.id, truth: row.truth, outcome: row.outcome, read: row.read },
    );
    writeFileSync(jsonFile, `${JSON.stringify({ total, counts, detail: rowsOut })}\n`);
  }
} finally {
  await db.destroy();
}
