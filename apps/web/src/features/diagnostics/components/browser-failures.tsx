'use client';

import { useState } from 'react';
import { actionClasses } from '@/components/ui/action-link';
import { DIAGNOSTIC_MESSAGE } from '@/features/diagnostics/diagnostics';

// The three ways an error happens in the browser: while rendering (an error boundary catches it and the error
// screen reports it), in an event handler (uncaught, window reports it) and in a promise nobody awaits (an
// unhandled rejection). Each button causes one.
export function BrowserFailures() {
  const [renderFails, setRenderFails] = useState(false);
  if (renderFails) throw new TypeError(DIAGNOSTIC_MESSAGE);
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className={actionClasses('secondary')}
        onClick={() => {
          setRenderFails(true);
        }}
      >
        خطا هنگام نمایش
      </button>
      <button
        type="button"
        className={actionClasses('secondary')}
        onClick={() => {
          throw new RangeError(DIAGNOSTIC_MESSAGE);
        }}
      >
        خطای مهارنشده
      </button>
      <button
        type="button"
        className={actionClasses('secondary')}
        onClick={() => {
          void Promise.reject(new Error(DIAGNOSTIC_MESSAGE));
        }}
      >
        وعده‌ی ردشده
      </button>
    </div>
  );
}
