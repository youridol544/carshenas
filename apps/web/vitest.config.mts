import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The production server runs in UTC. Workers inherit this, so a formatter that forgets the Tehran time zone fails
// here instead of passing on a machine that is set to Tehran (packages/locale runs its own tests in UTC too).
process.env.TZ = 'UTC';

// Unit and component tests sit next to the file they test (ADR-0004). Async Server Components and whole
// flows are covered by the Playwright suite in e2e/, as the Next.js testing guide recommends.

// Tests that keep a CPU busy for seconds: PGlite starts PostgreSQL in WebAssembly and replays every migration before
// the schema tests, and the build step's test (scripts/, plain JavaScript that next.config.ts loads) runs Next.js's
// own React Compiler step. Beside twenty other files their setup passed its 10-second limit (2026-09-28), so they run
// as a second group, once the rest is done.
const HEAVY = ['src/server/db/schema-*.test.ts', 'scripts/**/*.test.mjs'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The `@/…` imports from tsconfig.json; Vite 8 resolves them itself.
    tsconfigPaths: true,
    // What Next.js itself does for server code: `import 'server-only'` resolves to its bundled empty module, so a
    // test can import anything under server/ without installing the package or mocking it.
    alias: { 'server-only': 'next/dist/compiled/server-only/empty.js' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          // Integration tests need the Docker database; `pnpm db:check` runs them (vitest.db.config.mts).
          exclude: ['src/**/*.db.test.ts', ...HEAVY],
        },
      },
      // After the rest, never beside it.
      { extends: true, test: { name: 'heavy', include: HEAVY, sequence: { groupOrder: 1 } } },
    ],
  },
});
