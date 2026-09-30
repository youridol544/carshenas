# Network and API map: https://www.jabama.com/

Captured 2026-09-30T07:56:02.135Z. Redacted by construction: no cookie, header, query or body values; JSON is reduced to key names, types and SCREAMING_CASE enum constants.

411 requests to 12 hosts.

| Type | Requests | Transferred |
| --- | --- | --- |
| image | 224 | 8587 KB |
| script | 94 | 5814 KB |
| fetch | 55 | 2141 KB |
| stylesheet | 16 | 656 KB |
| document | 6 | 3 KB |
| xhr | 6 | 0 KB |
| ping | 6 | 0 KB |
| font | 4 | 510 KB |

## Hosts

| Host | Party | Requests | Types |
| --- | --- | --- | --- |
| cdn.jabama.com | first | 315 | stylesheet, font, image, script |
| tracker.jabama.com | first | 42 | fetch |
| www.jabama.com | first | 24 | document, image, fetch |
| sentry.jabama.com | first | 6 | fetch |
| ua.yektanet.com | third | 6 | ping |
| cdn.yektanet.com | third | 4 | script, document |
| rt.adexo.ir | third | 4 | document, xhr |
| gw.jabama.com | first | 3 | fetch |
| panel.adexo.ir | third | 2 | script |
| audience.yektanet.com | third | 2 | xhr |
| event.yektanet.com | third | 2 | xhr |
| trustseal.enamad.ir | third | 1 | image |

## Endpoints

| Method | Host | Path pattern | GraphQL | Calls | Status | Query names |
| --- | --- | --- | --- | --- | --- | --- |
| POST | tracker.jabama.com | `/com.snowplowanalytics.snowplow/tp2` |  | 42 | 200 |  |
| POST | sentry.jabama.com | `/api/:id/envelope/` |  | 6 | 200 | sentry_client, sentry_key, sentry_version |
| GET | www.jabama.com | `/app` |  | 2 | 200 | _rsc |
| GET | www.jabama.com | `/` |  | 2 | 200 | _rsc |
| GET | gw.jabama.com | `/experiments` |  | 2 | 200 |  |
| POST | gw.jabama.com | `/api/v3/keyword/homepage_v2` |  | 1 | 200 | categorize, optimize, platform, web |
| GET | audience.yektanet.com | `/api/v1/scripts/preview/validate/` |  | 2 | 200 | app_id |
| GET | event.yektanet.com | `/api/get-uid` |  | 2 | 200 |  |
| GET | rt.adexo.ir | `/retargeting/push` |  | 2 | 200 | feed, os, p, tag, uid, url |

## Shapes

### POST tracker.jabama.com/com.snowplowanalytics.snowplow/tp2

Request headers of note: accept, content-type.

Request:

```json
{
  "schema": "string",
  "data": [
    {
      "e": "string",
      "url": "string(url)",
      "page": "string",
      "eid": "string(uuid)",
      "tv": "string",
      "tna": "string",
      "aid": "string",
      "p": "string",
      "cookie": "redacted",
      "cs": "string",
      "lang": "string",
      "res": "string",
      "cd": "string(numeric)",
      "tz": "string",
      "dtm": "string(numeric)",
      "co": "string",
      "vp": "string",
      "ds": "string",
      "vid": "string(numeric)",
      "sid": "string(uuid)",
      "duid": "string(uuid)",
      "stm": "string(numeric)"
    },
    "×1"
  ]
}
```

### POST sentry.jabama.com/api/:id/envelope/

Request headers of note: content-type.

Request:

```json
"form or text body (opaque)"
```

Response:

```json
{}
```

### POST gw.jabama.com/api/v3/keyword/homepage_v2

Request headers of note: authorization, content-type, x-server-side, x-unify, x-user-experiments, x-web.

Request:

```json
{}
```

Response:

