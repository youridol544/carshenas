// WCAG 2 contrast for the OKLCH colours the design language is written in. OKLCH to sRGB follows Björn Ottosson's
// Oklab (2020) as CSS Color 4 does, with chroma reduced until the colour fits sRGB, as browsers map out-of-gamut
// colours. color-contrast.test.ts holds every pair docs/design/design-language.md records to its threshold.

export type Oklch = { lightness: number; chroma: number; hue: number };

/** Reads `oklch(0.53 0.2 262)`; alpha is not supported, because text and fills are solid. */
export function parseOklch(value: string): Oklch {
  const match = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim());
  if (!match) throw new SyntaxError(`Not an opaque oklch() colour: ${value}`);
  return { lightness: Number(match[1]), chroma: Number(match[2]), hue: Number(match[3]) };
}

function linearSrgb({ lightness, chroma, hue }: Oklch): [number, number, number] {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: readonly number[]) => rgb.every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4);

/** Relative luminance (WCAG 2), after reducing chroma into sRGB. */
export function relativeLuminance(colour: Oklch): number {
  let [low, high] = [0, colour.chroma];
  let rgb = linearSrgb(colour);
  if (!inGamut(rgb)) {
    for (let step = 0; step < 40; step++) {
      const chroma = (low + high) / 2;
      if (inGamut(linearSrgb({ ...colour, chroma }))) low = chroma;
      else high = chroma;
    }
    rgb = linearSrgb({ ...colour, chroma: low });
  }
  const [red, green, blue] = rgb;
  return 0.2126 * displayed(red) + 0.7152 * displayed(green) + 0.0722 * displayed(blue);
}

// A channel as a screen shows it: encoded to 8-bit sRGB, then back to linear light for WCAG's luminance.
function displayed(channel: number): number {
  const clamped = Math.min(1, Math.max(0, channel));
  const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  const byte = Math.round(encoded * 255) / 255;
  return byte <= 0.04045 ? byte / 12.92 : ((byte + 0.055) / 1.055) ** 2.4;
}

/** The WCAG 2 contrast ratio of two colours, from 1 to 21. */
export function contrastRatio(first: Oklch, second: Oklch): number {
  const [one, other] = [relativeLuminance(first), relativeLuminance(second)];
  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
}
