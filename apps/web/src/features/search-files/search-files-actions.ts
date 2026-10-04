'use server';

import { redirect, RedirectType } from 'next/navigation';
import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { SEARCH_FILES_COPY } from '@/features/search-files/search-files-copy';
import {
  createFileSchema,
  fileIdSchema,
  renameFileSchema,
  setAlertsSchema,
  setStateSchema,
} from '@/features/search-files/search-files-schemas';
import type {
  CreateFileResult,
  FileActionResult,
  PreparedSave,
} from '@/features/search-files/search-files-types';
import {
  deleteSearchFile,
  insertSearchFile,
  renameSearchFile,
  setSearchFileMuted,
  setSearchFileState,
} from '@/features/search-files/server/file-mutations';
import { countSearchFiles, findFileBySearch } from '@/features/search-files/server/file-queries';
import { MAX_SEARCH_FILES } from '@/features/search-files/search-files-rules';
import { SEARCH_FILES_PATH } from '@/lib/return-path';
import { currentAccount } from '@/server/auth/current-account';
import { isSameOriginRequest } from '@/server/auth/request-origin';
import { captureError, logger } from '@/server/observability/logger';

// The search-file actions (CS-70, ADR-0031). Each is a public POST endpoint: it checks that the request came from a page
// of this site, parses its whole input, takes the account from the session (never from the input), changes a target
// state, and refreshes the page so the answer carries the new truth. «سپردن به کارشناس» asks once what it can do
// (prepareSearchSaveAction: sign in first, the file already exists, the limit is reached) before the dialog shows a
// form; that read is one call the buyer's own press makes, not data a page loads. A database that does not answer
// comes back as a Farsi message beside the control, reported once.

const log = logger.child({ component: 'search-files' });

class CrossSiteRequestError extends Error {
  constructor() {
    super('a request that changes search files came from outside this site');
    this.name = 'CrossSiteRequestError';
  }
}

async function signedInAccountId(): Promise<number | undefined> {
  if (!isSameOriginRequest(await headers())) throw new CrossSiteRequestError();
  return (await currentAccount())?.id;
}

const FAILED: FileActionResult = { status: 'failed', message: SEARCH_FILES_COPY.actions.failed };
const SIGNED_OUT: FileActionResult = { status: 'failed', message: SEARCH_FILES_COPY.actions.signedOut };
const GONE: FileActionResult = { status: 'gone', message: SEARCH_FILES_COPY.actions.gone };

/** What «سپردن به کارشناس» can do for this visitor and this search, before the dialog shows its form. */
export async function prepareSearchSaveAction(input: unknown): Promise<PreparedSave | { status: 'failed' }> {
  const accountId = await signedInAccountId();
  if (accountId === undefined) return { status: 'signed_out' };
  const parsed = createFileSchema.shape.search.safeParse(input);
  if (!parsed.success) return { status: 'failed' };
  try {
    const existing = await findFileBySearch(accountId, parsed.data);
    if (existing !== undefined) return { status: 'exists', file: existing };
    if ((await countSearchFiles(accountId)) >= MAX_SEARCH_FILES) return { status: 'limit' };
  } catch (error) {
    captureError(error, { message: 'preparing a search file failed', fields: { accountId } });
    return { status: 'failed' };
  }
  return { status: 'ready' };
}

