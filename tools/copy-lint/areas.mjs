// THE REWRITE AREAS (CS-105): which lane rewrites which copy file. Five areas and one list owned by another task, with
// disjoint file lists: `pnpm copy:test` fails when a copy file belongs to no area or to two, so a new file with Persian
// text must be given an owner here (a glob that already covers its folder does it by itself).
//
// How a file is assigned: an entry of OVERRIDES wins (use it for a file that sits in one area's folder but belongs to
// another, with the reason); otherwise exactly one area's `include` globs must match. The rules for deciding:
//   - a file that straddles two areas goes to the area that owns most of its strings (the note says so);
//   - a string shared through a constant lives with the area that owns the constant;
//   - the check-a-link feature belongs to no area: CS-115 owns it, copy included.
// `pnpm copy:inventory` writes docs/design/copy-rewrite-plan.md from this file and the scan.
import { matchesGlob } from './lib/glob.mjs';

export const AREAS = {
  A: {
    title: 'Public pages and the shell',
    task: 'CS-106',
    covers:
      'The home page and its hero (with the alt texts of the hero photographs in apps/web/public), the shell (header, footer, credits), the models index and the model pages, the data status page, the not-found and error pages.',
    include: [
      'apps/web/src/app/*.tsx',
      'apps/web/src/app/(site)/*.tsx',
      'apps/web/src/app/(site)/models/**',
      'apps/web/src/app/(site)/status/**',
      'apps/web/src/components/layout/**',
      'apps/web/src/features/home/**',
      'apps/web/src/features/body-types/**',
      'apps/web/src/features/model/**',
      'apps/web/src/features/data-status/**',
      'apps/web/src/server/observability/**',
      'apps/web/public/**',
    ],
  },
  B: {
    title: 'Search, filters, understanding, the listing page and cards',
    task: 'CS-107',
    covers:
      'The search page and filter panel, the chips and the results (empty and no-results states), the understanding messages, the listing page (facts, price analysis, explanation templates, condition notes, risks, comparables, history), the result cards and the assumed-mileage notes.',
    include: [
      'apps/web/src/app/(site)/search/**',
      'apps/web/src/app/(site)/listings/**',
      'apps/web/src/app/api/search/**',
      'apps/web/src/features/search/**',
      'apps/web/src/features/search-understanding/**',
      'apps/web/src/features/listing/**',
      'packages/search/src/understand/{merge,understand,intents}.ts',
    ],
  },
  C: {
    title: 'Accounts, notifications and buyer tools',
    task: 'CS-108',
    covers:
      'Sign in and sign up, the account pages, the notifications inbox and each notification kind (title, detail and settings), the marked listings, the search files and their alerts, the crawl-request card on a file page, the buyer-side messages.',
    include: [
      'apps/web/src/app/(auth)/**',
      'apps/web/src/app/(site)/account/**',
      'apps/web/src/app/api/accounts/**',
      'apps/web/src/app/api/search-files/**',
      'apps/web/src/features/accounts/**',
      'apps/web/src/features/notifications/**',
      'apps/web/src/features/marks/**',
      'apps/web/src/features/marked-listings/**',
      'apps/web/src/features/search-files/**',
      'apps/web/src/lib/crawl-requests-*.ts',
      'packages/notifications/src/**',
    ],
  },
  D: {
    title: 'The superadmin section',
    task: 'CS-109',
    covers:
      'Every superadmin screen: sources, tracked models and their specs, model photos, crawl requests, search files, accounts, the worker and its queue.',
    include: ['apps/web/src/app/(admin)/**', 'apps/web/src/features/admin/**'],
  },
  E: {
    title: 'Shared definitions and info popovers',
    task: 'CS-110',
    covers:
      'The shared texts that feed many screens: the filter, catalogue, sort and chip definitions in @carshenas/search, the info content builders (mileage reading, deal rating bands, market value, valuation segments, crawl rules), the shared UI primitives and the locale-derived phrases.',
    include: [
      'packages/search/src/{filters,catalogues,sorts,kinds,explain,mileage-reading,document,search}.ts',
      'packages/locale/src/**',
      'apps/web/src/lib/*-info.ts',
      'apps/web/src/components/ui/**',
    ],
  },
};

