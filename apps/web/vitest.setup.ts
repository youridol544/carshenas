import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without globals here, so Testing Library cannot register its automatic cleanup:
// without this, a second render in the same file finds the first one still in the document.
afterEach(() => {
  cleanup();
});
