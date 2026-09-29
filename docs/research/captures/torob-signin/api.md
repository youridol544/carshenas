# Network and API map: https://torob.com/

Captured 2026-09-29T14:17:33.108Z. Redacted by construction: no cookie, header, query or body values; JSON is reduced to key names, types and SCREAMING_CASE enum constants.

246 requests to 9 hosts.

| Type | Requests | Transferred |
| --- | --- | --- |
| image | 114 | 3635 KB |
| script | 68 | 1545 KB |
| fetch | 21 | 952 KB |
| other | 19 | 155 KB |
| stylesheet | 13 | 48 KB |
| font | 6 | 202 KB |
| document | 2 | 0 KB |
| ping | 2 | 0 KB |
| manifest | 1 | 2 KB |

## Hosts

| Host | Party | Requests | Types |
| --- | --- | --- | --- |
| assets.torob.com | first | 114 | image, stylesheet, script, other, fetch, font |
| image.torob.com | first | 102 | image |
| torob.com | first | 10 | document, font, stylesheet, manifest |
| sentry.torob.ir | third | 6 | fetch |
| api.torob.com | first | 5 | fetch, image |
| region1.analytics.google.com | third | 3 | fetch |
| www.googletagmanager.com | third | 2 | script |
| stats.g.doubleclick.net | third | 2 | ping |
| www.google.co.uk | third | 2 | image |

## Endpoints

| Method | Host | Path pattern | GraphQL | Calls | Status | Query names |
| --- | --- | --- | --- | --- | --- | --- |
| GET | assets.torob.com | `/nextjs/main/mobile/:token/_next/static/css/:token` |  | 8 | 200 |  |
| GET | api.torob.com | `/check-app-logo/` |  | 2 | 200 | source, t |
| GET | api.torob.com | `/v4/search-trends/` |  | 1 | 200 | source, t |
| GET | api.torob.com | `/v4/special-offers/` |  | 1 | 200 | flavor_name, page, size, source, t |
| POST | sentry.torob.ir | `/api/:id/envelope/` |  | 6 | 200 | sentry_client, sentry_key, sentry_version |
| POST | region1.analytics.google.com | `/g/collect` |  | 3 | 204 | _ee, _et, _eu, _fv, _gaz, _nsi, _p, _s, _ss, cid, dl, dma, dt, ecid, en, ep.is_mobile, ep.level2, frm, gaf, gcd, gtm, npa, pscdl, rcb, sct, seg, sid, sr, tag_exp, tfd, tid, uaa, uab, uafvl, uam, uamb, uap, uapv, uaw, ul, v |

## Shapes

### GET api.torob.com/check-app-logo/

Request headers of note: none.

Response:

```json
{
  "main_logo_desktop": "string(empty)",
  "main_logo_desktop_dark": "string(empty)",
  "next_logo_desktop": "string(empty)",
  "next_logo_desktop_dark": "string(empty)",
  "main_logo_mobile": "string(empty)",
  "main_logo_mobile_dark": "string(empty)",
  "next_logo_mobile": "string(empty)",
  "next_logo_mobile_dark": "string(empty)",
  "redirect_url": "string(empty)"
}
```

### GET api.torob.com/v4/search-trends/

Request headers of note: none.

Response:

