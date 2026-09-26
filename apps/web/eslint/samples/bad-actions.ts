// path: src/features/lint-selftest/lint-selftest-actions.ts
// expect: local/server-action-conventions, no-restricted-syntax
// expect-message: Intl currency style
// expect-message: dateStyle 'full'
'use server';

export function saveThing(formData: FormData) {
  const price = new Intl.NumberFormat('fa-IR', { style: 'currency', currency: 'IRR' }).format(1);
  const day = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full' }).format(new Date());
  return { price, day, name: formData.get('name') };
}
