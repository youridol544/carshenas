import { listingPageUrl } from '../sources/divar/api.ts';

// Divar's answers for tests, built with the keys and nesting its web API used on 2026-09-29 (a search page and a post,
// read then with the agent's browser and curl) and invented values: no listing's real text, photo or token is kept in
// the repository (ADR-0017 point 7). Everything the crawler must leave out is here too, so tests can prove it does.

const RLM = String.fromCodePoint(0x200f);
const ACTION_LOG = {
  server_side_info: { info: { '@type': 'type.googleapis.com/action_log.Info' } },
  enabled: true,
};

export type FixtureRow = {
  readonly token: string;
  /** Divar's sort time, ISO 8601. */
  readonly sortedAt: string;
  readonly title?: string;
  readonly price?: string;
  readonly bumped?: boolean;
  readonly promoted?: boolean;
};

export type FixturePage = {
  readonly hasNextPage?: boolean;
  /** pagination.data: sent back as the next page's pagination_data. */
  readonly cursor?: unknown;
  /** brand_model values the page links one level down (first pages only). */
  readonly childValues?: readonly string[];
  /**
   * Where the search's own rows run out: Divar then shows a divider and listings from nearby cities (suggestions), or,
   * when it has no row at all, a notice before them (no exact result).
   */
  readonly end?: {
    readonly kind: 'suggestions' | 'no_exact_result';
    readonly suggested: readonly FixtureRow[];
  };
};

const END_WIDGET = {
  suggestions: { widget_type: 'SUGGESTION_ROW', data: { title: 'آگهی‌های پیشنهادی در شهرهای اطراف' } },
  no_exact_result: { widget_type: 'SELECTOR_ROW', data: { title: 'نتیجهٔ دقیقی پیدا نشد' } },
} as const;

function row(fixture: FixtureRow): object {
  return {
    widget_type: 'POST_ROW',
    data: {
      '@type': 'type.googleapis.com/widgets.PostRowData',
      title: fixture.title ?? 'پژو ۲۰۶ آزمایشی',
      action: {
        type: 'VIEW_POST',
        payload: { token: fixture.token, web_info: { title: 'پژو ۲۰۶ آزمایشی', district_persian: 'نارمک' } },
      },
      image_url: `https://s100.divarcdn.com/static/photo/neda/webp_thumbnail/THUMB/${fixture.token}-1.webp`,
      bottom_description_text: fixture.bumped || fixture.promoted ? 'در نارمک' : 'دقایقی پیش در نارمک',
      middle_description_text: fixture.price ?? '۱,۲۵۰,۰۰۰,۰۰۰ تومان',
      top_description_text: '۱۲۰,۰۰۰ کیلومتر',
      ...(fixture.bumped && { red_text: 'نردبان شده' }),
      ...(fixture.promoted && { red_text: 'پله شده' }),
      image_count: 3,
      token: fixture.token,
    },
    action_log: {
      server_side_info: {
        info: { '@type': 'type.googleapis.com/action_log.PostItemInfo', sort_date: fixture.sortedAt },
      },
      enabled: true,
    },
  };
}

/**
 * A search page's answer. Like Divar's, it leaves out what protobuf's JSON leaves out: an empty list (a page past the
 * last row has no list_widgets) and a false flag (has_next_page).
 */
export function searchAnswer(rows: readonly FixtureRow[], page: FixturePage = {}): string {
  const promoted = rows.filter((fixture) => fixture.promoted).map((fixture) => fixture.token);
  const listWidgets = [
    ...rows.map(row),
    ...(page.end ? [END_WIDGET[page.end.kind], ...page.end.suggested.map(row)] : []),
  ];
  return JSON.stringify({
    list_top_widgets: [{ widget_type: 'POST_LIST_HEADLINE', data: { text: 'خرید و فروش خودرو در تهران' } }],
    ...(listWidgets.length > 0 && { list_widgets: listWidgets }),
    list_bottom_widgets: [
      {
        widget_type: 'SEO_LINKS',
        data: {
          links: (page.childValues ?? []).map((value) => ({
            title: `خودرو ${value} در تهران`,
            action: {
              type: 'OPEN_POSTLIST_PAGE_GRPC',
              payload: {
                search_data: {
                  form_data: {
                    data: {
                      category: { str: { value: 'light' } },
                      brand_model: { repeated_string: { value: [value] } },
                    },
                  },
                },
              },
            },
          })),
        },
      },
    ],
    action_log: {
      server_side_info: {
        info: { pelle: { elastic: { tokens: promoted, total_hits_count: promoted.length } } },
      },
    },
    pagination: { ...(page.hasNextPage && { has_next_page: true }), data: page.cursor ?? { page: 1 } },
    search_id: 'search-id',
  });
}

