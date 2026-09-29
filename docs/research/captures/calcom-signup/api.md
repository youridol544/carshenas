# Network and API map: https://app.cal.com/signup

Captured 2026-09-29T14:12:21.502Z. Redacted by construction: no cookie, header, query or body values; JSON is reduced to key names, types and SCREAMING_CASE enum constants.

246 requests to 24 hosts.

| Type | Requests | Transferred |
| --- | --- | --- |
| script | 122 | 6425 KB |
| fetch | 55 | 800 KB |
| image | 47 | 8 KB |
| stylesheet | 6 | 1064 KB |
| document | 4 | 0 KB |
| font | 4 | 610 KB |
| ping | 4 | 0 KB |
| xhr | 4 | 1752 KB |

## Hosts

| Host | Party | Requests | Types |
| --- | --- | --- | --- |
| app.cal.com | first | 137 | document, stylesheet, script, font, image, fetch |
| challenges.cloudflare.com | third | 14 | script, document, xhr, fetch, image |
| www.google.com | third | 12 | fetch, image |
| region1.analytics.google.com | third | 10 | fetch |
| px.ads.linkedin.com | third | 8 | fetch, image |
| www.googletagmanager.com | third | 6 | script |
| t.co | third | 6 | image |
| analytics.twitter.com | third | 6 | image |
| www.google.co.uk | third | 6 | image |
| snap.licdn.com | third | 4 | script |
| bzrcdn.openai.com | third | 4 | script, fetch |
| connect.facebook.net | third | 4 | script |
| o574544.ingest.us.sentry.io | third | 4 | fetch |
| googleads.g.doubleclick.net | third | 4 | script |
| bzr.openai.com | third | 3 | fetch |
| www.facebook.com | third | 3 | image, ping |
| www.dubcdn.com | third | 2 | script |
| widget.intercom.io | third | 2 | script |
| ad.doubleclick.net | third | 2 | fetch |
| static.ads-twitter.com | third | 2 | script |
| js.intercomcdn.com | third | 2 | script |
| r2.leadsy.ai | third | 2 | script |
| stats.g.doubleclick.net | third | 2 | ping |
| md-eecad2978f7a43f5b7838c919258e6de.ecs.us-east-2.on.aws | third | 1 | fetch |

## Endpoints

| Method | Host | Path pattern | GraphQL | Calls | Status | Query names |
| --- | --- | --- | --- | --- | --- | --- |
| GET | app.cal.com | `/auth/login` |  | 4 | 200 | _rsc |
| GET | app.cal.com | `/ring.mp3` |  | 3 | 200 |  |
| GET | app.cal.com | `/api/trpc/features/map` |  | 2 | 200 | batch, input |
| GET | app.cal.com | `/api/auth/session` |  | 2 | 200 |  |
| GET | app.cal.com | `/api/trpc/me/get` |  | 2 | 401 | batch, input |
| GET | app.cal.com | `/api/trpc/teams/hasTeamPlan` |  | 2 | 401 | batch, input |
| POST | app.cal.com | `/api/username` |  | 2 | 200 |  |
| POST | region1.analytics.google.com | `/g/collect` |  | 10 | 204 | _et, _eu, _fv, _gaz, _nsi, _p, _s, _ss, ae, cid, dl, dma, dt, ec_mode, ecid, en, ep.first_field_id, ep.first_field_name, ep.form_destination, ep.form_id, epn.first_field_position, epn.form_length, epn.percent_scrolled, frm, gaf, gcd, gtm, npa, pscdl, rcb, sct, seg, sid, sr, tag_exp, tfd, tid, uaa, uab, uafvl, uam, uamb, uap, uapv, uaw, ul, v |
| POST | px.ads.linkedin.com | `/wa/` |  | 6 | 204 | fmt, medium |
| POST | www.google.com | `/ccm/collect` |  | 4 | 200 | ae, apvc, auid, dl, dma, dt, en, ep.ads_data_redaction, fmt, frm, gcd, gtm, navt, npa, rcb, rnd, scrsrc, tag_exp, tfd, tft, tid, tids |
| POST | www.google.com | `/rmkt/collect/:id/` |  | 4 | 200 | ae, async, auid, bg, cv, data, dma, en, ept, fmt, frm, fst, gap.fsrc, gcd, gcp, gtm, guid, hn, npa, pscdl, random, rcb, tag_exp, tiba, u_h, u_w, uaa, uab, uafvl, uam, uamb, uap, uapv, uaw, url |
| POST | o574544.ingest.us.sentry.io | `/api/:id/envelope/` |  | 4 | 200 | sentry_client, sentry_key, sentry_version |
| POST | challenges.cloudflare.com | `/cdn-cgi/challenge-platform/h/b/fo/:token/:hex/:token` |  | 4 | 200 |  |
| POST | bzr.openai.com | `/v1/sdk/events` |  | 3 | 202 | ec, pid, st, sv, t |
| POST | ad.doubleclick.net | `/ccm/s/collect` |  | 2 | 204 | auid, fmt, gtm |
| GET | bzrcdn.openai.com | `/pixel-config/v1/:token` |  | 2 | 200 |  |
| GET | challenges.cloudflare.com | `/cdn-cgi/challenge-platform/h/b/pat/:hex/:id/:hex/:token` |  | 2 | 401 |  |
| POST | md-eecad2978f7a43f5b7838c919258e6de.ecs.us-east-2.on.aws | `/events` |  | 1 | 200 | cee |

