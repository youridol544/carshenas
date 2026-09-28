// path: src/app/lint-selftest-route-const/route.ts
// expect: no-restricted-syntax
// expect-message: Export a Route Handler's method through withErrorReference
export const POST = async () => Response.json({ ok: true });
