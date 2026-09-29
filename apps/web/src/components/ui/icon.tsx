import type { LucideIcon } from 'lucide-react';

// One icon family, Lucide (shadcn's default, ADR-0005), drawn one way everywhere (ui-design craft.md, section 6): a
// stroke that keeps its width at every size and matches the stem of the regular text beside it within 0.25 px
// (design-language.md, section 1): 1.5 px beside 16 px text (stem 1.32 px), 1.25 px for the 16 px icon of a 14 px
// line (stem 1.15 px); in the colour of that text. An icon is decoration: the control around it carries the name.

type IconProps = {
  icon: LucideIcon;
  /** 20 by default, beside 16 px text; 16 inside a 14 px line. */
  size?: 16 | 20 | 24;
  className?: string;
};

export function Icon({ icon: Glyph, size = 20, className }: IconProps) {
  return (
    <Glyph
      aria-hidden
      size={size}
      strokeWidth={size === 16 ? 1.25 : 1.5}
      nonScalingStroke
      className={className}
    />
  );
}
