// path: src/features/lint-selftest/components/clean-percent-style.tsx
// expect: (none)
// A CSS percentage built inside a style attribute is layout, not text: a marker placed along a gauge's bar, by a
// template or by concatenation. Only a percentage a person reads needs formatPercent.
export function GaugeMarker({ share }: { share: number }) {
  return (
    <div className="relative h-2 rounded-full bg-surface-muted">
      <span
        className="absolute size-3 rounded-full bg-action"
        style={{ insetInlineStart: `${share * 100}%`, inlineSize: String(share * 100) + '%' }}
      />
    </div>
  );
}
