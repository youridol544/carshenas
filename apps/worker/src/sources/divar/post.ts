import * as z from 'zod';
import type { JsonObject, JsonValue } from '@carshenas/db/db-types';
import { readTehranDateTime } from '@carshenas/locale/jalali';
import { replacePhoneNumbers } from '@carshenas/observability/redact';
import { parseShownPrice, type ShownPrice } from '../price.ts';
import { DivarShapeError, isJsonObject, jsonObjectOf } from './answers.ts';
import { CARS } from './api.ts';

// One Divar post as a snapshot stores it (CS-33 criterion 1; ADR-0008 point 7; docs/design/data-model.md, "snapshot"):
// the answer of GET /v8/posts-v2/web/{token}, kept as Divar structured it so every later parser (CS-34, CS-52) reads the
// source's own fields, minus what must not be stored or would make an unchanged listing look changed:
//   - personal data: the contact object (tokens that lead to the seller's number), the map point (a private seller's
//     can be their home; the district stays in seo.web_info and the tags), the dealer section's hashed owner id, and
//     phone numbers written into any text;
//   - the viewer's own interface: the note, report and fraud-warning rows, the service offers, the analytics blocks
//     and every action_log;
//   - what changes by itself: the «۵ روز پیش» line above the dates, and the dated page title.
// Sections Divar adds later are left out until someone decides to keep them; the job counts them.
// Every photo is kept, full size and thumbnail, in Divar's order: CS-60 can show them from Divar's CDN or store them
// without another request (the owner, 2026-09-29).

/** The version of this form, stored with each snapshot: a new version may re-express an unchanged post. */
export const CANONICAL_VERSION = 1;

/** What a phone number a seller wrote into the listing reads as in its snapshot (the rule is the logs' own). */
export const PHONE_REMOVED = '[شماره حذف شد]';

const KEPT_SECTIONS: ReadonlySet<string> = new Set([
  'BREADCRUMB',
  'TITLE',
  'DESCRIPTION',
  'IMAGE',
  'LIST_DATA',
  'TAGS',
]);
/** Sections left out on purpose, so only unknown ones are reported. */
const DROPPED_SECTIONS: ReadonlySet<string> = new Set(['MAP', 'NOTE', 'STATIC', 'BUSINESS_SECTION']);
const KEPT_SEO = ['unavailable_after', 'web_info', 'bread_crumb'] as const;
const KEPT_WEBENGAGE = ['brand_model', 'business_type', 'category'] as const;

const PUBLISHED = 'انتشار آگهی';
const BASE_PRICE = 'قیمت پایه';

