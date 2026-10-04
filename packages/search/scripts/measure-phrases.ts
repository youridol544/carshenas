// Runs a labelled list of phrases against a running app and records what the plain-Farsi understanding and the search
// API answer (CS-100, criterion 1): for each phrase the filters the code-only understanding reads, the words it left
// unused, the number of listings the search API counts for what was understood and for the raw words as a text search,
// and whether the understood filters are exactly the labelled ones. One markdown table on stdout and the full answers
// as JSON. `node --experimental-strip-types scripts/measure-phrases.ts <phrases.json> <base-url> <out.json>`.
// The app should run with SEARCH_UNDERSTANDING_AI off (the default), so the answers are code's own and cost nothing.
import { readFileSync, writeFileSync } from 'node:fs';
import { toSearchParams, type Search } from '../src/search.ts';

type Item = {
  readonly id: string;
  readonly category: string;
  readonly text: string;
  readonly expected: { readonly filters: Record<string, unknown> };
};

const [file, base, out] = process.argv.slice(2);
if (file === undefined || base === undefined || out === undefined) {
  process.stderr.write('usage: measure-phrases.ts <phrases.json> <base-url> <out.json>\n');
  process.exit(2);
}
const items = (JSON.parse(readFileSync(file, 'utf8')) as { items: Item[] }).items;

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sorted(entry)]),
    );
  }
  return value;
}
const same = (a: unknown, b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

async function count(search: Search): Promise<string> {
  const params = toSearchParams(search);
  params.set('limit', '0');
  const response = await fetch(`${base}/api/search?${params.toString()}`);
  if (!response.ok) return `HTTP ${String(response.status)}`;
  const body = (await response.json()) as { total: { count: number; exact: boolean } };
  return `${String(body.total.count)}${body.total.exact ? '' : '+'}`;
}

const rows: Record<string, unknown>[] = [];
for (const item of items) {
  const response = await fetch(`${base}/api/search/understand`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ q: item.text }),
  });
  const body = (await response.json()) as {
    mode: string;
    understanding: {
      search: Search;
      chips: { label?: string; text?: string }[];
      unused: { words: string }[];
      textSearch: boolean;
    };
  };
  const { search, unused, textSearch, chips } = body.understanding;
  const understoodCount = await count(search);
  const rawCount = await count({ q: item.text, filters: {} });
  const filters = search.filters as Record<string, unknown>;
  const right = same(filters, item.expected.filters) && !textSearch && unused.length === 0;
  rows.push({
    id: item.id,
    category: item.category,
    text: item.text,
    expected: item.expected.filters,
    filters,
    q: search.q ?? null,
    unused: unused.map((group) => group.words),
    textSearch,
    chips: chips.map((chip) => chip.text ?? chip.label ?? ''),
    understoodCount,
    rawCount,
    right,
  });
}
writeFileSync(out, `${JSON.stringify({ measuredAt: new Date().toISOString(), base, rows }, null, 1)}\n`);

const cell = (text: string) => text.replaceAll('|', '/').replaceAll('\n', ' ');
process.stdout.write(
  '| # | Phrase | Filters understood | Words left unused | Listings (understood) | Listings (raw words as text) | As labelled |\n',
);
process.stdout.write('|---|---|---|---|---|---|---|\n');
for (const row of rows) {
  const filters = JSON.stringify(row.filters);
  process.stdout.write(
    `| ${cell(String(row.id))} | ${cell(String(row.text))} | \`${cell(filters)}\`${row.textSearch ? ' (text search)' : ''} | ${cell((row.unused as string[]).join('، '))} | ${cell(String(row.understoodCount))} | ${cell(String(row.rawCount))} | ${row.right ? 'yes' : 'no'} |\n`,
  );
}
const right = rows.filter((row) => row.right).length;
process.stdout.write(`\nAs labelled: ${String(right)} of ${String(rows.length)}.\n`);
