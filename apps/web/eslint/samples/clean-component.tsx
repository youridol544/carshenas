// path: src/features/lint-selftest/components/clean-component.tsx
// expect: (none)
'use client';
import { useActionState, type ComponentProps } from 'react';

type MileageLimitFieldProps = ComponentProps<'input'> & {
  label: string;
  action: (previous: string | null, formData: FormData) => Promise<string | null>;
};

export function MileageLimitField({ label, action, ref, ...rest }: MileageLimitFieldProps) {
  const [message, submit, isPending] = useActionState(action, null);
  return (
    <form action={submit} className="flex flex-col gap-2">
      <label className="text-start">
        {label}
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          name="maxMileageKm"
          className="ms-2 ps-3"
          {...rest}
        />
      </label>
      <button type="submit" aria-disabled={isPending} className="rounded-s-md">
        {isPending ? 'در حال ثبت…' : 'ثبت'}
      </button>
      {message === null ? null : <p role="status">{message}</p>}
    </form>
  );
}
