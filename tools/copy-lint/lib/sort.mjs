// A sort order that is the same on every machine: by UTF-16 code unit, never by the locale's collation (which changes
// where «_», «-» and capitals sort, and would reorder the baseline files and the reports from one machine to the next).
export const compareText = (a, b) => {
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  return left > right ? 1 : 0;
};
