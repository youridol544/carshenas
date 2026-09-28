// path: src/app/lint-selftest-route/route.ts
// expect: no-restricted-syntax
// expect-message: Export a Route Handler's method through withErrorReference
export async function GET() {
  return Response.json({ ok: true });
}

export const POST = async () => Response.json({ ok: true });
