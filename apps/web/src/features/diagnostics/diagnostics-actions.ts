'use server';

import { DIAGNOSTIC_MESSAGE } from '@/features/diagnostics/diagnostics';
import { env } from '@/server/env';

// A Server Action that throws, for the diagnostics page. Every action is a public endpoint, so it checks the switch
// itself instead of trusting the page that shows its form.
export async function failOnPurposeAction(): Promise<void> {
  if (!env.diagnosticsEnabled) return;
  await Promise.resolve();
  throw new Error(DIAGNOSTIC_MESSAGE);
}
