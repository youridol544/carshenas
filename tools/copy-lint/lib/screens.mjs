// What counts as "one screen's files" for the repeated-sentence rule: the strings of one feature folder
// (apps/web/src/features/<feature>/, copy file and components together). The superadmin feature holds a dozen screens
// in one folder, so each of its files stands alone; every other file stands alone too (a page, a component in
// components/ or lib/, a package module). To make two files one screen, give them the same key here.

export function screenOf(file) {
  const feature = /^apps\/web\/src\/features\/([^/]+)\//.exec(file);
  if (feature !== null && feature[1] !== 'admin') return `feature:${feature[1]}`;
  return `file:${file}`;
}
