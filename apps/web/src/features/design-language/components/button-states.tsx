import { Search } from 'lucide-react';
import { actionClasses, type ActionLevel } from '@/components/ui/action-link';
import { Icon } from '@/components/ui/icon';
import { SampleSection } from '@/features/design-language/components/sample-section';
import { Spinner } from '@/components/ui/spinner';

// The shared button in every state, from fixed data (/design/buttons; e2e/tests/app/button-labels.spec.ts measures it):
// each level, idle, pending and disabled, at its own width and across the whole row. The label sits where it sits when
// the button is idle in all three, because the pending indicator overlays the button's padding instead of taking room
// in the row (Spinner). The pending samples are marked as the real ones are: `data-pending` and `aria-disabled`.

type SampleState = 'idle' | 'pending' | 'disabled';

const LEVELS: readonly { level: ActionLevel; title: string }[] = [
  { level: 'primary', title: 'کنش اصلی' },
  { level: 'secondary', title: 'کنش دوم' },
  { level: 'tertiary', title: 'کنش سوم' },
];

const STATES: readonly { state: SampleState; title: string }[] = [
  { state: 'idle', title: 'آماده' },
  { state: 'pending', title: 'در حال انجام' },
  { state: 'disabled', title: 'غیرفعال' },
];

// Short, medium and long labels: the first two are the owner's examples, the long one wraps nothing at 412 px.
const LABELS = ['بفهم', 'ارزیابی قیمت', 'تأیید آگهی؛ پراید غ'] as const;

function Sample({
  level,
  state,
  label,
  wide = false,
  withIcon = false,
}: {
  level: ActionLevel;
  state: SampleState;
  label: string;
  wide?: boolean;
  withIcon?: boolean;
}) {
  return (
    <button
      type="button"
      data-pending={state === 'pending' ? '' : undefined}
      aria-disabled={state === 'pending' ? true : undefined}
      disabled={state === 'disabled'}
      className={`${actionClasses(level)} ${wide ? 'w-full' : ''} ${withIcon ? 'gap-2' : ''}`}
    >
      {withIcon ? <Icon icon={Search} /> : null}
      <span>{label}</span>
      <Spinner />
    </button>
  );
}

export function ButtonStates() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-12 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title font-bold">حالت‌های دکمه</h1>
        <p className="max-w-reading text-body text-pretty text-muted">
          دکمه‌ی کارشناس در هر سه سطح و هر سه حالت. نوشته‌ی دکمه در هر حالت سر جای خودش می‌ماند؛ نشانه‌ی
          انتظار روی لبه‌ی دکمه می‌نشیند.
        </p>
      </header>
      {LEVELS.map(({ level, title }) => (
        <SampleSection key={level} id={`buttons-${level}`} title={title}>
          <div className="flex flex-col gap-6">
            {STATES.map(({ state, title: stateTitle }) => (
              <div
                key={state}
                role="group"
                aria-label={`${title}، ${stateTitle}`}
                className="flex flex-col gap-3"
              >
                <p className="text-label font-medium text-muted">{stateTitle}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {LABELS.map((label) => (
                    <Sample key={label} level={level} state={state} label={label} />
                  ))}
                  <Sample level={level} state={state} label="نمایش آگهی‌ها" withIcon />
                </div>
                {/* a link-like action never stretches across a row */}
                {level === 'tertiary' ? null : (
                  <Sample level={level} state={state} label="ارزیابی قیمت" wide />
                )}
              </div>
            ))}
          </div>
        </SampleSection>
      ))}
    </main>
  );
}
