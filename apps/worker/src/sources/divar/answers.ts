import * as z from 'zod';
import type { JsonObject, JsonValue } from '@carshenas/db/db-types';
import type { SourceResponse } from '../../runtime/http.ts';

// How Divar refuses without saying so (ADR-0018 point 6; CS-33 criterion 2). A challenge page is HTML where JSON was
// expected; a quiet block is an empty or unreadable answer, or one that is not a search answer at all, or a page with no
// listings where there must be some (other entrants saw Divar block with an empty HTTP 200). Each stops the source
// like a 403, until a person has read the evidence and resumes it.
// Divar writes its JSON as protobuf does, leaving out an empty list: a page past a search's last row comes back without
// list_widgets but with the rest of a search answer (its search_id, search_data or pagination), which a refusal lacks.
// The first measurement met one on 2026-09-29, after a slice's short last page, and stopped Divar on it.

/** A page Divar's API sent that is not the shape the crawler reads: its API changed, not a refusal. */
export class DivarShapeError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'DivarShapeError';
  }
}

export type BlockKind = 'blocked' | 'challenge';

const searchAnswer = z.looseObject({ list_widgets: z.array(z.unknown()) });
const emptySearchAnswer = z.union([
  z.looseObject({ search_id: z.string().min(1) }),
  z.looseObject({ search_data: z.looseObject({}) }),
  z.looseObject({ pagination: z.looseObject({}) }),
]);
const postRowWidget = z.looseObject({ widget_type: z.literal('POST_ROW') });
const postAnswer = z.looseObject({ sections: z.array(z.unknown()) });

function looksLikeHtml(body: string): boolean {
  const start = body.trimStart().slice(0, 512).toLowerCase();
  return start.startsWith('<') || start.includes('<html') || start.includes('<!doctype');
}

/** Whether a JSON value is an object (not an array, not null). */
export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The answer's JSON when it is an object; undefined otherwise. */
export function jsonObjectOf(body: string): JsonObject | undefined {
  let value: JsonValue;
  try {
    // JSON.parse returns JSON whatever its declared type says.
    value = JSON.parse(body) as JsonValue;
  } catch {
    return undefined;
  }
  return isJsonObject(value) ? value : undefined;
}

/**
 * A search answer's list widgets: its list_widgets, or none when the list was left out of an answer that is otherwise a
 * search's; undefined when the answer is not a search's at all.
 */
export function listWidgetsOf(json: JsonObject): readonly unknown[] | undefined {
  const page = searchAnswer.safeParse(json);
  if (page.success) return page.data.list_widgets;
  if ('list_widgets' in json) return undefined;
  return emptySearchAnswer.safeParse(json).success ? [] : undefined;
}

/** Whether a successful answer is a refusal; other statuses are the job's to read. */
function refusalOf(answer: SourceResponse, isExpected: (json: JsonObject) => boolean): BlockKind | undefined {
  if (answer.status < 200 || answer.status > 299) return undefined;
  if (looksLikeHtml(answer.body)) return 'challenge';
  const json = jsonObjectOf(answer.body);
  return json !== undefined && isExpected(json) ? undefined : 'blocked';
}

/**
 * Recognises a refused search page. `expectRows` is true where listings must be there: the tracked models' feed, and
 * any page the previous one said follows.
 */
export function searchRefusal(expectRows: boolean): (answer: SourceResponse) => BlockKind | undefined {
  return (answer) =>
    refusalOf(answer, (json) => {
      const widgets = listWidgetsOf(json);
      if (widgets === undefined) return false;
      return !expectRows || widgets.some((widget) => postRowWidget.safeParse(widget).success);
    });
}

/** Recognises a refused post: a post's answer always has its sections. */
export function postRefusal(answer: SourceResponse): BlockKind | undefined {
  return refusalOf(answer, (json) => postAnswer.safeParse(json).success);
}
