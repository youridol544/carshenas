import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Unit and component tests sit next to the file they test (ADR-0004). Async Server Components and whole
// flows are covered by the Playwright suite in e2e/, as the Next.js testing guide recommends.
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
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
