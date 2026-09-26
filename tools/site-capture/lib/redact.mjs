// Everything that reaches a distilled report passes through here: no header values, no cookie values,
// no query values, no body values. Shapes and names only.

const SENSITIVE_NAME =
  /(authorization|cookie|token|secret|session|csrf|xsrf|api-?key|password|passwd|signature|credential|auth)/i;

export function isSensitiveName(name) {
  return SENSITIVE_NAME.test(name);
}

/** A value worth scrubbing: long, opaque, and not simply a URL, a hostname or a word. */
export function looksLikeCredential(value, pageHost = '') {
  if (typeof value !== 'string' || value.length < 12 || /\s/.test(value)) return false;
  if (/^https?:/i.test(value) || /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(value)) return false; // URL or hostname
  if (pageHost && value.includes(pageHost.replace(/^www\./, ''))) return false;
  return /\d/.test(value) && /[a-z]/i.test(value);
}

/** URL without query values or fragments. */
export function describeUrl(raw) {
  try {
    const url = new URL(raw);
    const query = [...new Set(url.searchParams.keys())].sort();
    return {
      origin: url.origin,
      host: url.host,
      path: url.pathname,
      query,
      display:
        url.origin + url.pathname + (query.length ? `?${query.map((name) => `${name}=…`).join('&')}` : ''),
    };
  } catch {
    return {
      origin: '',
      host: '',
      path: String(raw).slice(0, 80),
      query: [],
      display: String(raw).slice(0, 80),
    };
  }
}

/** /dealer/d_abc123def/listings/991 -> /dealer/:d_id/listings/:id */
export function pathPattern(pathname) {
  return pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return ':uuid';
      const prefixed = segment.match(/^([a-z]{1,4})_[a-z0-9]{6,}$/i);
      if (prefixed) return `:${prefixed[1].toLowerCase()}_id`;
      if (/^[0-9a-f]{8,}$/i.test(segment) && /\d/.test(segment)) return ':hex';
      if (
        segment.length >= 16 &&
        /^[\w.:~%-]+$/.test(segment) &&
        /\d/.test(segment) &&
        /[a-z]/i.test(segment)
      )
        return ':token';
      return segment;
    })
    .join('/');
}

function stringHint(value) {
  if (value === '') return 'string(empty)';
  if (/^https?:\/\//.test(value)) return 'string(url)';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'string(datetime)';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'string(date)';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value)) return 'string(uuid)';
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'string(email)';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'string(numeric)';
  if (/^[a-z]{1,4}_[a-z0-9]{6,}$/i.test(value)) return 'string(prefixed-id)';
  // Constants such as SOLD, IN_PROGRESS or DUAL_FUEL describe the API. Codes such as A1 or VIN12345 are catalogue data and stay hidden.
  if (/^[A-Z]{3,}(_[A-Z0-9]+)*$/.test(value) && value.length <= 32) return `enum(${value})`;
  return 'string';
}

/** Structural shape of a JSON value: types, key names and enum constants. Never free-text values. */
export function shapeOf(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (!value.length) return [];
    const merged = mergeShapes(value.slice(0, 12).map((item) => shapeOf(item, depth + 1)));
    return [merged, `×${value.length}`];
  }
  switch (typeof value) {
    case 'string':
      return stringHint(value);
    case 'number':
      return Number.isInteger(value) ? 'integer' : 'number';
    case 'boolean':
      return 'boolean';
    case 'object': {
      if (depth >= 7) return 'object(…)';
      const out = {};
      const keys = Object.keys(value);
      const looksLikeMap = keys.length > 12 && keys.every((key) => /^[\w-]{8,}$/.test(key) && /\d/.test(key));
      if (looksLikeMap) return { ':key': shapeOf(value[keys[0]], depth + 1), '…': `${keys.length} entries` };
      for (const key of keys.slice(0, 60))
        out[key] = isSensitiveName(key) ? 'redacted' : shapeOf(value[key], depth + 1);
      if (keys.length > 60) out['…'] = `${keys.length - 60} more keys`;
      return out;
    }
    default:
      return typeof value;
  }
}

function mergeShapes(shapes) {
  const objects = shapes.filter((shape) => shape && typeof shape === 'object' && !Array.isArray(shape));
  if (objects.length !== shapes.length) {
    const distinct = [...new Set(shapes.map((shape) => JSON.stringify(shape)))].map((text) =>
      JSON.parse(text),
    );
    return distinct.length === 1 ? distinct[0] : collapseEnums(distinct);
  }
  const out = {};
  for (const shape of objects) {
    for (const [key, child] of Object.entries(shape)) {
      if (!(key in out)) {
        out[key] = child;
        continue;
      }
      if (JSON.stringify(out[key]) === JSON.stringify(child)) continue;
      const pair = [out[key], child];
      out[key] = pair.every((p) => p && typeof p === 'object' && !Array.isArray(p))
        ? mergeShapes(pair)
        : collapseEnums([...(out[key]?.anyOf ?? [out[key]]), child]);
    }
  }
  const optional = Object.keys(out).filter((key) => objects.some((shape) => !(key in shape)));
  for (const key of optional) {
    out[`${key}?`] = out[key];
    delete out[key];
  }
  return out;
}

function collapseEnums(variants) {
  const flat = [...new Set(variants.map((v) => JSON.stringify(v)))].map((text) => JSON.parse(text));
  const enums = flat.filter((v) => typeof v === 'string' && v.startsWith('enum('));
  if (enums.length > 1) {
    const values = enums.map((v) => v.slice(5, -1)).slice(0, 12);
    const rest = flat.filter((v) => !(typeof v === 'string' && v.startsWith('enum(')));
    const merged = `enum(${values.join(' | ')})`;
    return rest.length ? { anyOf: [merged, ...rest] } : merged;
  }
  return flat.length === 1 ? flat[0] : { anyOf: flat.slice(0, 6) };
}

export function headerNames(headers) {
  return Object.keys(headers ?? {})
    .map((name) => name.toLowerCase())
    .filter((name) => !name.startsWith(':'))
    .sort();
}