// What the facts are read from; the snapshot itself is built from the answer's own JSON.
const section = z.looseObject({
  section_name: z.string(),
  widgets: z.array(z.looseObject({ widget_type: z.string(), data: z.looseObject({}).optional() })),
});
const post = z.looseObject({
  sections: z.array(section),
  webengage: z
    .looseObject({
      brand_model: z.string().optional(),
      category: z.string().optional(),
      cat_3: z.string().optional(),
    })
    .optional(),
});
const labelledRow = z.looseObject({ title: z.string(), value: z.string() });
const carouselItem = z.looseObject({
  image: z.looseObject({ url: z.string(), thumbnail_url: z.string().optional() }),
});
const breadcrumbItem = z.looseObject({
  action: z
    .looseObject({
      payload: z
        .looseObject({
          search_data: z
            .looseObject({
              form_data: z.looseObject({
                data: z.looseObject({
                  category: z.looseObject({ str: z.looseObject({ value: z.string() }) }).optional(),
                }),
              }),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

type Section = z.infer<typeof section>;

export type PhotoUrls = {
  /** The full-size photo. */
  readonly url: string;
  readonly thumbnailUrl: string | undefined;
};

export type PostFacts = {
  /**
   * Whether Divar files it under cars and pick-ups («light»): anything else is not stored (the field survey found
   * motorcycles among other entrants' "cars").
   */
  readonly isCar: boolean;
  /** Divar's own make, model and trim value («Peugeot 206 5»). */
  readonly brandModel: string | undefined;
  /** «انتشار آگهی»: when it was posted, on Tehran's clock. */
  readonly publishedAt: Date | undefined;
  /** «قیمت پایه» as shown, and as read; the reading is undefined when the text is not a price. */
  readonly priceText: string | undefined;
  readonly price: ShownPrice | undefined;
  readonly photos: readonly PhotoUrls[];
  /** Sections this form does not know yet, left out of the snapshot. */
  readonly unknownSections: readonly string[];
};

export type ReadPost = {
  /** The snapshot's payload. */
  readonly payload: JsonObject;
  readonly facts: PostFacts;
};

function objectsOf(value: JsonValue | undefined): JsonObject[] {
  return Array.isArray(value) ? value.filter(isJsonObject) : [];
}

/** The value with every action_log dropped and every text but an address freed of phone numbers. */
function scrubbed(value: JsonValue): JsonValue {
  if (typeof value === 'string')
    return /^https?:\/\//.test(value) ? value : replacePhoneNumbers(value, PHONE_REMOVED);
  if (Array.isArray(value)) return value.map(scrubbed);
  if (!isJsonObject(value)) return value;
  const kept: JsonObject = {};
  for (const [key, inner] of Object.entries(value)) {
    if (key !== 'action_log' && inner !== undefined) kept[key] = scrubbed(inner);
  }
  return kept;
}

function keeps(sectionName: string, widget: JsonObject): boolean {
  const type = widget.widget_type;
  if (sectionName === 'TITLE' && type === 'SELECTOR_ROW') return false;
  // In the car's list, a row that opens a modal holds its other features; the others open service offers.
  if (sectionName === 'LIST_DATA' && type === 'SELECTOR_ROW') {
    const data = widget.data;
    const action = isJsonObject(data) ? data.action : undefined;
    return isJsonObject(action) && action.type === 'LOAD_MODAL_PAGE';
  }
  return true;
}

function withoutRelativeTime(widget: JsonObject): JsonObject {
  const data = widget.data;
  if (widget.widget_type !== 'EXPANDABLE_SECTION' || !isJsonObject(data)) return widget;
  // Its title is «۵ روز پیش در تهران، …»: it changes every day, and names the street.
  const { title: _relative, ...rest } = data;
  return { ...widget, data: rest };
}

function picked(value: JsonValue | undefined, keys: readonly string[]): JsonObject | undefined {
  if (!isJsonObject(value)) return undefined;
  const kept: JsonObject = {};
  for (const key of keys) if (value[key] !== undefined) kept[key] = value[key];
  return kept;
}

function payloadOf(answer: JsonObject): JsonObject {
  const payload: JsonObject = {
    sections: objectsOf(answer.sections).flatMap((kept) => {
      const name = kept.section_name;
      if (typeof name !== 'string' || !KEPT_SECTIONS.has(name)) return [];
      return [
        {
          section_name: name,
          widgets: objectsOf(kept.widgets)
            .filter((widget) => keeps(name, widget))
            .map(withoutRelativeTime),
        },
      ];
    }),
  };
  const seo = picked(answer.seo, KEPT_SEO);
  if (seo) payload.seo = seo;
  const share = picked(answer.share, ['web_url']);
  if (share) payload.share = share;
  if (isJsonObject(answer.city)) payload.city = answer.city;
  const webengage = picked(answer.webengage, KEPT_WEBENGAGE);
  if (webengage) payload.webengage = webengage;
  const clean = scrubbed(payload);
  if (!isJsonObject(clean)) throw new DivarShapeError('the canonical post is not an object');
  return clean;
}

function textsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textsOf);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(textsOf);
  return [];
}

function publishedAtOf(sections: readonly Section[]): Date | undefined {
  const title = sections.find((kept) => kept.section_name === 'TITLE');
  for (const text of textsOf(title?.widgets)) {
    for (const line of text.split('\n')) {
      const colon = line.indexOf(':');
      if (colon > 0 && line.slice(0, colon).trim() === PUBLISHED) {
        return readTehranDateTime(line.slice(colon + 1));
      }
    }
  }
  return undefined;
}

function priceTextOf(sections: readonly Section[]): string | undefined {
  const listData = sections.find((kept) => kept.section_name === 'LIST_DATA');
  for (const widget of listData?.widgets ?? []) {
    const row = labelledRow.safeParse(widget.data);
    if (row.success && row.data.title.trim() === BASE_PRICE) return row.data.value;
  }
  return undefined;
}

function isCar(read: z.infer<typeof post>): boolean {
  const category = read.webengage?.cat_3 ?? read.webengage?.category;
  if (category !== undefined) return category === CARS;
  const breadcrumb = read.sections.find((kept) => kept.section_name === 'BREADCRUMB');
  return (breadcrumb?.widgets ?? [])
    .flatMap((widget) => listOf(widget.data?.parent_items))
    .some((item) => {
      const crumb = breadcrumbItem.safeParse(item);
      return (
        crumb.success && crumb.data.action?.payload?.search_data?.form_data.data.category?.str.value === CARS
      );
    });
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Every photo a post payload (canonical or as answered) shows, full size and thumbnail, in Divar's order. */
export function photoUrlsOf(payload: JsonObject): PhotoUrls[] {
  const parsed = post.safeParse(payload);
  if (!parsed.success) return [];
  const image = parsed.data.sections.find((kept) => kept.section_name === 'IMAGE');
  return (image?.widgets ?? [])
    .filter((widget) => widget.widget_type === 'IMAGE_CAROUSEL')
    .flatMap((widget) => listOf(widget.data?.items))
    .flatMap((item) => {
      const photo = carouselItem.safeParse(item);
      return photo.success
        ? [{ url: photo.data.image.url, thumbnailUrl: photo.data.image.thumbnail_url }]
        : [];
    });
}

/** Reads a post's answer into its snapshot and facts; throws DivarShapeError when it is not a post. */
export function readPost(body: string): ReadPost {
  const answer = jsonObjectOf(body);
  const parsed = post.safeParse(answer);
  if (answer === undefined || !parsed.success) {
    throw new DivarShapeError('the post answer is not a post', { cause: parsed.error });
  }
  const kept = parsed.data.sections.filter((item) => KEPT_SECTIONS.has(item.section_name));
  const payload = payloadOf(answer);
  const priceText = priceTextOf(kept);
  return {
    payload,
    facts: {
      isCar: isCar(parsed.data),
      brandModel: parsed.data.webengage?.brand_model,
      publishedAt: publishedAtOf(kept),
      priceText,
      price: priceText === undefined ? undefined : parseShownPrice(priceText),
      photos: photoUrlsOf(payload),
      unknownSections: parsed.data.sections
        .map((item) => item.section_name)
        .filter((name) => !KEPT_SECTIONS.has(name) && !DROPPED_SECTIONS.has(name)),
    },
  };
}
