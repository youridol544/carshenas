# Palette lab (CS-3)

`palette.py` computes what `docs/design/design-language.md` records about the palette in `palette.json`:

- the sRGB value of each OKLCH primitive, which must lie inside sRGB, because browsers clip an out-of-gamut colour per channel (Chromium paints `oklch(0.9 0.065 25)` as `#ffcec8`, not the chroma-reduced `#ffd1cd`);
- the WCAG 2 contrast of every colour pair;
- the greyscale lightness (CIE L*) of the five deal-rating fills, and each fill under a deuteranopia simulation (Machado, Oliveira and Fernandes 2009, severity 1).

```bash
python3 docs/design/palette-lab/palette.py docs/design/palette-lab/palette.json
```

It is the design-time tool; the guard is `apps/web/src/lib/color-contrast.test.ts`, which reads the real `globals.css` in `pnpm check`. Keep the values in `palette.json` equal to `globals.css` when either changes.
