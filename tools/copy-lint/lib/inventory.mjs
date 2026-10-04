// Builds docs/design/copy-rewrite-plan.md from a scan, the lint's violations and the area assignment (areas.mjs).
import {
  AREAS,
  NOTES,
  OVERRIDES,
  OWNED_ELSEWHERE,
  PARALLEL_LANES,
  assignFile,
  partition,
} from '../areas.mjs';
import { matchesGlob } from './glob.mjs';
import { compareText } from './sort.mjs';
import { EXCLUDED, SCAN_ROOTS, SHARED_TEXT } from '../copy-files.mjs';

const number = (value) => value.toLocaleString('en-US');
const cell = (text) =>
  String(text ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');

const stringsOf = (entry) => entry.units.filter((unit) => unit.persian).length;
const baseName = (file) => file.split('/').at(-1);

/** Per-file figures for every copy file: `{ file, via, strings, separators, violations }`. */
export function figures(scanResult, findings) {
  const violations = new Map();
  for (const finding of findings) violations.set(finding.file, (violations.get(finding.file) ?? 0) + 1);
  return scanResult.copy
    .map((entry) => ({
      file: entry.file,
      via: entry.via,
      strings: stringsOf(entry),
      separators: entry.units.filter((unit) => unit.dot && !unit.persian).length,
      violations: violations.get(entry.file) ?? 0,
    }))
    .sort((a, b) => compareText(a.file, b.file));
}

function areaSection(id, area, rows, partitionOf) {
  const lines = [];
  const files = partitionOf.byArea.get(id) ?? [];
  const byFile = new Map(rows.map((row) => [row.file, row]));
  const listed = files.map((entry) => ({ ...entry, ...byFile.get(entry.file) }));
  const strings = listed.reduce((sum, row) => sum + row.strings, 0);
  const violations = listed.reduce((sum, row) => sum + row.violations, 0);
  lines.push(`## ${id === 'CS-115' ? 'Owned by CS-115' : `Area ${id}`}: ${area.title}`);
  lines.push('');
  lines.push(`**${area.task}.** ${area.covers}`);
  lines.push('');
  lines.push(
    `${number(listed.length)} files, ${number(strings)} strings, ${number(violations)} lint violations today.` +
      (listed.length > 0
        ? ` Biggest: ${[...listed]
            .filter((row) => row.strings > 0)
            .sort((a, b) => b.strings - a.strings)
            .slice(0, 4)
            .map((row) => `\`${baseName(row.file)}\` (${number(row.strings)})`)
            .join(', ')}.`
        : ''),
  );
  lines.push('');
  if (listed.length === 0) {
    lines.push('No file holds text in this area yet.');
    lines.push('');
    return lines;
  }
  lines.push('| File | Strings | Violations | Notes |');
  lines.push('|---|---:|---:|---|');
  for (const row of listed) {
    const noun = `separator${row.separators === 1 ? '' : 's'}`;
    let separators = '';
    if (row.separators > 0) {
      separators =
        row.strings === 0 ? `${row.separators} ${noun} only. ` : `Also ${row.separators} ${noun}. `;
    }
    lines.push(
      `| \`${row.file}\` | ${number(row.strings)} | ${number(row.violations)} | ${cell(`${separators}${row.note ?? ''}`.trim())} |`,
    );
  }
  lines.push('');
  return lines;
}

