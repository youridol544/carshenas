// The colour roles a component may use; the primitives behind them have no utilities (design-language.md). The
// class lists sit in `classes`, one of the variable names the token lint reads.
const SURFACES = [
  { key: 'action', name: 'کنش اصلی', token: 'bg-action · text-on-action' },
  { key: 'actionSubtle', name: 'کنش ملایم', token: 'bg-action-subtle · text-on-action-subtle' },
  { key: 'danger', name: 'خطا', token: 'bg-danger · text-on-danger' },
  { key: 'muted', name: 'سطح آرام', token: 'bg-surface-muted · text-default' },
] as const;

const TEXTS = [
  { key: 'default', name: 'متن اصلی' },
  { key: 'muted', name: 'متن فرعی' },
  { key: 'subtle', name: 'متن کم‌رنگ' },
  { key: 'link', name: 'پیوند' },
  { key: 'success', name: 'انجام شد' },
  { key: 'warning', name: 'هشدار' },
  { key: 'danger', name: 'پیام خطا' },
] as const;

const classes = {
  surface: {
    action: 'bg-action text-on-action',
    actionSubtle: 'bg-action-subtle text-on-action-subtle',
    danger: 'bg-danger text-on-danger',
    muted: 'bg-surface-muted text-default',
  },
  text: {
    default: 'text-default',
    muted: 'text-muted',
    subtle: 'text-subtle',
    link: 'text-link underline',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  },
} as const;

export function ColourRoles() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SURFACES.map(({ key, name, token }) => (
          <li key={key} className={`flex flex-col gap-1 rounded-control p-4 ${classes.surface[key]}`}>
            <span className="text-control font-semibold">{name}</span>
            <code dir="ltr" lang="en" className="self-start text-meta">
              {token}
            </code>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-2 rounded-control border border-divider p-4">
        {TEXTS.map(({ key, name }) => (
          <li key={key} className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={`text-control ${classes.text[key]}`}>{name}</span>
            <code dir="ltr" lang="en" className="text-meta text-subtle">
              text-{key}
            </code>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap gap-3">
        <span className="inline-flex min-h-11 items-center rounded-control border border-control px-4 text-control">
          لبه‌ی فیلد
        </span>
        <span className="inline-flex min-h-11 items-center rounded-control border border-control px-4 text-control outline-2 outline-offset-2 outline-focus">
          حلقه‌ی تمرکز
        </span>
      </p>
    </div>
  );
}