export type FixturePost = {
  readonly token: string;
  readonly title?: string;
  readonly description?: string;
  /** «قیمت پایه»'s value, without the leading right-to-left mark Divar puts before it. */
  readonly price?: string;
  /** «انتشار آگهی»'s value. */
  readonly published?: string;
  readonly brandModel?: string;
  readonly category?: string;
  readonly photos?: number;
  readonly dealer?: boolean;
  /** A section Divar might add one day. */
  readonly extraSection?: string;
  /** seo.unavailable_after, on Tehran's clock without a zone, as Divar writes it. */
  readonly unavailableAfter?: string;
};

/** A post's answer. */
export function postAnswer(fixture: FixturePost): string {
  const title = fixture.title ?? 'پژو ۲۰۶ تیپ ۵ آزمایشی';
  const category = fixture.category ?? 'light';
  const photos = Array.from({ length: fixture.photos ?? 3 }, (_, index) => ({
    image: {
      url: `https://s100.divarcdn.com/static/photo/neda/webp_post/FULL${String(index)}/${fixture.token}-${String(index)}.webp`,
      alt: `${title}|خودرو سواری و وانت|تهران, نارمک|دیوار`,
      thumbnail_url: `https://s100.divarcdn.com/static/photo/neda/webp_thumbnail/THUMB${String(index)}/${fixture.token}-${String(index)}.webp`,
    },
  }));
  const categoryAction = (value: string) => ({
    type: 'OPEN_POSTLIST_PAGE_GRPC',
    payload: { search_data: { form_data: { data: { category: { str: { value } } } } } },
  });
  const sections: object[] = [
    {
      section_name: 'BREADCRUMB',
      widgets: [
        {
          widget_type: 'BREADCRUMB',
          data: {
            parent_items: [
              { title: 'وسایل نقلیه', action: categoryAction('vehicles') },
              { title: 'خودرو', action: categoryAction('cars') },
              { title: 'سواری', action: categoryAction(category) },
            ],
          },
        },
      ],
    },
    {
      section_name: 'TITLE',
      widgets: [
        { widget_type: 'LEGEND_TITLE_ROW', data: { title, high_level_heading: true } },
        {
          widget_type: 'EXPANDABLE_SECTION',
          data: {
            widget_list: [
              {
                widget_type: 'DESCRIPTION_ROW',
                data: {
                  text: `انتشار آگهی: ${fixture.published ?? '۲ مهر ۱۴۰۵، ۰۹:۴۷'}\nآخرین به‌روز‌رسانی: ۷ مهر ۱۴۰۵، ۱۳:۴۳`,
                },
              },
            ],
            title: '۵ روز پیش در تهران، نارمک، خ آزمایش',
          },
        },
        {
          widget_type: 'SELECTOR_ROW',
          data: { title: 'زنگ خطرهای قبل از معامله', action: { type: 'LOAD_PAGE' } },
        },
      ],
    },
    {
      section_name: 'DESCRIPTION',
      widgets: [
        { widget_type: 'TITLE_ROW', data: { text: 'توضیحات' } },
        {
          widget_type: 'DESCRIPTION_ROW',
          data: { text: fixture.description ?? 'بدون رنگ\nبیمه تا آخر سال' },
        },
      ],
    },
    {
      section_name: 'IMAGE',
      widgets: [{ widget_type: 'IMAGE_CAROUSEL', data: { items: photos }, action_log: ACTION_LOG }],
    },
    {
      section_name: 'LIST_DATA',
      widgets: [
        {
          widget_type: 'GROUP_INFO_ROW',
          data: {
            items: [
              { title: 'کارکرد', value: '۹۱۰۰۰' },
              { title: 'مدل (سال تولید)', value: '۱۳۹۲ - ۲۰۱۳' },
            ],
          },
        },
        { widget_type: 'UNEXPANDABLE_ROW', data: { title: 'برند و مدل', value: 'پژو 206 تیپ ۵' } },
        ...(fixture.price === undefined
          ? []
          : [
              {
                widget_type: 'UNEXPANDABLE_ROW',
                data: { title: 'قیمت پایه', value: `${RLM}${fixture.price}` },
              },
            ]),
        { widget_type: 'SCORE_ROW', data: { title: 'موتور', descriptive_score: 'سالم' } },
        {
          widget_type: 'SELECTOR_ROW',
          data: {
            title: 'سایر ویژگی‌ها و امکانات',
            action: {
              type: 'LOAD_MODAL_PAGE',
              payload: {
                modal_page: {
                  widget_list: [
                    {
                      widget_type: 'UNEXPANDABLE_ROW',
                      data: { title: 'مالکیت خودرو', value: 'مالک خودرو هستم' },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          widget_type: 'SELECTOR_ROW',
          data: {
            title: 'بررسی و کارشناسی',
            action: { type: 'OPEN_PAGE', payload: { post_token: fixture.token } },
          },
        },
      ],
    },
    { section_name: 'TAGS', widgets: [{ widget_type: 'WRAPPER_ROW', data: { chip_list: { chips: [] } } }] },
    {
      section_name: 'MAP',
      widgets: [
        {
          widget_type: 'MAP_ROW',
          data: {
            location: {
              type: 'FUZZY',
              fuzzy_data: { point: { latitude: 35.7, longitude: 51.4 }, radius: 500 },
            },
          },
        },
      ],
    },
    { section_name: 'NOTE', widgets: [{ widget_type: 'NOTE', data: { title: 'یادداشت من' } }] },
    { section_name: 'STATIC', widgets: [{ widget_type: 'SELECTOR_ROW', data: { title: 'گزارش آگهی' } }] },
    ...(fixture.dealer
      ? [
          {
            section_name: 'BUSINESS_SECTION',
            widgets: [
              {
                widget_type: 'LAZY_SECTION',
                data: {
                  request_data: { post_token: fixture.token, hashed_post_owner_user_id: 'a'.repeat(64) },
                },
              },
            ],
          },
        ]
      : []),
    ...(fixture.extraSection === undefined
      ? []
      : [{ section_name: fixture.extraSection, widgets: [{ widget_type: 'NEW_ROW', data: { text: 'x' } }] }]),
  ];
  return JSON.stringify({
    sections,
    share: { title, web_url: listingPageUrl(fixture.token) },
    seo: {
      title: `${title} در تهران - ۷ مهر ۱۴۰۵`,
      description: `آگهی ${title} در دیوار تهران`,
      web_info: { title, district_persian: 'نارمک', city_persian: 'تهران' },
      unavailable_after: fixture.unavailableAfter ?? '2026-10-25T09:47:29.934771',
      bread_crumb: [
        {
          name: 'پژو 206 تیپ ۵',
          search_data: { form_data: { data: { districts: { repeated_string: { value: ['70'] } } } } },
        },
      ],
    },
    contact: { contact_uuid: '00000000-0000-4000-8000-000000000000', action_log: ACTION_LOG },
    webengage: {
      brand_model: fixture.brandModel ?? 'Peugeot 206 5',
      business_type: fixture.dealer ? 'premium-panel' : 'personal',
      category,
      cat_3: category,
      price: 1_249_999_872,
      gender: '',
      business_ref: fixture.dealer ? 'dealer-ref' : '',
      token: fixture.token,
    },
    analytics: { cat1: 'vehicles', cat2: 'cars', cat3: category, city: 'tehran' },
    city: { city_id: '1', name: 'تهران', second_slug: 'tehran' },
  });
}
