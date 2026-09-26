// path: src/features/lint-selftest/components/bad-inline-disable.tsx
// expect: no-inline-config, @eslint-react/no-array-index-key
export function InlineDisable({ items }: { items: readonly string[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