/** Makes a file from the search and a name. The same search twice is one file; the limit and a bad name come back as results. */
export async function createSearchFileAction(input: unknown): Promise<CreateFileResult> {
  const accountId = await signedInAccountId();
  if (accountId === undefined) return { status: 'signed_out' };
  const parsed = createFileSchema.safeParse(input);
  if (!parsed.success) {
    const nameIsWrong = parsed.error.issues.some((issue) => issue.path[0] === 'name');
    return nameIsWrong
      ? { status: 'invalid', field: 'name', message: SEARCH_FILES_COPY.save.invalidName }
      : { status: 'invalid', field: 'search', message: SEARCH_FILES_COPY.save.invalidSearch };
  }
  const { name, search } = parsed.data;
  try {
    const outcome = await insertSearchFile(accountId, name, search);
    switch (outcome.status) {
      case 'created':
        log.info('search file created', { accountId, fileId: outcome.id });
        refresh();
        return { status: 'created', file: { id: outcome.id, name } };
      case 'exists': {
        const existing = await findFileBySearch(accountId, search);
        if (existing !== undefined) return { status: 'exists', file: existing };
        return { status: 'failed', message: SEARCH_FILES_COPY.save.failed };
      }
      case 'limit': {
        // The trigger runs before the unique check, so a buyer at the limit who saves a search they already keep
        // is told about the file they have, not that there is no room.
        const existing = await findFileBySearch(accountId, search);
        return existing === undefined ? { status: 'limit' } : { status: 'exists', file: existing };
      }
      case 'invalid':
        return {
          status: 'invalid',
          field: outcome.field,
          message:
            outcome.field === 'name'
              ? SEARCH_FILES_COPY.save.invalidName
              : SEARCH_FILES_COPY.save.invalidSearch,
        };
    }
  } catch (error) {
    captureError(error, { message: 'creating a search file failed', fields: { accountId } });
    return { status: 'failed', message: SEARCH_FILES_COPY.save.failed };
  }
}

export async function renameSearchFileAction(input: unknown): Promise<FileActionResult> {
  const accountId = await signedInAccountId();
  if (accountId === undefined) return SIGNED_OUT;
  const parsed = renameFileSchema.safeParse(input);
  if (!parsed.success) return { status: 'failed', message: SEARCH_FILES_COPY.save.invalidName };
  try {
    if (!(await renameSearchFile(accountId, parsed.data.id, parsed.data.name))) return GONE;
  } catch (error) {
    captureError(error, { message: 'renaming a search file failed', fields: { accountId } });
    return FAILED;
  }
  refresh();
  return { status: 'done' };
}

/** Moves a file to a state (the target, never a toggle): watching, paused or closed. */
export async function setSearchFileStateAction(input: unknown): Promise<FileActionResult> {
  const accountId = await signedInAccountId();
  if (accountId === undefined) return SIGNED_OUT;
  const parsed = setStateSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  const { id, state } = parsed.data;
  try {
    if (!(await setSearchFileState(accountId, id, state))) return GONE;
  } catch (error) {
    captureError(error, { message: 'changing a search file state failed', fields: { accountId } });
    return FAILED;
  }
  log.info('search file state set', { accountId, fileId: id, state });
  refresh();
  return { status: 'done' };
}

/** Turns the alerts of a file off or on (the target, never a toggle); the file keeps matching and showing what is new. */
export async function setSearchFileAlertsMutedAction(input: unknown): Promise<FileActionResult> {
  const accountId = await signedInAccountId();
  if (accountId === undefined) return SIGNED_OUT;
  const parsed = setAlertsSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  const { id, muted } = parsed.data;
  try {
    if (!(await setSearchFileMuted(accountId, id, muted))) return GONE;
  } catch (error) {
    captureError(error, { message: 'muting a search file failed', fields: { accountId } });
    return FAILED;
  }
  log.info('search file alerts set', { accountId, fileId: id, muted });
  refresh();
  return { status: 'done' };
}

/** Deletes a file and goes back to the list of files. */
export async function deleteSearchFileAction(input: unknown): Promise<FileActionResult> {
  const accountId = await signedInAccountId();
  if (accountId === undefined) return SIGNED_OUT;
  const parsed = fileIdSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  try {
    // A file already gone is the state the buyer asked for: on to the list either way.
    await deleteSearchFile(accountId, parsed.data.id);
  } catch (error) {
    captureError(error, { message: 'deleting a search file failed', fields: { accountId } });
    return FAILED;
  }
  log.info('search file deleted', { accountId, fileId: parsed.data.id });
  redirect(SEARCH_FILES_PATH, RedirectType.replace);
}
