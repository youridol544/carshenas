// Result files and the Metis key, shared by the lab's scripts. The key comes from the repository's git-ignored .env and
// is only ever placed in request headers by the SDK, never printed or written.
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function writeResults(name: string, results: unknown): string {
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  const file = fileURLToPath(new URL(`./results-${name}-${stamp}.json`, import.meta.url));
  writeFileSync(file, JSON.stringify(results, null, 2) + '\n');
  return file;
}

export function metisKey(): string {
  const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const key = process.env.METIS_API_KEY;
  if (!key) {
    console.error('METIS_API_KEY is missing: add it to the repository .env, which git ignores.');
    process.exit(1);
  }
  return key;
}
