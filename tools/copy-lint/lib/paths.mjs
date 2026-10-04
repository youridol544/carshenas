// Where things are. The tool lives in tools/copy-lint; every path it reports is relative to the repository root, with
// forward slashes, so a report reads the same on every machine.
import path from 'node:path';

export const TOOL_DIR = path.resolve(import.meta.dirname, '..');
export const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..');

export const ALLOWLIST_FILE = path.join(TOOL_DIR, 'allowlist.json');
export const BASELINE_FILE = path.join(TOOL_DIR, 'baseline.json');
export const PLAN_FILE = path.join(REPO_ROOT, 'docs', 'design', 'copy-rewrite-plan.md');

export function toPosix(file) {
  return file.split(path.sep).join('/');
}

export function relativeToRepo(absolute) {
  return toPosix(path.relative(REPO_ROOT, absolute));
}