## Shapes

### GET app.cal.com/api/trpc/features/map

Request headers of note: none.

Response:

```json
[
  {
    "result": {
      "data": {
        "json": {
          "abuse-scoring": "boolean",
          "account-lockout": "boolean",
          "active-user-billing": "boolean",
          "analytics-script-url-moderation": "boolean",
          "attributes": "boolean",
          "booker-botid": "boolean",
          "booking-audit": "boolean",
          "booking-email-sms-tasker": "boolean",
          "booking-keyset-pagination": "boolean",
          "booking-participant-listing": "boolean",
          "bookings-v3": "boolean",
          "booking-window": "boolean",
          "cal-agent": "boolean",
          "cal-ai-voice-agents": "boolean",
          "calendar-cache": "boolean",
          "calendar-cache-serve": "boolean",
          "calendar-kv-cache": "boolean",
          "calendar-reads-via-adapter": "boolean",
          "calendar-watch": "boolean",
          "calendar-writes-via-adapter": "boolean",
          "cal-video-log-in-overlay": "boolean",
          "chat-push-notifications": "boolean",
          "custom-smtp-for-orgs": "boolean",
          "delegation-credential": "redacted",
          "disable-signup": "boolean",
          "discover": "boolean",
          "domain-wide-delegation": "boolean",
          "dunning-enforcement": "boolean",
          "emails": "boolean",
          "email-smtp-failover": "boolean",
          "email-verification": "boolean",
          "enable-fuzzy-domain-matching": "boolean",
          "google-workspace-directory": "boolean",
          "hwm-seating": "boolean",
          "insights": "boolean",
          "monthly-proration": "boolean",
          "onboarding-v3": "boolean",
          "organizations": "boolean",
          "organizer-request-email-v2": "boolean",
          "otel-elastic-export": "boolean",
          "pbac": "boolean",
          "phishing-gate-enforce": "boolean",
          "recurring-booking-v2": "boolean",
          "restriction-schedule": "boolean",
          "routing-form-ai": "boolean",
          "routing-form-ai-trigger-runtime": "boolean",
          "salesforce-crm-tasker": "boolean",
          "schedule-limits": "boolean",
          "sidebar-tips": "boolean",
          "signup-watchlist-review": "boolean",
          "sink-shortener": "boolean",
          "slot-reservations-read": "boolean",
          "slot-reservation-system-write": "boolean",
          "slug-redirects": "boolean",
          "team-booking-page-cache": "boolean",
          "team-member-booking-limits": "boolean",
          "teams": "boolean",
          "tiered-support-chat": "boolean",
          "use-api-v2-for-team-slots": "boolean",
          "webhooks": "boolean",
          "…": "8 more keys"
        }
      }
    }
  },
  "×1"
]
```

### GET app.cal.com/api/auth/session

Request headers of note: content-type.

Response:

```json
{}
```

### GET app.cal.com/api/trpc/me/get

Request headers of note: none.

Response:

```json
[
  {
    "error": {
      "json": {
        "message": "enum(UNAUTHORIZED)",
        "code": "integer",
        "data": {
          "code": "enum(UNAUTHORIZED)",
          "httpStatus": "integer",
          "path": "string"
        }
      }
    }
  },
  "×1"
]
```

### GET app.cal.com/api/trpc/teams/hasTeamPlan

Request headers of note: none.

Response:

```json
[
  {
    "error": {
      "json": {
        "message": "enum(UNAUTHORIZED)",
        "code": "integer",
        "data": {
          "code": "enum(UNAUTHORIZED)",
          "httpStatus": "integer",
          "path": "string"
        }
      }
    }
  },
  "×1"
]
```

