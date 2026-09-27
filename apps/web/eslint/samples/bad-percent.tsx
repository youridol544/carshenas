// path: src/features/lint-selftest/components/bad-percent.tsx
// expect: no-restricted-syntax
// expect-message: A percent sign written by hand
// Every way of typing a percentage by hand: JSX text, a string, a template after a value, and concatenation.
// formatPercent is the only way in; a Tailwind percentage such as w-[50%] is not a percentage of anything.
export function BadPercent({ gap }: { gap: number }) {
  const share = '۱۲٪';
  const typed = `${String(gap)}%`;
  const glued = String(gap) + '%';
  return (
    <p className="w-[50%]">
      ۸٪ زیر ارزش بازار {share} {typed} {glued}
    </p>
  );
}
