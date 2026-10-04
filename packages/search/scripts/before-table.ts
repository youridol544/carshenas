// Turns what the understanding of an older checkout answered for a list of phrases (one JSON line each: filters, the text
// search it fell back to, the words it left unused) into a markdown table with how many listings that search returns now,
// from a running app (CS-103 evidence: what main answered before the country and origin words).
//   node --experimental-strip-types scripts/before-table.ts <answers.jsonl> <base-url>
import { readFileSync } from 'node:fs';
import { toSearchParams, type Search } from '../src/search.ts';

const [file, base] = process.argv.slice(2);
if (file === undefined || base === undefined) {
  process.stderr.write('usage: before-table.ts <answers.jsonl> <base-url>\n');
  process.exit(2);
}
type Answer = {
  id: string;
  text: string;
  filters: Record<string, unknown>;
  q: string | null;
  textSearch: boolean;
  unused: string[];
};
const answers = readFileSync(file, 'utf8')
  .split('\n')
  .filter((line) => line !== '')
  .map((line) => JSON.parse(line) as Answer);

process.stdout.write('| # | Phrase | Filters main understood | Fell back to a text search of | Words left unused | Listings that returned |\n');
process.stdout.write('|---|---|---|---|---|---|\n');
for (const answer of answers) {
  const search = { ...(answer.q === null ? {} : { q: answer.q }), filters: answer.filters } as Search;
  const params = toSearchParams(search);
  params.set('limit', '0');
  const response = await fetch(`${base}/api/search?${params.toString()}`);
  const body = (await response.json()) as { total: { count: number } };
  process.stdout.write(
    `| ${answer.id} | ${answer.text} | \`${JSON.stringify(answer.filters)}\` | ${answer.q ?? ''} | ${answer.unused.join('، ')} | ${String(body.total.count)} |\n`,
  );
}
