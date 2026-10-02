// The id in a listing page's address segment (CS-64): plain Latin digits, no leading zero, within the range of a bigint the
// driver reads as a JavaScript number. «۱۲», «1e3», «+5» and «012» are not listings. Shared by the page and the proxy,
// which answers a real 404 for an address that holds none.

/** The listing id an address segment names, or undefined. */
export function readListingId(segment: string): number | undefined {
  if (!/^[1-9]\d{0,15}$/.test(segment)) return undefined;
  const id = Number(segment);
  return Number.isSafeInteger(id) ? id : undefined;
}
