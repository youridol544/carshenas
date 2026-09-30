import { Check } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { BODY_TYPES, type BodyTypeCode } from '@/features/body-types/body-types';
import { BodyTypePhoto } from '@/features/body-types/components/body-type-photo';

type BodyTypeSelectorProps = {
  /**
   * The body types to offer: only those with listings behind them (owner, 2026-09-30), so a tap never leads to an
   * empty search. Shown in the catalogue's order whatever order they come in; with none, the selector is not shown.
   */
  available: readonly BodyTypeCode[];
  /** The form field's name; the chosen value is the body type's code, in Latin letters, as the catalogue stores it. */
  name: string;
  legend: string;
  defaultValue?: BodyTypeCode;
  /**
   * The photo's rendered width, for the browser's choice of file. The default fits a column of at most 40rem: two
   * tiles a row on a phone, five from a 32rem container.
   */
  photoSizes?: string;
};

// The body-type selector (CS-57, used by the home page in CS-63): one photo tile per body type, as a native radio
// group, so it works before any script loads, arrows move between tiles, and a form sends the code. Each tile is one
// target far above 44 px: the radio itself, transparent, covers the whole tile, named by its Farsi label; its photo is
// decorative inside it. The chosen tile takes the action-blue edge (colour only: the 1 px border is always there),
// the action-subtle fill and a check mark over the photo's start corner, ringed in the page colour so it holds on
// any photo; nothing changes weight or size.
export function BodyTypeSelector({
  available,
  name,
  legend,
  defaultValue,
  photoSizes = '(min-width: 34rem) 7rem, calc(50vw - 2.5rem)',
}: BodyTypeSelectorProps) {
  const offered = BODY_TYPES.filter((bodyType) => available.includes(bodyType.code));
  if (offered.length === 0) return null;
  return (
    <fieldset className="@container flex min-w-0 flex-col gap-3">
      <legend className="mb-3 text-label font-medium text-muted">{legend}</legend>
      <ul className="grid grid-cols-2 gap-3 @lg:grid-cols-5">
        {offered.map((bodyType) => (
          <li key={bodyType.code} className="flex">
            <label className="group relative flex w-full touch-manipulation flex-col gap-2 rounded-card border border-divider bg-surface p-2 text-default transition select-none hover:bg-surface-hover has-checked:border-action has-checked:bg-action-subtle has-checked:text-on-action-subtle has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus motion-safe:active:scale-97">
              <span className="relative">
                <BodyTypePhoto bodyType={bodyType} sizes={photoSizes} decorative />
                <span className="absolute inset-s-2 top-2 flex size-7 items-center justify-center rounded-full border-2 border-canvas bg-action text-on-action opacity-0 group-has-checked:opacity-100">
                  <Icon icon={Check} size={16} />
                </span>
              </span>
              <span className="text-center text-label font-medium">{bodyType.labelFa}</span>
              {/* Last, so it paints over the photo and the whole tile is the radio's own hit area. */}
              <input
                type="radio"
                name={name}
                value={bodyType.code}
                defaultChecked={bodyType.code === defaultValue}
                className="absolute inset-0 m-0 appearance-none opacity-0"
              />
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