/** Copy that belongs to a task of its own, not to a rewrite lane. */
export const OWNED_ELSEWHERE = {
  'CS-115': {
    title: 'Check a link',
    task: 'CS-115',
    covers:
      'The paste-a-link feature, copy included (CS-115 rewrites it to the voice guide while it rebuilds the answer states): the box, the four answers, the errors.',
    include: [
      'apps/web/src/features/check-link/**',
      'apps/web/src/app/(site)/check/**',
      'apps/web/src/lib/pasted-link.ts',
    ],
  },
};

/**
 * Files that sit in one area's folder but belong to another, each with the reason. An override beats the globs above.
 */
export const OVERRIDES = [
  {
    file: 'apps/web/src/features/model/model-info.ts',
    area: 'E',
    note: 'Builds the info popovers of the model page (price range, market value, ratings, trend): info content is area E, although the file lives in the model feature. Area A leaves it alone.',
  },
];

/**
 * Notes shown beside a file in the plan. `kind`: `decision` (who owns a shared or straddling file, and why), `hotspot`
 * (another running task also changes it) or `rule` (a constraint for the lane). The first note whose glob matches a file is
 * the one shown beside it.
 */
export const NOTES = [
  {
    glob: 'packages/notifications/src/kinds.ts',
    kind: 'decision',
    note: 'Straddles C and E: 26 of its 36 strings are the titles and details rendered for the inbox (C); the five `setting` blocks (a label and a description each, ten strings) are the settings texts of E, and C rewrites them in the same pass. E does not touch this file. Payloads and keys stay unchanged.',
  },
  {
    glob: 'apps/web/src/lib/crawl-requests-*.ts',
    kind: 'decision',
    note: 'Shared constants: the buyer-side crawl-request card (C) and the superadmin screen (D) both import these words. C owns them; D rewrites its own crawl-requests-admin-copy.ts and does not edit these.',
  },
  {
    glob: 'apps/web/src/features/listing/gauge-view.ts',
    kind: 'decision',
    note: 'The rating names («عالی» to «خیلی گران») and the band texts are imported by the listing page and by the check-a-link answer (CS-115). B owns the constants; CS-115 does not edit them.',
  },
  {
    glob: 'apps/web/src/features/listing/listing-explanation.ts',
    kind: 'rule',
    note: 'The explanation templates: rewrite the templates, keep every number sourced from the database and the faithfulness test passing.',
  },
  {
    glob: 'apps/web/src/lib/mileage-info.ts',
    kind: 'decision',
    note: "The mileage info control's names are used by the listing page and the cards (B) and by the marked list (C); E owns the constants.",
  },
  {
    glob: 'packages/search/src/mileage-reading.ts',
    kind: 'decision',
    note: 'The mileage-reading popover (E). The assumed-mileage notes on cards and the listing page are written in listing-view.ts and the search copy (B).',
  },
  {
    glob: 'packages/search/src/search.ts',
    kind: 'decision',
    note: 'Chip texts built from the filters («مدل …», «کارکرد …»): E owns them with the definitions, B displays them.',
  },
  {
    glob: 'apps/web/src/features/body-types/**',
    kind: 'decision',
    note: 'The body-type tiles of the home page and their photo credits (A). The body-type filter options come from the definitions in packages/search (E).',
  },
  {
    glob: 'apps/web/src/server/observability/route-errors.ts',
    kind: 'decision',
    note: 'The one generic sentence shown when a request to the server fails: assigned with the error pages (A).',
  },
  {
    glob: 'apps/web/src/features/search-understanding/**',
    kind: 'hotspot',
    note: 'Hot spot: CS-111 rebuilds this flow (one step, no confirm panel) and writes the words of the box and chips to the voice guide itself. B changes strings here only after CS-111 has merged, and keeps to strings.',
  },
  {
    glob: 'packages/search/src/understand/{merge,understand,intents}.ts',
    kind: 'hotspot',
    note: 'The understanding messages (B) live in the package that also holds the vocabulary (excluded). CS-111 may change what is said when words are dropped; keep to strings and merge main first.',
  },
  {
    glob: 'apps/web/src/lib/pasted-link.ts',
    kind: 'decision',
    note: 'The names of other sites for the paste box (CS-115). The search field (B) imports it and does not edit it.',
  },
];