### POST app.cal.com/api/username

Request headers of note: accept, content-type.

Request:

```json
{
  "username": "string"
}
```

Response:

```json
{
  "available": "boolean",
  "premium": "boolean",
  "suggestedUsername": "string(empty)"
}
```

### POST region1.analytics.google.com/g/collect

Request headers of note: accept, content-type.

Request:

```json
"form or text body (en, _et, _et)"
```

### POST px.ads.linkedin.com/wa/

Request headers of note: accept, content-type.

Request:

```json
"form or text body (opaque)"
```

### POST o574544.ingest.us.sentry.io/api/:id/envelope/

Request headers of note: accept, content-type.

Request:

```json
"form or text body (opaque)"
```

Response:

```json
{}
```

### POST challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/fo/:token/:hex/:token

Request headers of note: accept, content-type.

Request:

```json
"form or text body (opaque)"
```

### POST bzr.openai.com/v1/sdk/events

Request headers of note: accept, content-type.

Request:

```json
{
  "obref": "string(uuid)",
  "events": [
    {
      "type": "string",
      "timestamp_ms": "integer",
      "id": "string(uuid)",
      "data": {
        "type": {
          "anyOf": [
            "string(prefixed-id)",
            "string"
          ]
        },
        "schema_version??": "integer",
        "dropped_event_count??": "integer",
        "dropped_event_reason_counts??": {},
        "dropped_event_name_counts??": {},
        "dropped_event_phase_counts??": {},
        "consent??": "boolean",
        "is_first_visit_in_session??": "redacted",
        "is_first_consent_grant_in_session??": "redacted",
        "amount?": "integer",
        "currency?": "enum(USD)"
      },
      "source_url?": "string(url)"
    },
    "×3"
  ]
}
```

### GET bzrcdn.openai.com/pixel-config/v1/:token

Request headers of note: none.

Response:

```json
{
  "automatic_advanced_matching_enabled": "boolean"
}
```

### POST md-eecad2978f7a43f5b7838c919258e6de.ecs.us-east-2.on.aws/events

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

## Failed requests

| Method | URL | Reason |
| --- | --- | --- |
| GET | https://brunhild.challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/i/:hex/:token | net::ERR_NAME_NOT_RESOLVED |
| GET | https://brunhild.challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/i/:hex/:token | net::ERR_NAME_NOT_RESOLVED |

## Console errors and warnings

- [mobile] warning: Error with Permissions-Policy header: Unrecognized feature: 'bluetooth'.
- [mobile] warning: Service Worker registration blocked by Playwright
- [mobile] error: Service Worker registration failed: TypeError: Cannot use 'in' operator to search for 'pushManager' in undefined
    at https://app.cal.com/_next/static/chunks/2tdt6qkhtn5_m.js:1:6860
- [mobile] error: Failed to load resource: the server responded with a status of 401 ()
- [mobile] error: Failed to load resource: the server responded with a status of 401 ()
- [mobile] warning: No available adapters.
- [mobile] warning: [.WebGL-0x370402ba3c00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
- [mobile] warning: [.WebGL-0x370402ba3c00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
- [mobile] warning: OTS parsing error: Size of decompressed WOFF 2.0 is less than compressed size
- [mobile] error: %c%d font-size:0;color:transparent NaN
- [mobile] error: %c%d font-size:0;color:transparent NaN
- [mobile] warning: %c%d font-size:0;color:transparent NaN
- [mobile] warning: %c%d font-size:0;color:transparent NaN
- [desktop] warning: Error with Permissions-Policy header: Unrecognized feature: 'bluetooth'.
- [desktop] warning: Service Worker registration blocked by Playwright
- [desktop] error: Service Worker registration failed: TypeError: Cannot use 'in' operator to search for 'pushManager' in undefined
    at https://app.cal.com/_next/static/chunks/2tdt6qkhtn5_m.js:1:6860
- [desktop] error: Failed to load resource: the server responded with a status of 401 ()
- [desktop] error: Failed to load resource: the server responded with a status of 401 ()
- [desktop] warning: No available adapters.
- [desktop] warning: OTS parsing error: Size of decompressed WOFF 2.0 is less than compressed size
- [desktop] error: %c%d font-size:0;color:transparent NaN
- [desktop] error: %c%d font-size:0;color:transparent NaN
- [desktop] warning: %c%d font-size:0;color:transparent NaN
- [desktop] warning: %c%d font-size:0;color:transparent NaN
- [desktop] warning: [.WebGL-0x370403689600]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
- [desktop] warning: [.WebGL-0x370403689600]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat)
