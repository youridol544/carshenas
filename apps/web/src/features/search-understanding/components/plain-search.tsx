'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Info, Plus, Search as SearchIcon, X } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { searchHref, type Search } from '@carshenas/search/search';
import type {
  Suggestion,
  UnderstoodChip,
  Understanding,
  UnusedWords,
} from '@carshenas/search/understand/types';
import { actionClasses } from '@/components/ui/action-link';
import { FieldHint, FieldLabel, inputClasses } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import type { UnderstandResponse } from '@/features/search-understanding/understanding-types';
import {
  withoutChips,
  withSuggestionTaken,
  withWordsAsText,
} from '@/features/search-understanding/without-chips';

// Plain-Farsi search (CS-62, docs/specs/S03-plain-farsi-search.md): a sentence in, the filters it meant out as chips
// the buyer can remove, the words nobody could read said aloud (never dropped), and one tap to look for them as text.
// Self-contained: it asks POST /api/search/understand itself and hands the search the buyer ends with to `onApply`,
// so the search page and the home page (CS-63) use it the same way. Nothing is applied until the buyer says so.
//
// Integration surface: <PlainSearch onApply={(search) => …} initialQuery? autoFocus? />. `search` is the schema's own
// Search (filters, q, sort, catalogue), checked by the server against @carshenas/search; build the page's address with
// searchHref(search).

type Props = {
  /** The buyer's final search: what the chips left, plus anything they added. */
  /** Where the buyer's final search goes; by default the search page's address, opened with the router. */
  onApply?: (search: Search) => void;
  initialQuery?: string;
  /** The label above the field; the search page and the home page word it their own way. */
  label?: string;
};

type State =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'failed'; message: string }
  | {
      status: 'done';
      answer: UnderstandResponse;
      understanding: Understanding;
      searchOf: Search;
      removed: ReadonlySet<string>;
    };

const NETWORK_FAILED =
  'به سرور نرسیدیم؛ اینترنت را بررسی کنید و دوباره بفرستید. جمله‌ی شما همین‌جا مانده است.';
const SERVER_FAILED = 'مشکلی پیش آمد؛ دوباره امتحان کنید. جمله‌ی شما همین‌جا مانده است.';

