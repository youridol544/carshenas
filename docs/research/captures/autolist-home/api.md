# Network and API map: https://www.autolist.com/

Captured 2026-09-30T07:46:05.942Z. Redacted by construction: no cookie, header, query or body values; JSON is reduced to key names, types and SCREAMING_CASE enum constants.

184 requests to 43 hosts.

| Type | Requests | Transferred |
| --- | --- | --- |
| fetch | 59 | 606 KB |
| script | 56 | 4818 KB |
| image | 46 | 945 KB |
| other | 6 | 22 KB |
| document | 5 | 9 KB |
| ping | 5 | 0 KB |
| font | 4 | 47 KB |
| xhr | 2 | 14 KB |
| stylesheet | 1 | 20 KB |

## Hosts

| Host | Party | Requests | Types |
| --- | --- | --- | --- |
| www.autolist.com | first | 38 | document, image, fetch |
| web-assets-production.autolist.com | first | 26 | stylesheet, font, script, other |
| pagead2.googlesyndication.com | third | 26 | fetch, script |
| www.googleadservices.com | third | 10 | document, script, fetch |
| maps.googleapis.com | third | 8 | script, xhr |
| www.google.com | third | 6 | fetch, image |
| tpsc-ew1.doubleverify.com | third | 6 | fetch, ping |
| www.googletagmanager.com | third | 4 | script |
| cm.g.doubleclick.net | third | 4 | fetch |
| securepubads.g.doubleclick.net | third | 3 | script, other |
| www.google.co.uk | third | 3 | image |
| ep2.adtrafficquality.google | third | 3 | script, document, image |
| sentry.io | third | 2 | fetch |
| cognito-identity.us-east-1.amazonaws.com | third | 2 | fetch |
| region1.analytics.google.com | third | 2 | fetch |
| connect.facebook.net | third | 2 | script |
| ep1.adtrafficquality.google | third | 2 | xhr, image |
| googleads.g.doubleclick.net | third | 2 | script |
| us.creativecdn.com | third | 2 | fetch |
| events-prod.autolist.com | first | 2 | fetch |
| tpc.googlesyndication.com | third | 2 | image |
| pub.dv.tech | third | 2 | script |
| rp.liadm.com | third | 2 | fetch |
| ib.adnxs.com | third | 2 | image |
| cdn.dv.tech | third | 2 | script |
| tps.doubleverify.com | third | 2 | script |
| www.googletagservices.com | third | 2 | fetch |
| tps-dn-ew1.doubleverify.com | third | 2 | fetch |
| cdnjs.cloudflare.com | third | 1 | script |
| production-assets2.autolist.com | first | 1 | other |
| accounts.google.com | third | 1 | script |
| tags.creativecdn.com | third | 1 | script |
| ads.pubmatic.com | third | 1 | script |
| stats.g.doubleclick.net | third | 1 | ping |
| ad.doubleclick.net | third | 1 | fetch |
| ut.pubmatic.com | third | 1 | fetch |
| 122354287f498a4cf8be373d517bc210.safeframe.googlesyndication.com | third | 1 | document |
| launchpad-wrapper.privacymanager.io | third | 1 | script |
| mpc2-prod-25-is5qnl632q-wl.a.run.app | third | 1 | fetch |
| www.facebook.com | third | 1 | image |

## Endpoints

