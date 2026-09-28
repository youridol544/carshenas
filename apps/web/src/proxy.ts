import { NextResponse, type NextRequest } from 'next/server';

// The build writes browser source maps (next.config.ts) so the server can log a browser error's stack with its
// original file and line (ADR-0016). They would give anyone the readable source, so they are not served: this
// proxy runs only for map files under /_next/static and answers 404 before Next.js would serve them.

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith('.map')) return new NextResponse(null, { status: 404 });
  return NextResponse.next();
}

export const config = {
  matcher: '/_next/static/(.*\\.map)',
};
