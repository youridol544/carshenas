import 'server-only';
import path from 'node:path';

/**
 * The repository root, two levels above the app, as next.config.ts gives it to Turbopack. Paths in stack traces are
 * shown from it, so a file reads the same in a server stack, a browser stack and, later, the crawler's.
 */
export const REPOSITORY_ROOT = path.resolve(process.cwd(), '..', '..');
