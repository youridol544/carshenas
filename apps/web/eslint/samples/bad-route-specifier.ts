// path: src/app/lint-selftest-route-specifier/route.ts
// expect: no-restricted-syntax
// expect-message: Export a Route Handler's method through withErrorReference
function handler() {
  return Response.json({ ok: true });
}

export { handler as GET };
