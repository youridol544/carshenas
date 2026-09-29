import type { LucideIcon } from 'lucide-react';

// One icon family, Lucide (shadcn's default, ADR-0005), drawn one way everywhere (ui-design craft.md, section 6): a
// 1.5 px stroke that stays 1.5 px at every size, beside 16 px regular Persian text whose stem is 1.32 px, in the
// colour of the text beside it. An icon is decoration: the control around it carries the name.

type IconProps = {
  icon: LucideIcon;
  /** 20 by default, beside 16 px text; 16 inside a 14 px line. */
  size?: 16 | 20 | 24;
  className?: string;
};

export function Icon({ icon: Glyph, size = 20, className }: IconProps) {
  return <Glyph aria-hidden size={size} strokeWidth={1.5} nonScalingStroke className={className} />;
}