```json
[
  {
    "query": "string",
    "category_id": {
      "anyOf": [
        "integer",
        "null"
      ]
    },
    "partial_info?": {
      "badges": {
        "anyOf": [
          [],
          [
            {
              "text": "string",
              "icon": "null",
              "tooltip": "null",
              "badge_type": "string"
            },
            "×1"
          ]
        ]
      },
      "discount_info": [],
      "random_key": "string(uuid)",
      "name1": "string",
      "name1_max_lines": "integer",
      "name2": {
        "anyOf": [
          "string(empty)",
          "string"
        ]
      },
      "more_info_url": "string(url)",
      "web_client_absolute_url": "string",
      "price": "integer",
      "price_prefix": "string",
      "price_text": "string",
      "price_text_mode": "string",
      "shop_text": "string",
      "stock_status": {
        "anyOf": [
          "string(empty)",
          "string"
        ]
      },
      "delivery_city_name": "null",
      "delivery_city_flag": "null",
      "is_adv": "boolean",
      "similar_api": "string(url)",
      "media_search": "string(url)",
      "card_type": "string",
      "estimated_sell": "string(empty)",
      "media_urls": {
        "anyOf": [
          [
            {
              "type": "string",
              "url": "string(url)"
            },
            "×1"
          ],
          [
            {
              "type": "string",
              "url": "string(url)"
            },
            "×2"
          ],
          [
            {
              "type": "string",
              "url": "string(url)"
            },
            "×7"
          ],
          [
            {
              "type": "string",
              "url": "string(url)"
            },
            "×5"
          ],
          [
            {
              "type": "string",
              "url": "string(url)"
            },
            "×6"
          ]
        ]
      },
      "image_url": "string(url)",
      "image_count": "integer",
      "direct_cta": {
        "anyOf": [
          "null",
          {
            "url": "string(url)",
            "label": "string",
            "list_type": "string",
            "icon": "null"
          }
        ]
      },
      "has_nearby_shop": "boolean",
      "has_wiki": "boolean",
      "is_authentic": "redacted"
    },
    "type?": "string",
    "entity_type?": "string",
    "search_response_card?": {
      "shop_id": "integer",
      "name": "string",
      "logo_512": "string(url)",
      "domain": "string",
      "is_marketplace": "boolean",
      "is_active": "boolean",
      "has_public_torob_profile": "boolean",
      "is_non_partner": "boolean",
      "shop_profile_url": "string(url)",
      "shop_profile_card_click_log_url": "string(url)",
      "score_info": {
        "score": "integer",
        "score_text": "string",
        "score_color": "string",
        "score_background_color": "string",
        "complaints_info": {
          "title": "string",
          "summary": [
            "string",
            "×2"
          ]
        }
      },
      "guarantee_info": {
        "status": "string"
      },
      "has_active_torobpay": "boolean",
      "offline_contact_info": "null",
      "internet_shop_redirect_url": "string(url)"
    }
  },
  "×12"
]
```

### GET api.torob.com/v4/special-offers/

Request headers of note: none.

Response:

