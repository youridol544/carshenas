import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without globals here, so Testing Library cannot register its automatic cleanup:
// without this, a second render in the same file finds the first one still in the document.
afterEach(() => {
  cleanup();
});

// jsdom has no ResizeObserver, and ScrollRail and the filter rail measure with one (CS-112): a stub that never fires.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      /* a stub: nothing is ever measured */
    }
    unobserve(): void {
      /* a stub */
    }
    disconnect(): void {
      /* a stub */
    }
  };
}
