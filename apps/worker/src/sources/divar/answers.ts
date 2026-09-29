import * as z from 'zod';
import type { JsonObject, JsonValue } from '@carshenas/db/db-types';
import type { SourceResponse } from '../../runtime/http.ts';

// How Divar refuses without saying so (ADR-0018 point 6; CS-33 criterion 2). A challenge page is HTML where JSON was
// expected; a quiet block is an empty or unreadable answer, or one without the lists every search answer has, or a
// page with no listings where there must be some (other entrants saw Divar block with an empty HTTP 200). Each stops
// the source like a 403, until a person has read the evidence and resumes it.

/** A page Divar's API sent that is not the shape the crawler reads: its API changed, not a refusal. */
export class DivarShapeError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'DivarShapeError';
  }
}

export type BlockKind = 'blocked' | 'challenge';

const searchAnswer = z.looseObject({ list_widgets: z.array(z.unknown()) });
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
      const page = searchAnswer.safeParse(json);
      if (!page.success) return false;
      return !expectRows || page.data.list_widgets.some((widget) => postRowWidget.safeParse(widget).success);
    });
}

/** Recognises a refused post: a post's answer always has its sections. */
export function postRefusal(answer: SourceResponse): BlockKind | undefined {
  return refusalOf(answer, (json) => postAnswer.safeParse(json).success);
}
