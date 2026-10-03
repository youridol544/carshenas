import * as z from 'zod';
import { toLatinDigits } from '@carshenas/locale/digits';
import { StoredSearchSchema } from '@carshenas/search/search';
import { cleanFileName } from '@/features/search-files/search-file-name';
import { MAX_NAME_LENGTH, SEARCH_FILE_STATES } from '@/features/search-files/search-files-rules';

// What the search-file actions accept (every argument is hostile: the Next.js data-security guide). The search must
// fit the stored form of the filters this build knows, so a hand-made body is refused here and never reaches the
// table; the owner always comes from the session, never from here.

const fileId = z.int().min(1).max(Number.MAX_SAFE_INTEGER);

const fileName = z.string().transform(cleanFileName).pipe(z.string().min(1).max(MAX_NAME_LENGTH));

export const createFileSchema = z.strictObject({
  name: fileName,
  /** The search in its stored form, as toStoredSearch() made it on the page. */
  search: StoredSearchSchema,
});

export const renameFileSchema = z.strictObject({ id: fileId, name: fileName });
export const setStateSchema = z.strictObject({ id: fileId, state: z.enum(SEARCH_FILE_STATES) });
export const fileIdSchema = z.strictObject({ id: fileId });

/** A file's id from the address bar: Latin or Persian digits, no sign, at most 16 of them; or undefined. */
export function readFileId(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const digits = toLatinDigits(value);
  if (!/^[1-9]\d{0,15}$/.test(digits)) return undefined;
  const parsed = fileId.safeParse(Number(digits));
  return parsed.success ? parsed.data : undefined;
}

export type CreateFileInput = z.input<typeof createFileSchema>;
