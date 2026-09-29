import { setTimeout as sleep } from 'node:timers/promises';

/** Polls `check` until it returns true, or fails after `timeoutMs` with `what`. */
export async function until(
  what: string,
  check: () => boolean | Promise<boolean>,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!(await check())) {
    if (performance.now() > deadline) throw new Error(`timed out waiting until ${what}`);
    await sleep(50);
  }
}