```json
{
  "results": [
    {
      "type": "integer",
      "data": {
        "anyOf": [
          [
            {
              "action": "string",
              "action_params": {},
              "more_info_url": "string(url)",
              "api_url": "string(url)",
              "image_url": "string(url)",
              "desktop_image_url": "string(url)",
              "title": "string",
              "type": "string"
            },
            "×7"
          ],
          [
            {
              "title": "string",
              "description": "string",
              "shop_id": "integer",
              "more_info_url": "string(url)",
              "api_url": "string(url)",
              "image_url": "string(url)",
              "action": "string"
            },
            "×1"
          ],
          [
            {
              "title": "string",
              "description": "string(empty)",
              "shop_id": "integer",
              "more_info_url": "string(url)",
              "api_url": "string(url)",
              "image_url": "string(url)",
              "action": "string",
              "action_params": {}
            },
            "×1"
          ],
          [
            {
              "action": "string",
              "action_params": {
                "id": "integer",
                "title": "string",
                "slug": "string"
              },
              "more_info_url": "string(url)",
              "api_url": "string(url)",
              "image_url": "string(url)",
              "desktop_image_url": "string(url)",
              "title": "string",
              "type": "string"
            },
            "×5"
          ],
          [
            {
              "action": "string",
              "action_params": {
                "flavor": "string",
                "title": "string",
                "logo": "string(url)"
              },
              "more_info_url": "string(url)",
              "api_url": "string(url)",
              "image_url": "string(url)",
              "desktop_image_url": "string(url)",
              "title": "string",
              "type": "string"
            },
            "×2"
          ],
          [
            {
              "action": "string",
              "action_params": {},
              "more_info_url": "string(url)",
              "api_url": "string(url)",
              "image_url": "string(url)",
              "desktop_image_url": "string(url)",
              "title": "string",
              "type": "string"
            },
            "×1"
          ]
        ]
      },
      "base_products?": {
        "anyOf": [
          [
            {
              "badges": {
                "anyOf": [
                  [],
                  [
                    {
                      "text": "string",
                      "icon": "null",
                      "tooltip": "null",
                      "badge_type": "string"
                    },
                    "×1"
                  ]
                ]
              },
              "discount_info": [],
              "random_key": "string(uuid)",
              "name1": "string",
              "name1_max_lines": "integer",
              "name2": {
                "anyOf": [
                  "string",
                  "string(empty)"
                ]
              },
              "more_info_url": "string(url)",
              "web_client_absolute_url": "string",
              "price": "integer",
              "price_prefix": "string",
              "price_text": "string",
              "price_text_mode": "string",
              "shop_text": "string",
              "stock_status": {
                "anyOf": [
                  "string(empty)",
                  "string"
                ]
              },
              "delivery_city_name": "null",
              "delivery_city_flag": "null",
              "is_adv": "boolean",
              "similar_api": "string(url)",
              "media_search": "string(url)",
              "card_type": "string",
              "estimated_sell": "string(empty)",
              "media_urls": {
                "anyOf": [
                  [
                    {
                      "type": "string",
                      "url": "string(url)"
                    },
                    "×2"
                  ],
                  [
                    {
                      "type": "string",
                      "url": "string(url)"
                    },
                    "×3"
                  ],
                  [
                    {
                      "type": "string",
                      "url": "string(url)"
                    },
                    "×5"
                  ],
                  [
                    {
                      "type": "string",
                      "url": "string(url)"
                    },
                    "×7"
                  ],
                  [
                    {
                      "type": "string",
                      "url": "string(url)"
                    },
                    "×1"
                  ],
                  [
                    {
                      "type": "string",
                      "url": "string(url)"
                    },
                    "×6"
                  ]
                ]
              },
              "image_url": "string(url)",
              "image_count": "integer",
              "direct_cta": "null",
              "has_nearby_shop": "boolean",
              "has_wiki": "boolean",
              "is_authentic": "redacted"
            },
            "×15"
          ],
          [
            {
              "badges": [],
              "discount_info": [],
              "random_key": "string(uuid)",
              "name1": "string",
              "name1_max_lines": "integer",
              "name2": "string",
              "more_info_url": "string(url)",
              "web_client_absolute_url": "string",
              "price": "i
```

### POST sentry.torob.ir/api/:id/envelope/

Request headers of note: content-type.

Request:

```json
"form or text body (opaque)"
```

Response:

```json
{}
```

## Failed requests

| Method | URL | Reason |
| --- | --- | --- |
| POST | https://region1.analytics.google.com/g/collect?_et=…&_eu=…&_p=…&_s=…&ae=…&cid=…&dl=…&dma=…&dt=…&ecid=…&en=…&epn.percent_scrolled=…&frm=…&gaf=…&gcd=…&gtm=…&npa=…&pscdl=…&rcb=…&sct=…&seg=…&sid=…&sr=…&tag_exp=…&tfd=…&tid=…&uaa=…&uab=…&uafvl=…&uam=…&uamb=…&uap=…&uapv=…&uaw=…&ul=…&up.theme_preference=…&v=… | net::ERR_FAILED |
| POST | https://region1.analytics.google.com/g/collect?_et=…&_eu=…&_p=…&_s=…&ae=…&cid=…&dl=…&dma=…&dt=…&ecid=…&en=…&epn.percent_scrolled=…&frm=…&gaf=…&gcd=…&gtm=…&npa=…&pscdl=…&rcb=…&sct=…&seg=…&sid=…&sr=…&tag_exp=…&tfd=…&tid=…&uaa=…&uab=…&uafvl=…&uam=…&uamb=…&uap=…&uapv=…&uaw=…&ul=…&up.theme_preference=…&v=… | net::ERR_FAILED |

## Console errors and warnings

- [mobile] warning: Service Worker registration blocked by Playwright
- [mobile] error: Failed to load resource: net::ERR_FAILED
- [desktop] warning: Service Worker registration blocked by Playwright
- [desktop] error: Failed to load resource: the server responded with a status of 504 ()
- [desktop] error: Failed to load resource: net::ERR_FAILED
