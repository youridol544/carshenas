# Network and API map: https://virgool.io/login

Captured 2026-09-29T14:15:51.895Z. Redacted by construction: no cookie, header, query or body values; JSON is reduced to key names, types and SCREAMING_CASE enum constants.

78 requests to 5 hosts.

| Type | Requests | Transferred |
| --- | --- | --- |
| script | 60 | 3587 KB |
| stylesheet | 4 | 116 KB |
| font | 4 | 169 KB |
| xhr | 4 | 0 KB |
| document | 2 | 0 KB |
| image | 2 | 0 KB |
| fetch | 2 | 0 KB |

## Hosts

| Host | Party | Requests | Types |
| --- | --- | --- | --- |
| static.virgool.io | first | 62 | stylesheet, image, script, font |
| virgool.io | first | 10 | document, script, xhr |
| static.cloudflareinsights.com | third | 2 | script |
| www.googletagmanager.com | third | 2 | script |
| region1.google-analytics.com | third | 2 | fetch |

## Endpoints

| Method | Host | Path pattern | GraphQL | Calls | Status | Query names |
| --- | --- | --- | --- | --- | --- | --- |
| POST | virgool.io | `/cdn-cgi/rum` |  | 2 | 204 |  |
| POST | virgool.io | `/cdn-cgi/challenge-platform/h/b/jsd/oneshot/:hex/:token/:hex` |  | 2 | 200 |  |
| POST | region1.google-analytics.com | `/g/collect` |  | 2 | 204 | _ee, _eu, _fv, _nsi, _p, _s, _ss, cid, dl, dma, dt, en, frm, gcd, gtm, npa, pscdl, rcb, sct, seg, sid, sr, tag_exp, tfd, tid, uaa, uab, uafvl, uam, uamb, uap, uapv, uaw, ul, v |

## Shapes

### POST virgool.io/cdn-cgi/rum

Request headers of note: content-type.

Request:

```json
{
  "startTime": "integer",
  "pageloadId": "string(uuid)",
  "eventType": "integer",
  "nt": "string",
  "location": "string(url)",
  "versions": {
    "fl": "string",
    "js": "string",
    "timings": "integer"
  },
  "bi": {
    "be": "string",
    "bev": "string(numeric)",
    "bv": "string(numeric)",
    "ov": "string(numeric)"
  },
  "memory": {
    "totalJSHeapSize": "integer",
    "usedJSHeapSize": "integer",
    "jsHeapSizeLimit": "integer"
  },
  "firstPaint": "integer",
  "firstContentfulPaint": "integer",
  "timingsV2": {
    "nextHopProtocol": "string",
    "domainLookupStart": "integer",
    "domainLookupEnd": "integer",
    "connectStart": "integer",
    "connectEnd": "integer",
    "secureConnectionStart": "integer",
    "requestStart": "integer",
    "responseStart": "integer",
    "responseEnd": "integer",
    "domInteractive": "integer",
    "domComplete": "integer",
    "loadEventStart": "integer",
    "loadEventEnd": "integer",
    "finalResponseHeadersStart": "integer",
    "firstInterimResponseStart": "integer",
    "transferSize": "integer",
    "decodedBodySize": "integer"
  },
  "siteToken": "redacted",
  "st": "integer"
}
```

### POST virgool.io/cdn-cgi/challenge-platform/h/b/jsd/oneshot/:hex/:token/:hex

Request headers of note: content-type.

Request:

```json
"form or text body (opaque)"
```