export function buildPlan({ scanResult, findings, date }) {
  const rows = figures(scanResult, findings);
  const files = rows.map((row) => row.file);
  const parts = partition(files);
  const ids = [...Object.keys(AREAS), ...Object.keys(OWNED_ELSEWHERE)];
  const totals = (id) => {
    const listed = (parts.byArea.get(id) ?? []).map((entry) => rows.find((row) => row.file === entry.file));
    return {
      files: listed.length,
      strings: listed.reduce((sum, row) => sum + row.strings, 0),
      violations: listed.reduce((sum, row) => sum + row.violations, 0),
      biggest: [...listed]
        .filter((row) => row.strings > 0)
        .sort((a, b) => b.strings - a.strings)
        .slice(0, 3),
    };
  };
  const lines = [];
  lines.push('# Copy rewrite plan');
  lines.push('');
  lines.push(
    `> Generated on ${date} by \`pnpm copy:inventory\` (CS-105) from the same file scan as \`pnpm copy:lint\`. Do not edit by hand: the assignment lives in \`tools/copy-lint/areas.mjs\` and the scope in \`tools/copy-lint/copy-files.mjs\`; change them and regenerate. The counts are the state before any rewrite lane has changed a string; the lanes lower them.`,
  );
  lines.push('');
  lines.push('## Why, and how the work is split');
  lines.push('');
  lines.push(
    'The owner (2026-10-04) finds the product copy fluffy, repetitive, too technical and not native Farsi, and wants all of it rewritten to a voice guide. CS-104 writes the guide, the `copy-fa` skill and the `copy-reviewer` agent; CS-105 (this document and `pnpm copy:lint`) finds what is objectively wrong and splits the files; CS-106 to CS-110 rewrite, one lane per area, in parallel. The split is by file, so two lanes never edit the same file.',
  );
  lines.push('');
  lines.push('| Area | Lane | Files | Strings | Lint violations | Biggest files |');
  lines.push('|---|---|---:|---:|---:|---|');
  let sumFiles = 0;
  let sumStrings = 0;
  let sumViolations = 0;
  for (const id of ids) {
    const area = AREAS[id] ?? OWNED_ELSEWHERE[id];
    const t = totals(id);
    sumFiles += t.files;
    sumStrings += t.strings;
    sumViolations += t.violations;
    lines.push(
      `| ${id === 'CS-115' ? 'Owned by CS-115' : id}: ${cell(area.title)} | ${area.task} | ${number(t.files)} | ${number(t.strings)} | ${number(t.violations)} | ${t.biggest.map((row) => `\`${baseName(row.file)}\` (${number(row.strings)})`).join(', ')} |`,
    );
  }
  lines.push(
    `| **Total** | | **${number(sumFiles)}** | **${number(sumStrings)}** | **${number(sumViolations)}** | |`,
  );
  lines.push('');
  lines.push(
    'A string is one piece of text a person could read: a string literal, a template literal (its static parts, each `${…}` counted as one hole), a piece of JSX text or a string attribute, with at least one Persian word in it. Vocabulary lists (`words`) are not strings in this sense, and a file that only joins what it shows with « · » counts as a copy file with no strings of its own.',
  );
  lines.push('');

  lines.push('## What counts as a copy file');
  lines.push('');
  lines.push(
    `A source file under ${SCAN_ROOTS.map((root) => `\`${root}\``).join(', ')} is a copy file when it has a string with a Persian word in it (two letters of the Arabic script in a row; punctuation such as «،» and digits do not count) and is not a test, a spec or test support. It is **copy** by one of three routes, and anything else with Persian text is **excluded** with a reason (the last section) or fails \`pnpm copy:test\`:`,
  );
  lines.push('');
  lines.push(
    '1. **By name**: `*-copy.ts` and `*-copy.tsx` under `apps/web/src`: a feature keeps its words in one file.',
  );
  lines.push(
    `2. **Shared text**: modules outside the app that print words: ${SHARED_TEXT.map((entry) => `\`${entry.glob}\``).join('; ')}.`,
  );
  lines.push(
    "3. **Inline**: any other file under `apps/web/src` with an inline Persian string (components, pages, view-model files such as `listing-view.ts` and `gauge-view.ts`, route handlers), and the JSON data files under `apps/web/public` (the hero photographs' alt texts).",
  );
  lines.push('');

  lines.push('## Rules for the parallel lanes');
  lines.push('');
  lines.push(
    '1. **Strings only.** Change the words, never the structure: no new props, components, keys or files, nothing moved or renamed. Ids, keys, enum values, stored forms and notification payloads stay unchanged; every number a buyer sees still comes from the database (the listing explanation keeps its faithfulness test passing).',
  );
  lines.push(
    "2. **Your area's files only.** A file in another area is read-only for you, even for a string you dislike: record it in your evidence table and tell the lane that owns it. A string shared through a constant lives with the area that owns the constant (see the notes in the tables).",
  );
  lines.push(
    `3. **Merge main often.** CS-111 (smart search), CS-112 (interface polish), CS-113 (model photos), CS-114 (search UX) and CS-115 (check a link) run in parallel and may touch components. Merge main at the start of each slice and before you report. On a conflict keep their structure and re-apply your words.`,
  );
  lines.push(
    '4. **Tests that match text use the central copy constants** (the exports of the `*-copy.ts` files) and never retype Persian: retyping loses the zero-width non-joiner. Update a test only by switching it to the constant; never weaken an assertion.',
  );
  lines.push(
    '5. **The lint.** `pnpm copy:lint <your files>` while you work. When you fix violations, run `pnpm copy:lint --update-baseline` and commit `tools/copy-lint/baseline.json`: it only ever lowers. Do not add an allowlist entry or an ignore comment to get green; fix the text. A conflict in `baseline.json` is resolved by taking either side and running `--update-baseline` again.',
  );
  lines.push(
    '6. **Evidence.** A before-and-after table with counts (reviewed, changed, kept) in `docs/evidence/copy/<area>.md`, the voice guide (`docs/design/product-voice.md`) and the `copy-reviewer` pass, and screenshots of the changed screens at 412 and 1440.',
  );
  lines.push(
    '7. **A new file with Persian text needs an owner.** Add it to `tools/copy-lint/areas.mjs` in the same commit (a glob that already covers its folder does it by itself); `pnpm copy:test` fails otherwise.',
  );
  lines.push('');
  lines.push('Other tasks that run in parallel and touch some of the same folders:');
  lines.push('');
  lines.push('| Task | What | Touches |');
  lines.push('|---|---|---|');
  for (const lane of PARALLEL_LANES)
    lines.push(`| ${lane.task} | ${cell(lane.what)} | ${cell(lane.touches)} |`);
  lines.push('');

  for (const id of ids) {
    const area = AREAS[id] ?? OWNED_ELSEWHERE[id];
    lines.push(...areaSection(id, area, rows, parts));
  }

  lines.push('## Decisions on shared and straddling files');
  lines.push('');
  lines.push(
    'A file that straddles two areas goes to the area that owns most of its strings, and a string shared through a constant lives with the area that owns the constant. The other lane treats such a file as read-only. These are the decisions, and the hot spots that other running tasks also change:',
  );
  lines.push('');
  lines.push('| File | Owner | Why |');
  lines.push('|---|---|---|');
  const decisions = [
    ...OVERRIDES.map((entry) => ({ glob: entry.file, note: entry.note })),
    ...NOTES.filter((entry) => entry.kind !== 'rule'),
  ];
  for (const entry of decisions) {
    const matching = files.filter((file) => matchesGlob(file, entry.glob));
    if (matching.length === 0) continue;
    const owner = assignFile(matching[0]).area;
    const shown = matching.length === 1 ? `\`${matching[0]}\`` : `\`${entry.glob}\``;
    lines.push(`| ${shown} | ${owner} | ${cell(entry.note)} |`);
  }
  lines.push('');
  lines.push('## Persian text that is not copy');
  lines.push('');
  lines.push(
    'These files have strings with Persian words that no buyer or superadmin reads as product text, so no lane rewrites them and the lint skips them. Tests, specs and test support are never copy and are not listed. Data in the database (the name of a source, the catalogue) is data, not copy: migrations are history and are never edited. The reason for each exclusion is in `tools/copy-lint/copy-files.mjs`.',
  );
  lines.push('');
  const byReason = new Map();
  for (const entry of scanResult.excluded) {
    if (!byReason.has(entry.reason)) byReason.set(entry.reason, []);
    byReason.get(entry.reason).push(entry);
  }
  const order = EXCLUDED.map((entry) => entry.reason);
  const reasons = [...byReason.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const reason of reasons) {
    const list = byReason.get(reason);
    lines.push(`- **${cell(reason)}**`);
    for (const entry of list) lines.push(`  - \`${entry.file}\` (${number(entry.strings)})`);
  }
  lines.push('');
  lines.push('## Regenerating');
  lines.push('');
  lines.push(
    '`pnpm copy:inventory` rewrites this file; `pnpm copy:inventory --stdout` prints it instead. `pnpm copy:test` checks that every copy file is in exactly one area (or the CS-115 list) and that no assignment is dead. The lint is documented in `docs/runbooks/copy-lint.md`.',
  );
  lines.push('');
  return { markdown: lines.join('\n'), partition: parts, rows };
}