| Method | Host | Path pattern | GraphQL | Calls | Status | Query names |
| --- | --- | --- | --- | --- | --- | --- |
| GET | www.autolist.com | `/api/lookup/makes` |  | 2 | 200 |  |
| GET | www.autolist.com | `/api/maxmindgeolocation` |  | 2 | 200 |  |
| POST | events-prod.autolist.com | `/` |  | 2 | 200 |  |
| GET | pagead2.googlesyndication.com | `/pagead/gen_204` |  | 12 | 204 | id, name, proto, type |
| POST | www.googleadservices.com | `/.well-known/private-aggregation/report-shared-storage` |  | 6 | 200 |  |
| GET | pagead2.googlesyndication.com | `/pcs/view` |  | 4 | 200 | adurl, dett, igpp, sig, uach_m, vt, xai |
| GET | cm.g.doubleclick.net | `/pixel` |  | 4 | 302 | google_hm, google_nid, google_redir, google_tc, google_ula |
| POST | sentry.io | `/api/:id/envelope/` |  | 2 | 200 | sentry_client, sentry_key, sentry_version |
| POST | cognito-identity.us-east-1.amazonaws.com | `/` |  | 2 | 200 |  |
| POST | region1.analytics.google.com | `/g/collect` |  | 2 | 204 | _eu, _fv, _gaz, _nsi, _p, _s, _ss, are, cid, dl, dma, dt, en, ep.event_action, ep.event_category, ep.hit_type, frm, gcd, gtm, ibt, ngs, npa, pscdl, rcb, sct, seg, sid, sr, tag_exp, tfd, tid, uaa, uab, uafvl, uam, uamb, uap, uapv, uaw, ul, v |
| POST | www.google.com | `/ccm/collect` |  | 2 | 200 | apvc, auid, dl, dma, dt, en, ep.dynx_pagetype, fmt, frm, gcd, gtm, navt, npa, rcb, rnd, scrsrc, tag_exp, tfd, tft, tid, tids |
| POST | www.google.com | `/rmkt/collect/:id/` |  | 2 | 200 | async, auid, bg, cv, data, dma, en, ept, fmt, frm, fst, gcd, gcp, gtm, guid, hn, npa, pscdl, random, rcb, tag_exp, tiba, u_h, u_w, uaa, uab, uafvl, uam, uamb, uap, uapv, uaw, url |
| GET | pagead2.googlesyndication.com | `/gampad/ads` |  | 2 | 200 | abxe, adfs, adks, adxs, adys, bc, bih, biw, btvi, correlator, cust_params, dids, dlt, dmc, dt, eid, enc_prev_ius, eoidce, frm, fws, gdfp_req, idt, ifi, impl, iu_parts, lmt, msz, nvt, ohw, oid, output, pgls, prev_iu_szs, prev_scp, psz, ptt, pvsid, sc, scr_x, scr_y, sfv, u_ah, u_aw, u_cd, u_h, u_his, u_sd, u_tz, u_w, uach, uas, ucis, url, vis, vrg |
| POST | us.creativecdn.com | `/tags/v2` |  | 2 | 307,200 | tc, type |
| GET | rp.liadm.com | `/j` |  | 2 | 302,200 | cd, did, dtstmp, duid, n3pc, pu, se, tv, wpn |
| GET | www.googletagservices.com | `/agrp/prod/:token` |  | 2 | 200 |  |
| GET | tps-dn-ew1.doubleverify.com | `/event.jpg` |  | 2 | 204 | api, consid, impid, rc |
| GET | tpsc-ew1.doubleverify.com | `/event.png` |  | 2 | 204 | dvpx_gfbc, flavor, gdpr, gdpr_consent, google_error, impid |
| GET | maps.googleapis.com | `/maps/api/mapsjs/gen_204` |  | 1 | 200 | csp_test |
| POST | ad.doubleclick.net | `/ccm/s/collect` |  | 1 | 204 | auid, fmt, gtm |
| GET | ep1.adtrafficquality.google | `/getconfig/sodar` |  | 1 | 200 | sjk, st, sv, tid, tv |
| GET | ut.pubmatic.com | `/geo` |  | 1 | 200 | pubid |
| POST | pagead2.googlesyndication.com | `/pagead/ping` |  | 1 | 204 | e |
| POST | mpc2-prod-25-is5qnl632q-wl.a.run.app | `/events` |  | 1 | 200 | cee |
| GET | geo.privacymanager.io | `/` |  | 1 | 200 |  |

## Shapes

### GET www.autolist.com/api/lookup/makes

Request headers of note: none.

Response:

