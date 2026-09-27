// path: src/features/lint-selftest/components/bad-invisible.tsx
// expect: no-restricted-syntax
// expect-message: An invisible character
// A no-break space and a zero-width space typed straight into a string and into JSX text: both render, and neither
// can be seen in review. Escapes (\u00A0) and the zero-width non-joiner of Persian spelling lint clean.
export function BadInvisible() {
  const unit = '۱۲ تومان';
  const fine = '۱۲\u00A0تومان آگهی‌ها';
  return (
    <p>
      {unit} {fine} قیمت​ها
    </p>
  );
}