/** Other tasks that run in parallel with the rewrite and touch some of the same folders (strings only for the lanes). */
export const PARALLEL_LANES = [
  {
    task: 'CS-111',
    what: 'Smart search in one step',
    touches: 'features/search-understanding, the hero search box, packages/search understand',
  },
  {
    task: 'CS-112',
    what: 'Interface polish (button labels, scrollbars, filters)',
    touches: 'components/ui, catalogue rows and rails, the filter panel',
  },
  {
    task: 'CS-113',
    what: 'Model photos',
    touches: 'features/model, the home popular tiles, body-type credits',
  },
  { task: 'CS-114', what: 'Search UX review', touches: 'features/search' },
  { task: 'CS-115', what: 'Check a link (owns its copy)', touches: 'features/check-link, app/(site)/check' },
];

function* entries() {
  for (const [id, area] of Object.entries(AREAS)) yield [id, area];
  for (const [id, area] of Object.entries(OWNED_ELSEWHERE)) yield [id, area];
}

/** `{ area, via, note }`, or `{ problem: 'unassigned' }`, or `{ problem: 'multiple', areas }`. */
export function assignFile(file) {
  const note = NOTES.find((entry) => matchesGlob(file, entry.glob))?.note;
  const override = OVERRIDES.find((entry) => entry.file === file);
  if (override !== undefined) {
    return { area: override.area, via: 'override', note: [override.note, note].filter(Boolean).join(' ') };
  }
  const matching = [];
  for (const [id, area] of entries()) {
    if (area.include.some((glob) => matchesGlob(file, glob))) matching.push(id);
  }
  if (matching.length === 0) return { problem: 'unassigned' };
  if (matching.length > 1) return { problem: 'multiple', areas: matching };
  return { area: matching[0], via: 'glob', note };
}

export function areaLabelOf(file) {
  const assigned = assignFile(file);
  if (assigned.area === undefined) return undefined;
  const area = AREAS[assigned.area] ?? OWNED_ELSEWHERE[assigned.area];
  return assigned.area === area.task ? assigned.area : `${assigned.area} (${area.task})`;
}

/**
 * The partition of a list of copy files: `{ byArea: Map(area -> [{file, note, via}]), unassigned, multiple }`.
 */
export function partition(files) {
  const byArea = new Map([...entries()].map(([id]) => [id, []]));
  const unassigned = [];
  const multiple = [];
  for (const file of files) {
    const assigned = assignFile(file);
    if (assigned.problem === 'unassigned') unassigned.push(file);
    else if (assigned.problem === 'multiple') multiple.push({ file, areas: assigned.areas });
    else byArea.get(assigned.area).push({ file, note: assigned.note, via: assigned.via });
  }
  return { byArea, unassigned, multiple };
}

/** Globs and overrides that match no source file at all (`files` = every source file): a typo, or a file that moved. */
export function deadEntries(files) {
  const dead = [];
  for (const [id, area] of entries()) {
    for (const glob of area.include) {
      if (!files.some((file) => matchesGlob(file, glob))) dead.push({ area: id, glob });
    }
  }
  for (const override of OVERRIDES) {
    if (!files.includes(override.file)) dead.push({ area: override.area, glob: override.file });
  }
  return dead;
}
