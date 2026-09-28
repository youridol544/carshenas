// path: src/app/lint-selftest-route-destructured/route.ts
// expect: no-restricted-syntax
// expect-message: Export a Route Handler's method through withErrorReference
const handlers = { POST: () => Response.json({ ok: true }) };

export const { POST } = handlers;
