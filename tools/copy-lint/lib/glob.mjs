// A small glob: `*` is anything but «/», `**` anything including «/», `?` one character but «/», `{a,b}` alternatives.
// Everything else is literal, so the «(site)» and «[id]» folders of the Next.js app match themselves.

const cache = new Map();

export function globToRegExp(glob) {
  const cached = cache.get(glob);
  if (cached !== undefined) return cached;
  let source = '';
  let braces = 0;
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        i += 1;
        if (glob[i + 1] === '/') {
          i += 1;
          source += '(?:.*/)?';
        } else source += '.*';
      } else source += '[^/]*';
    } else if (char === '?') source += '[^/]';
    else if (char === '{') {
      braces += 1;
      source += '(?:';
    } else if (char === '}' && braces > 0) {
      braces -= 1;
      source += ')';
    } else if (char === ',' && braces > 0) source += '|';
    else source += char.replace(/[.+^$()|[\]\\{}]/g, '\\$&');
  }
  const regExp = new RegExp(`^${source}$`);
  cache.set(glob, regExp);
  return regExp;
}

export function matchesGlob(file, glob) {
  return globToRegExp(glob).test(file);
}
