import { nameOnScreen } from '@carshenas/locale/names';

// A car's name for a request, from the catalogue's rows: a trim's own Persian name, which already names the model
// («پژو 206 تیپ ۵»), else the model's, else the model's English name with its make's Persian name where the English one
// starts with it. Digits on screen are Persian (nameOnScreen). Shared by the buyer's page and the superadmin's screen.

export type CarNameParts = {
  readonly makeFa: string | null;
  readonly makeEn: string;
  readonly modelFa: string | null;
  readonly modelEn: string;
  readonly trimFa?: string | null;
  readonly trimEn?: string | null;
};

export function carNameOf(parts: CarNameParts): string {
  if (parts.trimFa != null) return nameOnScreen(parts.trimFa);
  if (parts.modelFa !== null) return nameOnScreen(parts.modelFa);
  const prefix = parts.makeEn;
  const modelName =
    parts.makeFa !== null && parts.modelEn.startsWith(`${prefix} `)
      ? `${parts.makeFa} ${parts.modelEn.slice(prefix.length + 1)}`
      : parts.modelEn;
  return nameOnScreen(parts.trimEn != null ? `${modelName} ${parts.trimEn}` : modelName);
}
