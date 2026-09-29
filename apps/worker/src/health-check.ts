import { env } from './env.ts';

// `pnpm worker:health`: asks the running worker's health endpoint and exits 0 when it answers ok, 1 otherwise, with
// the answer on standard output. For people, scripts and the deployment's supervisor alike.

const url = `http://127.0.0.1:${env.healthPort}/health`;
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  process.stdout.write(`${await response.text()}\n`);
  process.exitCode = response.ok ? 0 : 1;
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  process.stdout.write(`${JSON.stringify({ status: 'unreachable', url, reason })}\n`);
  process.exitCode = 1;
}
