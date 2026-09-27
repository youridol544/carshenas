// path: src/features/lint-selftest/components/bad-tokens.tsx
// expect: better-tailwindcss/no-unknown-classes, better-tailwindcss/no-restricted-classes
// expect-message: Unknown class detected: bg-red-500
// expect-message: Unknown class detected: text-sm
// expect-message: Unknown class detected: rounded-md
// expect-message: Unknown class detected: shadow-lg
// expect-message: Unknown class detected: bg-gray-7
// expect-message: Spacing off the rhythm
// The token lint (CS-3): Tailwind's own palette, sizes, radii and shadows are gone, the primitives behind the
// roles have no utilities, and spacing keeps to the rhythm steps. The roles themselves lint clean.
export function BadTokens() {
  return (
    <div className="rounded-md bg-red-500 text-sm shadow-lg p-5">
      <p className="bg-gray-7 gap-7">قیمت</p>
      <p className="rounded-control bg-surface p-4 text-body text-muted shadow-raised">قیمت</p>
    </div>
  );
}