```json
[
  {
    "id": "integer",
    "name": {
      "anyOf": [
        "string",
        "enum(BMW)"
      ]
    },
    "isPopular": "boolean",
    "models": {
      "anyOf": [
        [
          {
            "id": "integer",
            "name": "string",
            "isPopular": "boolean",
            "hasAnalysis": {
              "anyOf": [
                "boolean",
                "null"
              ]
            },
            "url": {
              "anyOf": [
                "string",
                "null"
              ]
            }
          },
          "×2"
        ],
        [
          {
            "id": "integer",
            "name": "string",
            "isPopular": "boolean",
            "hasAnalysis": "boolean",
            "url": "string"
          },
          "×4"
        ],
        [
          {
            "id": "integer",
            "name": "string",
            "isPopular": "boolean",
            "hasAnalysis": "boolean",
            "url": "string"
          },
          "×2"
        ],
        [
          {
            "id": "integer",
            "name": "string(numeric)",
            "isPopular": "boolean",
            "hasAnalysis": {
              "anyOf": [
                "boolean",
                "null"
              ]
            },
            "url": {
              "anyOf": [
                "string",
                "null"
              ]
            }
          },
          "×4"
        ],
        [
          {
            "id": "integer",
            "name": {
              "anyOf": [
                "enum(ADX | ILX | MDX | NSX | RDX | RLX | RSX | SLX)",
                "string"
              ]
            },
            "isPopular": "boolean",
            "hasAnalysis": {
              "anyOf": [
                "null",
                "boolean"
              ]
            },
            "url": "string"
          },
          "×18"
        ],
        [
          {
            "id": "integer",
            "name": {
              "anyOf": [
                "string(numeric)",
                "string"
              ]
            },
            "isPopular": "boolean",
            "hasAnalysis": {
              "anyOf": [
                "boolean",
                "null"
              ]
            },
            "url": {
              "anyOf": [
                "string",
                "null"
              ]
            }
          },
          "×10"
        ]
      ]
    }
  },
  "×69"
]
```

### GET www.autolist.com/api/maxmindgeolocation

Request headers of note: none.

Response:

```json
{
  "continent": {
    "code": "string",
    "geonameId": "integer",
    "names": {
      "zh-CN": "string",
      "de": "string",
      "en": "string",
      "es": "string",
      "fr": "string",
      "ja": "string",
      "pt-BR": "string",
      "ru": "string"
    }
  },
  "country": {
    "isoCode": "string",
    "geonameId": "integer",
    "names": {
      "fr": "string",
      "ja": "string",
      "pt-BR": "string",
      "ru": "string",
      "zh-CN": "string",
      "de": "string",
      "en": "string",
      "es": "string"
    }
  },
  "maxmind": {
    "queriesRemaining": "integer"
  },
  "registeredCountry": {
    "isoCode": "string",
    "geonameId": "integer",
    "names": {
      "fr": "string",
      "ja": "string",
      "pt-BR": "enum(EUA)",
      "ru": "string",
      "zh-CN": "string",
      "de": "enum(USA)",
      "en": "string",
      "es": "string"
    },
    "isInEuropeanUnion": "boolean"
  },
  "traits": {
    "autonomousSystemNumber": "integer",
    "autonomousSystemOrganization": "string",
    "connectionType": "string",
    "domain": "string",
    "isp": "string",
    "organization": "string",
    "ipAddress": "string",
    "network": "string",
    "isAnonymous": "boolean",
    "isAnonymousProxy": "boolean",
    "isAnonymousVpn": "boolean",
    "isAnycast": "boolean",
    "isHostingProvider": "boolean",
    "isLegitimateProxy": "boolean",
    "isPublicProxy": "boolean",
    "isResidentialProxy": "boolean",
    "isSatelliteProvider": "boolean",
    "isTorExitNode": "boolean"
  },
  "city": {
    "geonameId": "integer",
    "names": {
      "es": "string",
      "fr": "string",
      "ja": "string",
      "pt-BR": "string",
      "ru": "string",
      "de": "string",
      "en": "string"
    }
  },
  "location": {
    "accuracyRadius": "integer",
    "latitude": "number",
    "longitude": "number",
    "timeZone": "string"
  },
  "postal": {
    "code": "string"
  },
  "subdivisions": [
    {
      "isoCode": "enum(ENG | LND)",
      "geonameId": "integer",
      "names": {
        "ru": "string",
        "en": "string",
        "fr": "string",
        "zh-CN?": "string",
        "de?": "string",
        "es?": "string",
        "ja?": "string",
        "pt-BR?": "string"
      }
    },
    "×2"
  ]
}
```

### POST events-prod.autolist.com/

Request headers of note: authorization, content-type, «redacted», x-amz-date, x-amz-security-token, x-amz-target, x-amz-user-agent.

