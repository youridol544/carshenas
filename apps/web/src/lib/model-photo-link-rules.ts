// The rules of a model's photo link (CS-97, ADR-0038), stated once for the form that shows a problem in Farsi early and
// the action that checks again. The database enforces the same rules (model_photo_link_host, _length, _plain) and a test
// feeds both the same addresses. Whether the address is an image is the superadmin's to confirm in the preview.

export const MAX_PHOTO_LINK_LENGTH = 500;
const MIN_PHOTO_LINK_LENGTH = 12;

export type PhotoLinkProblem = 'scheme' | 'host' | 'plain' | 'length';

const HOST =
  /^https:\/\/([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?(:([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?([/?#]|$)/i;
const IP_ADDRESS = /^https:\/\/[0-9.]+(:[0-9]+)?([/?#]|$)/i;
const NUMBER_LABEL = /^https:\/\/([^/?#:]*\.)?([0-9]+|0x[0-9a-f]*)(\.|[:/?#]|$)/i;
const INTERNAL =
  /^https:\/\/[^/?#:]*\.(local|localhost|internal|lan|home|corp|test|invalid|example)(:[0-9]+)?([/?#]|$)/i;

// Whitespace, controls, bidi marks and zero-width characters, quotes, angle brackets, backslash and backtick.
const UNWANTED = new RegExp(
  `[\\s${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}${String.fromCharCode(0x7f)}-${String.fromCharCode(0x9f)}${String.fromCharCode(0xad, 0x61c, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x2060, 0xfeff)}${String.fromCharCode(0x202a)}-${String.fromCharCode(0x202e)}${String.fromCharCode(0x2066)}-${String.fromCharCode(0x2069)}"<>'\\\\\`]`,
  'u',
);

/** What is wrong with an address, or null when it may be saved. Checks in the order a person would fix them. */
export function photoLinkProblem(url: string): PhotoLinkProblem | null {
  if (!/^https:\/\//i.test(url)) return 'scheme';
  if (UNWANTED.test(url)) return 'plain';
  if (url.length < MIN_PHOTO_LINK_LENGTH || url.length > MAX_PHOTO_LINK_LENGTH) return 'length';
  if (!HOST.test(url) || IP_ADDRESS.test(url) || NUMBER_LABEL.test(url) || INTERNAL.test(url)) return 'host';
  return null;
}