```json
{
  "result": {
    "ihpMetadata": {
      "lifetime": {
        "indefinite": "boolean"
      },
      "seo": {
        "keywords": [
          "string(empty)",
          "×1"
        ],
        "description": "string"
      },
      "isCityListing": "boolean",
      "showInSearch": "boolean",
      "showSearchOutsideHeader": "boolean",
      "_id": "string",
      "template": "string",
      "templateDesktop": "string",
      "title": "string",
      "pageTitle": "string",
      "description": "string",
      "url": "string",
      "status": "string",
      "createdAt": "string(datetime)",
      "__v": "integer"
    },
    "template": {
      "platform": "string",
      "rows": [
        {
          "name": "string",
          "columns": {
            "anyOf": [
              [
                {
                  "name": "string",
                  "components": [
                    "object(…)",
                    "×1"
                  ],
                  "classes": "null",
                  "style": "null"
                },
                "×1"
              ],
              [
                {
                  "name": "string",
                  "components": [
                    "object(…)",
                    "×1"
                  ]
                },
                "×1"
              ]
            ]
          },
          "classes?": "null",
          "style?": "null"
        },
        "×18"
      ],
      "_id": "string",
      "name": "string",
      "__v": "integer"
    },
    "resultType": "string",
    "countDefault": "integer",
    "cached": "boolean",
    "seo": {
      "title": "string",
      "description": "string",
      "alternates": {
        "canonical": "string(url)"
      },
      "twitter": {
        "card": "string",
        "title": "string",
        "description": "string",
        "url": "string(url)",
        "cover": "string(url)",
        "image": {
          "url": "string(url)",
          "alt": "string"
        }
      },
      "openGraph": {
        "title": "string",
        "description": "string",
        "url": "string(url)",
        "locale": "string",
        "type": "string",
        "site_name": "string",
        "cover": "string(url)",
        "images": [
          {
            "alt": "string",
            "url?": "string(url)",
            "width?": "string(numeric)",
            "height?": "string(numeric)",
            "secure_url?": "string(url)"
          },
          "×2"
        ]
      },
      "markup_schema": [
        {
          "@context": "string(url)",
          "@type": "string",
          "name": "string",
          "alternateName": "string",
          "description": "string",
          "legalName": "string",
          "email": "string(email)",
          "image": "string(url)",
          "logo": "string(url)",
          "url": "string(url)",
          "sameAs": [
            "string(url)",
            "×7"
          ],
          "contactPoint": [
            {
              "@type": "string",
              "email": "string(email)",
              "telephone": "string",
              "contactType": "string"
            },
            "×1"
          ]
        },
        "×1"
      ]
    }
  },
  "error": "null",
  "unauthorizedRequest": "redacted",
  "__wrapped": "boolean",
  "__traceId": "string(uuid)",
  "success": "boolean"
}
```

### GET audience.yektanet.com/api/v1/scripts/preview/validate/

Request headers of note: none.

Response:

```json
"boolean"
```

### GET event.yektanet.com/api/get-uid

Request headers of note: none.

Response:

```json
{
  "uid": "string"
}
```

## Console errors and warnings

- [mobile] warning: Experiments are empty. Retrying in 0ms (Retry 1/3).
- [mobile] warning: Experiments are empty. Retrying in 1000ms (Retry 2/3).
- [mobile] warning: Experiments are empty. Retrying in 0ms (Retry 1/3).
- [mobile] warning: Experiments are empty. Retrying in 0ms (Retry 1/3).
- [mobile] warning: Experiments are empty. Retrying in 0ms (Retry 1/3).
- [mobile] warning: Experiments are empty. Retrying in 1000ms (Retry 2/3).
- [mobile] warning: Experiments are empty. Retrying in 1000ms (Retry 2/3).
- [mobile] warning: Experiments are empty. Retrying in 1000ms (Retry 2/3).
- [mobile] error: requestStorageAccess: Permission denied.
- [desktop] warning: Experiments are empty. Retrying in 0ms (Retry 1/3).
- [desktop] warning: Experiments are empty. Retrying in 1000ms (Retry 2/3).
- [desktop] warning: Experiments are empty. Retrying in 0ms (Retry 1/3).
- [desktop] warning: Experiments are empty. Retrying in 1000ms (Retry 2/3).
- [desktop] error: requestStorageAccess: Permission denied.