Request:

```json
{
  "Data": "string",
  "PartitionKey": "string(uuid)",
  "StreamName": "string"
}
```

Response:

```json
{
  "SequenceNumber": "string(numeric)",
  "ShardId": "string"
}
```

### POST www.googleadservices.com/.well-known/private-aggregation/report-shared-storage

Request headers of note: content-type.

Request:

```json
{
  "shared_info": "string",
  "aggregation_service_payloads": [
    {
      "payload": "string(numeric)",
      "key_id": "string(numeric)",
      "debug_cleartext_payload": "string"
    },
    "×1"
  ],
  "context_id": "string",
  "aggregation_coordinator_origin": "string(url)",
  "debug_key": "string(numeric)"
}
```

### POST sentry.io/api/:id/envelope/

Request headers of note: content-type.

Request:

```json
"form or text body (opaque)"
```

Response:

```json
{}
```

### POST cognito-identity.us-east-1.amazonaws.com/

Request headers of note: content-type, x-amz-target, x-amz-user-agent.

Request:

```json
{
  "IdentityPoolId": "string",
  "AccountId": "string(numeric)"
}
```

Response:

```json
{
  "IdentityId": "string"
}
```

### POST region1.analytics.google.com/g/collect

Request headers of note: content-type.

Request:

```json
"form or text body (en, ep.content_group_4, _et, ep.dimension2, ep.content_group_4, _et, ep.dimension2, ep.content_group_4, _et, ep.dimension2, ep.dimension3, ep.content_group_4, ep.page, ep.content_group, _et, ep.dimension2, ep.dimension3, ep.content_group_4, _et, ep.dimension2)"
```

### POST us.creativecdn.com/tags/v2

Request headers of note: content-type.

Request:

```json
{
  "v": "string",
  "sr": "string(empty)",
  "su": "string(url)",
  "th": "string",
  "tags": [
    {
      "eventType": "string",
      "id?": {
        "anyOf": [
          "string(uuid)",
          "string"
        ]
      },
      "expiryDate?": "string(datetime)"
    },
    "×4"
  ]
}
```

Response:

```json
[
  {
    "url": "string(url)",
    "type": "enum(IMG)"
  },
  "×2"
]
```

### GET rp.liadm.com/j

Request headers of note: content-type.

Response:

```json
{
  "bakers": []
}
```

### GET www.googletagservices.com/agrp/prod/:token

Request headers of note: none.

Response:

```json
{
  "b": {
    "d": {
      "a": "boolean",
      "b": [
        {
          "a": "integer",
          "d?": [
            {
              "a": "integer",
              "b?": "integer",
              "c?": "integer",
              "d?": [
                "object(…)",
                "×1"
              ]
            },
            "×2"
          ],
          "b?": "integer",
          "c?": "integer"
        },
        "×3"
      ],
      "c": [
        {
          "b": "boolean",
          "e": "integer",
          "f": "integer",
          "g": "integer",
          "h": "integer",
          "i": "integer",
          "c?": {
            "anyOf": [
              "number",
              "integer"
            ]
          },
          "d?": {
            "anyOf": [
              "number",
              "integer"
            ]
          }
        },
        "×3"
      ]
    },
    "g": {
      "e": {
        "c": {
          "d": "string",
          "a": "boolean",
          "c": {
            "d": {
              "j": "string",
              "l": "string",
              "k": "string"
            }
          }
        }
      },
      "g": {
        "c": {
          "d": "string",
          "e": {
            "b": "boolean",
            "l": "boolean",
            "w": "boolean",
            "v": "boolean"
          },
          "a": "boolean",
          "b": [
            {
              "a": "object(…)",
              "d": "object(…)"
            },
            "×48"
          ]
        },
        "g": {
          "c": {
            "d": "string",
            "e": {
              "b": "boolean",
              "l": "boolean",
              "e": "boolean"
            },
            "a": "boolean",
            "b": [
              "object(…)",
              "×40"
            ]
          },
          "g": {
            "c": {
              "d": "string",
              "e": "object(…)",
              "a": "boolean",
              "c": "object(…)"
            },
            "g": {
              "d": "object(…)",
              "g": "object(…)"
            }
          }
        }
      }
    }
  },
  "a": "integer",
  "c": "string"
}
```

