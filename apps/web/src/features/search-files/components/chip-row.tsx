import { formatCount } from '@carshenas/locale/format-number';

// The search of a file as chips (the words and filters the search page shows, in the same order), read-only. A card
// shows the first few and says how many more there are; the file's own page shows all of them.

type ChipRowProps = {
  chips: readonly string[];
  /** Show at most this many, then «+۳»; all when omitted. */
  limit?: number;
  label: string;
  /** Below 1024 px keep the chips on one line that scrolls sideways, so a long search takes one line of a phone's page. */
  scrollOnPhone?: boolean;
};

export function ChipRow({ chips, limit, label, scrollOnPhone = false }: ChipRowProps) {
  const shown = limit === undefined ? chips : chips.slice(0, limit);
  const hidden = chips.length - shown.length;
  return (
    <ul
      aria-label={label}
      className={`flex gap-2 ${scrollOnPhone ? '-mx-4 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0' : 'flex-wrap'}`}
    >
      {shown.map((chip) => (
        <li
          key={chip}
          className="inline-flex max-w-full shrink-0 items-center rounded-full border border-divider bg-surface-muted px-3 py-0.5 text-label"
        >
          <bdi className="min-w-0 text-pretty">{chip}</bdi>
        </li>
      ))}
      {hidden > 0 ? (
        <li className="inline-flex items-center px-1 text-label text-muted">{`+${formatCount(hidden)}`}</li>
      ) : null}
    </ul>
  );
}