export function PlainSearch({
  onApply: onApplyGiven,
  initialQuery = '',
  label = 'چه ماشینی می‌خواهید؟',
}: Props) {
  const router = useRouter();
  const onApply =
    onApplyGiven ??
    ((search: Search) => {
      router.push(searchHref(search) as Route);
    });
  const ids = useId();
  const fieldId = `${ids}-field`;
  const hintId = `${ids}-hint`;
  const [typed, setTyped] = useState(initialQuery);
  const [state, setState] = useState<State>({ status: 'idle' });
  // The newest question wins: an answer to an older one is dropped.
  const latest = useRef<AbortController | null>(null);

  async function ask(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const sentence = typed.trim();
    if (sentence === '') return;
    latest.current?.abort();
    const controller = new AbortController();
    latest.current = controller;
    setState({ status: 'pending' });
    try {
      const response = await fetch('/api/search/understand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: sentence }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
        setState({ status: 'failed', message: body?.message ?? SERVER_FAILED });
        return;
      }
      const answer = (await response.json()) as UnderstandResponse;
      setState({
        status: 'done',
        answer,
        understanding: answer.understanding,
        searchOf: answer.understanding.search,
        removed: new Set(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState({ status: 'failed', message: NETWORK_FAILED });
    }
  }

  return (
    <section aria-labelledby={`${ids}-title`} className="flex flex-col gap-4">
      <form
        role="search"
        onSubmit={(event) => void ask(event)}
        className="group flex flex-col gap-2"
        data-pending={state.status === 'pending' ? '' : undefined}
      >
        <FieldLabel htmlFor={fieldId}>
          <span id={`${ids}-title`}>{label}</span>
        </FieldLabel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={fieldId}
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            aria-describedby={hintId}
            className={`${inputClasses} sm:flex-1`}
          />
          <button
            type="submit"
            aria-disabled={state.status === 'pending'}
            className={`${actionClasses('primary')} group gap-2`}
          >
            <span>بفهم</span>
            <Spinner />
          </button>
        </div>
        <FieldHint id={hintId}>
          مثل «۲۰۶ تیپ ۲ بدون رنگ زیر ۷۰۰ میلیون» یا «یه ماشین تمیز و بی‌دردسر می‌خوام». فیلترهایی که فهمیدیم
          را می‌بینید و می‌توانید برشان دارید.
        </FieldHint>
      </form>

      <div aria-live="polite" className="min-h-lh">
        {state.status === 'pending' ? <p className="text-secondary text-muted">در حال خواندن جمله…</p> : null}
        {state.status === 'failed' ? (
          <p role="alert" className="text-secondary text-danger">
            {state.message}
          </p>
        ) : null}
      </div>

      {state.status === 'done' ? (
        <Result
          state={state}
          onRemove={(key) => {
            setState({ ...state, removed: new Set([...state.removed, key]) });
          }}
          onRestore={() => {
            setState({ ...state, removed: new Set() });
          }}
          onTakeSuggestion={(suggestion) => {
            setState({
              ...state,
              searchOf: suggestion.add,
              understanding: withSuggestionTaken(state.understanding, suggestion),
            });
          }}
          onSearchWords={(group) => {
            if (group.asText === null) return;
            setState({
              ...state,
              searchOf: group.asText,
              understanding: withWordsAsText(state.understanding, group),
            });
          }}
          onApply={onApply}
        />
      ) : null}
    </section>
  );
}

type DoneState = Extract<State, { status: 'done' }>;

function Result({
  state,
  onRemove,
  onRestore,
  onTakeSuggestion,
  onSearchWords,
  onApply,
}: {
  state: DoneState;
  onRemove: (key: string) => void;
  onRestore: () => void;
  onTakeSuggestion: (suggestion: Suggestion) => void;
  onSearchWords: (group: UnusedWords) => void;
  /** Where the buyer's final search goes; by default the search page's address, opened with the router. */
  onApply: (search: Search) => void;
}) {
  const { understanding } = state;
  const { removed } = state;
  // Chips are those of the understanding; a replacement (a suggestion, the words as text) re-reads nothing, so the chips
  // that remain are those still in the search.
  const shown = understanding.chips.filter((chip) => !removed.has(chip.key));
  const search = useMemo(
    () => withoutChips(state.searchOf, understanding.chips, removed),
    [state.searchOf, understanding.chips, removed],
  );
  const stated = shown.filter((chip) => chip.basis === 'stated');
  const inferred = groupByWords(shown.filter((chip) => chip.basis === 'inferred'));
  const nothing = shown.length === 0;
  return (
    <div className="flex flex-col gap-6">
      <p role="status" className="text-body text-pretty text-default">
        {understanding.explanation}
      </p>

      {understanding.degraded ? (
        <p className="flex items-start gap-2 rounded-control bg-surface-muted p-3 text-secondary text-pretty text-muted">
          <span className="mt-1 shrink-0">
            <Icon icon={Info} size={16} />
          </span>
          <span>{understanding.degraded.message}</span>
        </p>
      ) : null}

      {stated.length > 0 ? <ChipGroup title="فهمیدم" chips={stated} onRemove={onRemove} /> : null}
      {inferred.map(([words, chips]) => (
        <ChipGroup
          key={words}
          title={words === '' ? 'این‌ها را هم گذاشتم' : `برای «${words}» این‌ها را هم گذاشتم`}
          chips={chips}
          onRemove={onRemove}
          inferred
        />
      ))}

      {search.q !== undefined ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-label font-medium text-default">در متن آگهی‌ها هم می‌گردم</h3>
          <div>
            <button
              type="button"
              onClick={() => {
                onRemove('q');
              }}
              aria-label={`برداشتن «${search.q}»`}
              className="inline-flex min-h-11 items-center gap-2 rounded-control border border-control bg-surface px-4 text-label font-medium text-default hover:bg-surface-hover"
            >
              <span>{search.q}</span>
              <Icon icon={X} size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {removed.size > 0 ? (
        <button type="button" onClick={onRestore} className={actionClasses('tertiary')}>
          برگرداندن فیلترهای برداشته‌شده
        </button>
      ) : null}

      {understanding.suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-label font-medium text-default">شاید منظورتان این هم بود</h3>
          <ul className="flex flex-wrap gap-2">
            {understanding.suggestions.map((suggestion) => (
              <li key={suggestion.key}>
                <button
                  type="button"
                  onClick={() => {
                    onTakeSuggestion(suggestion);
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-control border border-dashed border-control bg-surface px-4 text-label font-medium text-default hover:bg-surface-hover"
                >
                  <Icon icon={Plus} size={16} />
                  <span>{suggestion.text}</span>
                  <span className="sr-only">{suggestion.why}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {understanding.unused.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-label font-medium text-default">این کلمه‌ها را نتوانستم به فیلتر تبدیل کنم</h3>
          <ul className="flex flex-col gap-2">
            {understanding.unused.map((group) => (
              <li
                key={group.words}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-secondary text-muted"
              >
                <span className="rounded-badge bg-surface-muted px-2 text-label font-medium text-default">
                  {group.words}
                </span>
                <span>{reasonText(group.reason, group.topic)}</span>
                {group.asText && !understanding.textSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchWords(group);
                    }}
                    className={actionClasses('tertiary')}
                  >
                    جست‌وجو در متن آگهی‌ها
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {understanding.notes.length > 0 ? (
        <ul className="flex flex-col gap-1 text-secondary text-pretty text-muted">
          {understanding.notes.map((note) => (
            <li key={note.text}>{note.text}</li>
          ))}
        </ul>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => {
            onApply(search);
          }}
          className={`${actionClasses('primary')} gap-2`}
        >
          <Icon icon={SearchIcon} />
          <span>{nothing && search.q === undefined ? 'نمایش همه‌ی آگهی‌ها' : 'نمایش آگهی‌ها'}</span>
        </button>
      </div>
    </div>
  );
}

function ChipGroup({
  title,
  chips,
  onRemove,
  inferred = false,
}: {
  title: string;
  chips: readonly UnderstoodChip[];
  onRemove: (key: string) => void;
  inferred?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label font-medium text-default">{title}</h3>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              onClick={() => {
                onRemove(chip.key);
              }}
              aria-label={`برداشتن «${chip.text}»`}
              className={`inline-flex min-h-11 items-center gap-2 rounded-control border px-4 text-label font-medium ${
                inferred
                  ? 'border-control bg-surface text-default hover:bg-surface-hover'
                  : 'border-action bg-action-subtle text-on-action-subtle'
              }`}
            >
              <span>{chip.text}</span>
              <Icon icon={X} size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function groupByWords(chips: readonly UnderstoodChip[]): [string, UnderstoodChip[]][] {
  const groups = new Map<string, UnderstoodChip[]>();
  for (const chip of chips) groups.set(chip.words, [...(groups.get(chip.words) ?? []), chip]);
  return [...groups];
}

function reasonText(reason: Understanding['unused'][number]['reason'], topic: string | null): string {
  switch (reason) {
    case 'unsupported':
      return topic === null ? 'کارشناس هنوز این را فیلتر نمی‌کند.' : `«${topic}» هنوز فیلتر نمی‌شود.`;
    case 'outside_market':
      return 'آگهی‌های این شهر در کارشناس نیست.';
    case 'addressed':
      return 'خطاب به سیستم بود و به کار نرفت.';
    case 'implausible':
      return 'عددی که برای این خودرو ممکن نیست.';
    default:
      return 'معنایش را پیدا نکردم.';
  }
}