### GET maps.googleapis.com/maps/api/mapsjs/gen_204

Request headers of note: none.

Response:

```json
{}
```

### GET ep1.adtrafficquality.google/getconfig/sodar

Request headers of note: none.

Response:

```json
{
  "sodar_query_id": "string",
  "injector_basename": "string",
  "bg_hash_basename": "string",
  "bg_binary": "string",
  "rc_enable": "string",
  "bg_snapshot_delay_ms": "string(numeric)",
  "is_gen_204": "string(numeric)"
}
```

### GET ut.pubmatic.com/geo

Request headers of note: content-type.

Response:

```json
{
  "cc": "string",
  "sc": "string",
  "gc": "integer"
}
```

### POST pagead2.googlesyndication.com/pagead/ping

Request headers of note: content-type.

Request:

```json
[
  {
    "anyOf": [
      [],
      [
        {
          "anyOf": [
            "integer",
            "string",
            [
              "integer",
              "×2"
            ]
          ]
        },
        "×3"
      ],
      [
        [
          {
            "1": [
              {
                "anyOf": [
                  "string",
                  "null",
                  [
                    {
                      "anyOf": [
                        "null",
                        "integer"
                      ]
                    },
                    "×2"
                  ],
                  [
                    [
                      {
                        "anyOf": [
                          "null",
                          "integer"
                        ]
                      },
                      "×2"
                    ],
                    "×1"
                  ]
                ]
              },
              "×4"
            ]
          },
          "×1"
        ],
        "×1"
      ]
    ]
  },
  "×3"
]
```

### POST mpc2-prod-25-is5qnl632q-wl.a.run.app/events

Request headers of note: content-type.

Request:

```json
{
  "event_name": "string",
  "smart_setup": {
    "auto_web_details_data": "string",
    "is_auto_web_details": "boolean"
  },
  "event_id": "string",
  "fb.pixel_id": "string(numeric)",
  "website_context": {
    "location": "string(url)",
    "referrer": "string(empty)",
    "isInIFrame": "boolean"
  },
  "fb.fbp": "string"
}
```

### GET geo.privacymanager.io/

Request headers of note: accept, content-type.

Response:

```json
{
  "country": "string",
  "region": "enum(ENG)"
}
```

## Failed requests

| Method | URL | Reason |
| --- | --- | --- |
| GET | https://d3j1weegxvu8ns.cloudfront.net/2.11.0/t.js | net::ERR_NAME_NOT_RESOLVED |

## Console errors and warnings

- [desktop] warning: /!\ You are using legacy implementation. Please update your code: use createWrapper() and wrapper.useWrappedStore().
- [desktop] error: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
- [desktop] warning: [GPT] PubAdsService.clearTargeting is deprecated, use googletag.setConfig({targeting: ...}) instead.
https://goo.gle/gpt-message#170
- [desktop] warning: The following functions are deprecated: googletag.pubads().setTagForChildDirectedTreatment(), googletag.pubads().clearTagForChildDirectedTreatment(), googletag.pubads().setRequestNonPersonalizedAds(), and googletag.pubads().setTagForUnderAg
- [desktop] warning: [GPT] Slot.setTargeting is deprecated, use Slot.setConfig({targeting: ...}) instead.
https://goo.gle/gpt-message#171
- [desktop] warning: [GPT] This ad request is subject to Google's EU User Consent Policy. An IAB TCF signal was not received. This ad request will not be eligible for personalized ads.
https://goo.gle/gpt-message#175
- [desktop] warning: [GPT] This ad request is subject to Google's EU User Consent Policy. An IAB TCF signal was not received. This ad request will not be eligible for personalized ads.
https://goo.gle/gpt-message#175
- [desktop] warning: [GPT] This ad request is subject to Google's EU User Consent Policy. An IAB TCF signal was not received. This ad request will not be eligible for personalized ads.
https://goo.gle/gpt-message#175
- [desktop] warning: [Meta Pixel] - Duplicate Pixel ID: 407385466095156.
- [desktop] error: Attestation check for Shared Storage on https://www.googleadservices.com failed.
- [desktop] error: Attestation check for Shared Storage on https://www.googleadservices.com failed.
