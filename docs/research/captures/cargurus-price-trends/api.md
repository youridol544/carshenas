# Network and API map: https://www.cargurus.com/research/price-trends

Captured 2026-09-30T07:49:04.111Z. Redacted by construction: no cookie, header, query or body values; JSON is reduced to key names, types and SCREAMING_CASE enum constants.

485 requests to 73 hosts.

| Type | Requests | Transferred |
| --- | --- | --- |
| script | 233 | 12371 KB |
| fetch | 88 | 238 KB |
| image | 59 | 8219 KB |
| stylesheet | 36 | 265 KB |
| ping | 21 | 0 KB |
| xhr | 18 | 29 KB |
| other | 16 | 546 KB |
| font | 8 | 258 KB |
| document | 6 | 102 KB |

## Hosts

| Host | Party | Requests | Types |
| --- | --- | --- | --- |
| static-assets.cargurus.com | first | 174 | stylesheet, image, font, script |
| cdn.cookielaw.org | third | 24 | other, script, stylesheet, fetch, image |
| www.cargurus.com | first | 18 | document, stylesheet, script, fetch |
| images.ctfassets.net | third | 16 | image |
| analytics.tiktok.com | third | 16 | script, ping |
| c.amazon-adsystem.com | third | 12 | script, fetch, xhr |
| lpcdn.lpsnmedia.net | third | 10 | script, document |
| static1.cargurus.com | first | 8 | image |
| accounts.google.com | third | 8 | script, stylesheet, other |
| spm.cargurus.com | first | 8 | xhr, ping |
| lo.v.liveperson.net | third | 8 | script |
| pub.doubleverify.com | third | 7 | script, fetch |
| www.googletagmanager.com | third | 6 | script |
| region1.analytics.google.com | third | 6 | fetch |
| bat.bing.com | third | 6 | script, image |
| sb.scorecardresearch.com | third | 6 | script, image |
| surveys-static-prd.survicate-cdn.com | third | 6 | stylesheet, script, fetch |
| securepubads.g.doubleclick.net | third | 6 | script, other |
| aax-eu.amazon-adsystem.com | third | 6 | fetch, document |
| accdn.lpsnmedia.net | third | 6 | fetch |
| trc-events.taboola.com | third | 6 | xhr |
| connect.facebook.net | third | 4 | script |
| bzrcdn.openai.com | third | 4 | script, fetch |
| c.pmsrv.co | third | 4 | script, image |
| lptag.liveperson.net | third | 4 | script |
| us.creativecdn.com | third | 4 | fetch |
| idx.liadm.com | third | 4 | fetch |
| id5-sync.com | third | 4 | fetch, xhr |
| o47004.ingest.sentry.io | third | 3 | fetch |
| api-iam.intercom.io | third | 3 | xhr |
| rp.liadm.com | third | 3 | fetch |
| ib.adnxs.com | third | 3 | image |
| widget.intercom.io | third | 2 | script |
| geolocation.onetrust.com | third | 2 | xhr |
| stats.g.doubleclick.net | third | 2 | ping |
| www.google.co.uk | third | 2 | image |
| js.intercomcdn.com | third | 2 | script |
| ad.doubleclick.net | third | 2 | fetch |
| www.google.com | third | 2 | fetch |
| api.ipify.org | third | 2 | script |

## Endpoints

| Method | Host | Path pattern | GraphQL | Calls | Status | Query names |
| --- | --- | --- | --- | --- | --- | --- |
| POST | www.cargurus.com | `/collector/v1/traces` |  | 8 | 200 |  |
| POST | spm.cargurus.com | `/tr/tp2` |  | 3 | 200 |  |
| GET | www.cargurus.com | `/:token/check-detection` |  | 2 | 200 |  |
| POST | www.cargurus.com | `/:token/acd` |  | 2 | 200 |  |
| POST | capi-ata.cargurus.com | `/events/:hex` |  | 1 | 200 |  |
| GET | trc-events.taboola.com | `/:id/log/:id/unip` |  | 6 | 204 | cbcd, cbp, cbpv, cv, en, est, invt, isls, it, item-url, mrir, msa, ref, rv, scd, src, ssd, tim, tos, ver, vi |
| POST | region1.analytics.google.com | `/g/collect` |  | 4 | 204 | _et, _eu, _fv, _gaz, _nsi, _p, _prs, _s, _ss, _tu, cid, dl, dma, dr, dt, en, ep.client_id_2, ep.client_id_3, ep.disable_ad_personalization, ep.disable_tracking, ep.entity_type, ep.geo_type, ep.gtm_settings, ep.gtm_tag_name, ep.is_mobile_app_webview, ep.previous_url, ep.seo_variants, ep.timestamp, ep.user_agent_string, frm, gaf, gcd, gtm, ir, npa, pscdl, rcb, sct, seg, sid, sr, tag_exp, tfd, tid, uaa, uab, uafvl, uam, uamb, uap, uapv, uaw, ul, up.client_id_2, up.client_id_3, upn.timezone_offset, v |
| GET | c.amazon-adsystem.com | `/aat/amzn.js` |  | 4 | 200 |  |
| GET | aax-eu.amazon-adsystem.com | `/s/iu3` |  | 4 | 302,200 | dcc, event, eventSource, pid, ts, uuid |
| POST | us.creativecdn.com | `/tags/v2` |  | 4 | 307,200 | tc, type |
| GET | idx.liadm.com | `/idex/did-008j/any` |  | 4 | 204 | cd, did, duid, pu, resolve |
| POST | o47004.ingest.sentry.io | `/api/:id/envelope/` |  | 3 | 200 | sentry_client, sentry_key, sentry_version |
| GET | rp.liadm.com | `/j` |  | 3 | 200,302 | cd, did, dtstmp, duid, n3pc, pu, se, tv, wpn |
| GET | cdn.cookielaw.org | `/scripttemplates/202604.1.0/assets/v2/otPcCenter.json` |  | 2 | 200 |  |
| GET | cdn.cookielaw.org | `/scripttemplates/202604.1.0/assets/otFlat.json` |  | 2 | 200 |  |
| GET | cdn.cookielaw.org | `/consent/:uuid/:token` |  | 2 | 200 |  |
| GET | cdn.cookielaw.org | `/consent/:uuid/:uuid/en.json` |  | 2 | 200 |  |
| GET | geolocation.onetrust.com | `/cookieconsentpub/v1/geo/location` |  | 2 | 200 |  |
| POST | region1.analytics.google.com | `/measurement/conversion` |  | 2 | 200 | _tu, auid, cv, dma, en, fmt, frm, fst, gacid, gcd, gtm, hn, npa, pscdl, random, rcb, tag_exp, tiba, tid, u_h, u_w, uaa, uab, uafvl, uam, uamb, uap, uapv, uaw, url |
| GET | cdn.cookielaw.org | `/scripttemplates/202604.1.0/assets/otCommonStyles.css` |  | 2 | 200 |  |
| GET | cdn.cookielaw.org | `/logos/static/ot_guard_logo.svg` |  | 2 | 200 |  |
| GET | accounts.google.com | `/gsi/fedcm.json` |  | 2 | 200 |  |
| POST | ad.doubleclick.net | `/ccm/s/collect` |  | 2 | 204 | _gsid, auid, fmt, gtm |
| POST | www.google.com | `/ccm/collect` |  | 2 | 200 | _gsid, apvc, auid, dl, dma, dt, en, ep.user_data_mode, fmt, frm, gcd, gdid, gpp, gpp_sid, gtm, navt, npa, rcb, rnd, scrsrc, tag_exp, tfd, tft, tid, tids |
| GET | google.com | `/.well-known/web-identity` |  | 2 | 200 |  |
| GET | accounts.google.com | `/gsi/fedcm/listaccounts` |  | 2 | 200 |  |
| GET | bzrcdn.openai.com | `/pixel-config/v1/:token` |  | 2 | 200 |  |
| POST | api-iam.intercom.io | `/messenger/web/ping` |  | 2 | 200 |  |
| GET | c.amazon-adsystem.com | `/bao-csm/aps-comm/aps_csm.js` |  | 2 | 200 |  |
| GET | c.amazon-adsystem.com | `/aat/allowlist/allowlist.json` |  | 2 | 200 |  |
| GET | ipv4.podscribe.com | `/` |  | 2 | 200 |  |
| GET | pub.doubleverify.com | `/dvtag/signals/ids/pub.json` |  | 2 | 200 | cmp, ctx, ids, token, url |
| GET | pub.doubleverify.com | `/dvtag/signals/bsc/pub.json` |  | 2 | 200 | abs, bsc, cmp, ctx, token, url |
| POST | bzr.openai.com | `/v1/sdk/events` |  | 2 | 202 | ec, pid, st, sv, t |
| GET | ut.pubmatic.com | `/geo` |  | 2 | 200 | pubid |
| GET | accdn.lpsnmedia.net | `/api/account/:id/configuration/setting/accountproperties` |  | 2 | 200 | __d |
| GET | accdn.lpsnmedia.net | `/api/account/:id/configuration/le-campaigns/zones` |  | 2 | 200 | __d, fields |
| GET | accdn.lpsnmedia.net | `/api/account/:id/configuration/domainprotection/refererrestrictions` |  | 2 | 200 | __d |
| GET | api.id5-sync.com | `/analytics/:id/id5-api-js` |  | 2 | 200 |  |
| POST | pagead2.googlesyndication.com | `/pagead/ping` |  | 2 | 204 | e |
| GET | id5-sync.com | `/bounce` |  | 2 | 200 |  |
| GET | lb.eu-1-id5-sync.com | `/lb/v1` |  | 2 | 200 |  |
| GET | lbs.eu-1-id5-sync.com | `/lbs/v1` |  | 2 | 200 |  |
| POST | id5-sync.com | `/gm/v3` |  | 2 | 200 |  |
| POST | euwe1.idp.liveperson.net | `/api/account/:id/anonymous/authorize` |  | 2 | 200 | __d |
| GET | geo.privacymanager.io | `/` |  | 2 | 200 |  |
| POST | api-iam.intercom.io | `/messenger/web/launcher_settings` |  | 1 | 200 |  |
| GET | surveys-static-prd.survicate-cdn.com | `/data/tldToLanguageMap.json` |  | 1 | 200 |  |
| GET | surveys-static-prd.survicate-cdn.com | `/data/languageCodes.json` |  | 1 | 200 |  |
| GET | pub.doubleverify.com | `/dvtag/signals/vlp/pub.json` |  | 1 | 200 | cmp, ctx, slot-0-19485787/cargurus.com/Research, token, tvp, url, vlp |
| POST | web-banner.ads.aps.amazon-adsystem.com | `/e/dtb/bid` |  | 1 | 200 |  |
| POST | prod.us-east-1.cxm-bcn.publisher-services.amazon.dev | `/v1/recordVendorsLoaded` |  | 1 | 200 |  |

## Shapes

### POST www.cargurus.com/collector/v1/traces

Request headers of note: content-type.

Request:

```json
{
  "resourceSpans": [
    {
      "resource": {
        "attributes": [
          {
            "key": "string",
            "value": {
              "stringValue??????????": "string",
              "arrayValue??????????": "object(…)",
              "boolValue?????????": "boolean",
              "stringValue????????": "string",
              "stringValue???????": "string",
              "stringValue??????": "string",
              "stringValue?????": "string",
              "stringValue????": "string",
              "stringValue???": "string",
              "stringValue??": "string",
              "stringValue?": "string"
            }
          },
          "×110"
        ],
        "droppedAttributesCount": "integer"
      },
      "scopeSpans": [
        {
          "scope": {
            "name": "string",
            "version???": "string",
            "version??": "string",
            "version?": "string"
          },
          "spans": {
            "anyOf": [
              [
                {
                  "traceId": "string",
                  "spanId": "string",
                  "name": "enum(FCP)",
                  "kind": "integer",
                  "startTimeUnixNano": "string(numeric)",
                  "endTimeUnixNano": "string(numeric)",
                  "attributes": [
                    "object(…)",
                    "×22"
                  ],
                  "droppedAttributesCount": "integer",
                  "events": [],
                  "droppedEventsCount": "integer",
                  "status": "object(…)",
                  "links": [],
                  "droppedLinksCount": "integer",
                  "flags": "integer"
                },
                "×1"
              ],
              [
                {
                  "traceId": "string",
                  "spanId": "string",
                  "name": "string",
                  "kind": "integer",
                  "startTimeUnixNano": "string(numeric)",
                  "endTimeUnixNano": "string(numeric)",
                  "attributes": [
                    "object(…)",
                    "×16"
                  ],
                  "droppedAttributesCount": "integer",
                  "events": [],
                  "droppedEventsCount": "integer",
                  "status": "object(…)",
                  "links": [],
                  "droppedLinksCount": "integer",
                  "flags": "integer"
                },
                "×5"
              ],
              [
                {
                  "traceId": "string",
                  "spanId": "string",
                  "name": "string",
                  "kind": "integer",
                  "startTimeUnixNano": "string(numeric)",
                  "endTimeUnixNano": "string(numeric)",
                  "attributes": {
                    "anyOf": [
                      [
                        "object(…)",
                        "×20"
                      ],
   
```

Response:

```json
{
  "partialSuccess": {}
}
```

### POST spm.cargurus.com/tr/tp2

Request headers of note: content-type.

Request:

```json
{
  "schema": "string",
  "data": [
    {
      "e": "string",
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
      "vp": "string",
      "ds": "string",
      "vid": "string(numeric)",
      "sid": "string(uuid)",
      "duid": "string(uuid)",
      "uid": "string",
      "url": "string(url)",
      "ue_px": "string",
      "cx": "string",
      "stm": "string(numeric)"
    },
    "×1"
  ]
}
```

### POST www.cargurus.com/:token/acd

Request headers of note: accept, content-type.

Request:

```json
"form or text body (y�G�\u0019o;lo�^�Xfx<T�O�N~c, n�N�^ad\u0011h�X�Vw5b)�O�^qc\u0019n�m�\u0019(5l'�N�Owt:\\�D�TeR6�X�Z~5t)�\u0006�_wc+h�}�Uvx9X�P�\u0019(5l'�N�Owt:F�G�okg+x�E�H{d:n�^�\u000105b)�O�^qc\u001ey�N�XfD;i�\u0010�\u0019>5*n�O�OV~)"
```

### POST capi-ata.cargurus.com/events/:hex

Request headers of note: content-type.

Request:

```json
{
  "event_name": "string",
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
      "id": "string",
      "expiryDate": "string(datetime)"
    },
    "×1"
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

### POST o47004.ingest.sentry.io/api/:id/envelope/

Request headers of note: content-type.

Request:

```json
"form or text body (opaque)"
```

Response:

```json
{}
```

### GET rp.liadm.com/j

Request headers of note: content-type, x-li-provided-user-agent.

Response:

```json
{
  "bakers": []
}
```

### GET cdn.cookielaw.org/scripttemplates/202604.1.0/assets/v2/otPcCenter.json

Request headers of note: none.

Response:

```json
{
  "name": "string",
  "html": "string",
  "css": "string"
}
```

### GET cdn.cookielaw.org/scripttemplates/202604.1.0/assets/otFlat.json

Request headers of note: none.

Response:

```json
{
  "name": "string",
  "html": "string",
  "css": "string"
}
```

### GET cdn.cookielaw.org/consent/:uuid/:token

Request headers of note: none.

Response:

```json
{
  "CookieSPAEnabled": "redacted",
  "CookieSameSiteNoneEnabled": "redacted",
  "CookieV2CSPEnabled": "redacted",
  "MultiVariantTestingEnabled": "boolean",
  "UseV2": "boolean",
  "MobileSDK": "boolean",
  "SkipGeolocation": "boolean",
  "ScriptType": "enum(PRODUCTION)",
  "Version": "string",
  "OptanonDataJSON": "string(uuid)",
  "GeolocationUrl": "string(url)",
  "BulkDomainCheckUrl": "string(url)",
  "RuleSet": [
    {
      "Id": "string(uuid)",
      "Name": "string",
      "Countries": {
        "anyOf": [
          [
            "string",
            "×211"
          ],
          []
        ]
      },
      "States": {
        "us?": [
          "string",
          "×1"
        ]
      },
      "LanguageSwitcherPlaceholder": {
        "default": "string",
        "es-us?": "string",
        "fr?": "string",
        "es?": "string"
      },
      "BannerPushesDown": "boolean",
      "Default": "boolean",
      "Global": "boolean",
      "Type": "enum(USNATIONAL | CPRA)",
      "UseGoogleVendors": "boolean",
      "VariantEnabled": "boolean",
      "TestEndTime": "null",
      "Variants": [],
      "TemplateName": {
        "anyOf": [
          "string",
          "enum(CPRA)"
        ]
      },
      "Conditions": [],
      "GCEnable": "boolean",
      "IsGPPEnabled": "boolean",
      "EnableJWTAuthForKnownUsers": "redacted"
    },
    "×2"
  ],
  "IabData": {
    "cookieVersion": "redacted",
    "createdTime": "string(datetime)",
    "updatedTime": "string(datetime)",
    "cmpId": "string(numeric)",
    "cmpVersion": "string(numeric)",
    "consentScreen": "string(numeric)",
    "consentLanguage": "null",
    "vendorListVersion": "integer",
    "maxVendorId": "integer",
    "encodingType": "string(numeric)",
    "globalVendorListUrl": "string(url)"
  },
  "IabV2Data": {
    "cookieVersion": "redacted",
    "createdTime": "string(datetime)",
    "updatedTime": "string(datetime)",
    "cmpId": "string(numeric)",
    "cmpVersion": "string(numeric)",
    "consentScreen": "string(numeric)",
    "consentLanguage": "null",
    "vendorListVersion": "integer",
    "maxVendorId": "integer",
    "encodingType": "string(numeric)",
    "globalVendorListUrl": "string(url)"
  },
  "Iab2V2Data": {
    "cookieVersion": "redacted",
    "createdTime": "string(datetime)",
    "updatedTime": "string(datetime)",
    "cmpId": "string(numeric)",
    "cmpVersion": "string(numeric)",
    "consentScreen": "string(numeric)",
    "consentLanguage": "null",
    "vendorListVersion": "integer",
    "maxVendorId": "integer",
    "encodingType": "string(numeric)",
    "globalVendorListUrl": "string(url)"
  },
  "GoogleData": {
    "vendorListVersion": "integer",
    "googleVendorListUrl": "string(url)"
  },
  "ScriptDynamicLoadEnabled": "boolean",
  "TenantFeatures": {
    "CookieV2BannerFocus": "redacted",
    "CookieV2RejectAll": "redacted",
    "CookieV2GPC": "redacted",
    "CookieV2GeolocationJsonApi": "redacted",
    "CookieV2TCF21": "redacted",
    "CookieV2SkipCategory": "redacted",
    "CookieV2BannerLogo": "redacted",
    "ConsentStoreConsentStrings": "boolean",
    "features.cmp-amazon-consent-Signal": "boolean",
    "CookieV2AssignTemplateRule": "redacted",
    "CookiesV2TCF2.3Adoption": "redacted",
    "MobileAuthenticatedConsents": "redacted",
    "CookieV2MicrosoftUET": "redacted",
    "CookieV2GCMDMA": "redacted",
    "CookieV2RemoveSettingsIcon": "redacted",
    "CookieV2NewConsentReceiptAPI": "redacted",
    "CookieV2GeneralVendors": "redacted",
    "CookieV2GPP": "redacted"
  },
  "IsSuppressBanner": "boolean",
  "IsSuppressPC": "boolean",
  "PublisherCC": "string",
  "Domain": "string",
  "TenantGuid": "string(uuid)",
  "EnvId": "string",
  "RemoteActionsEnabled": "boolean",
  "GeoRuleGroupName": "string",
  "GATrackToggle": "boolean",
  "GATrackAssignedCategory": "string",
  "WebFormIntegrationEnabled": "boolean",
  "WebFormSrcUrl": "string(empty)",
  "WebFormWorkerUrl": "string(empty)",
  "GppData": {
    "cmpId": "string(numeric)"
  },
  "AuthenticatedConsent": "redacted",
  "AuthenticatedLoggedOutConsent": "redacted",
  "CDNLocation": "string(url)",
  "RootDomainConsentEnabled": "boolean",
  "RootDomainUrl": "string(empty)",
  "LanguageDetectionEnabled": "boolean",
  "LanguageDetectionByHtml": "boolean",
  "DataLanguage": "string(empty)",
  "DisclosureCDNUrl": "string(url)",
  "SEOOptimization": "boolean",
  "PartitionedCookieEnabled": "redacted",
  "BannerRefreshAfterCallToActionEnabled": "boolean",
  "SubDomainEnabled": "boolean",
  "DomainHashValue": "string(empty)",
  "SessionTrackingUrl": "redacted"
}
```

### GET cdn.cookielaw.org/consent/:uuid/:uuid/en.json

Request headers of note: none.

Response:

```json
{
  "DomainData": {
    "pclifeSpanYr": "string",
    "pclifeSpanYrs": "string",
    "pclifeSpanSecs": "string",
    "pclifeSpanWk": "string",
    "pclifeSpanWks": "string",
    "pccontinueWithoutAcceptText": "string",
    "pccloseButtonType": "string",
    "MainText": "string",
    "MainInfoText": "string",
    "AboutText": "string",
    "AboutCookiesText": "redacted",
    "ConfirmText": "string",
    "AllowAllText": "string",
    "CookiesUsedText": "redacted",
    "CookiesDescText": "redacted",
    "AboutLink": "string(url)",
    "ActiveText": "string",
    "AlwaysActiveText": "string",
    "AlwaysInactiveText": "string",
    "PCShowAlwaysActiveToggle": "boolean",
    "AlertNoticeText": "string",
    "AlertCloseText": "string",
    "AlertMoreInfoText": "string",
    "AlertMoreInfoTextDialog": "string",
    "CookieSettingButtonText": "redacted",
    "AlertAllowCookiesText": "redacted",
    "CloseShouldAcceptAllCookies": "redacted",
    "LastReconsentDate": "null",
    "BannerTitle": "string(empty)",
    "ForceConsent": "boolean",
    "BannerPushesDownPage": "boolean",
    "InactiveText": "string",
    "CookiesText": "redacted",
    "CategoriesText": "string",
    "IsLifespanEnabled": "boolean",
    "LifespanText": "string",
    "VendorLevelOptOut": "boolean",
    "HasScriptArchive": "boolean",
    "BannerPosition": "string",
    "PreferenceCenterPosition": "string",
    "PreferenceCenterConfirmText": "string",
    "VendorListText": "string",
    "ThirdPartyCookieListText": "redacted",
    "PreferenceCenterManagePreferencesText": "string",
    "PreferenceCenterMoreInfoScreenReader": "string",
    "CookieListTitle": "redacted",
    "CookieListDescription": "redacted",
    "Groups": [
      {
        "ShowInPopup": "boolean",
        "ShowInPopupNonIAB": "boolean",
        "ShowSDKListLink": "boolean",
        "Order": "string(numeric)",
        "OptanonGroupId": "string",
        "Parent": "string(empty)",
        "ShowSubgroup": "boolean",
        "ShowSubGroupDescription": "boolean",
        "ShowSubgroupToggle": "boolean",
        "AlwaysShowCategory": "boolean",
        "GroupDescription": "string",
        "GroupDescriptionOTT": "string",
        "GroupNameMobile": "string",
        "GroupNameOTT": "string",
        "GroupName": "string",
        "IsIabPurpose": "boolean",
        "GeneralVendorsIds": [],
        "FirstPartyCookies": "redacted",
        "Hosts": {
          "anyOf": [
            [
              {
                "HostName": "string",
                "DisplayName": "string",
                "HostId": "string",
                "Description": "string(empty)",
                "PrivacyPolicy": "string(empty)",
                "Cookies": "redacted"
              },
              "×5"
            ],
            [
              {
                "HostName": "string",
                "DisplayName": "string",
                "HostId": "string",
                "Description": "string(empty)",
                "PrivacyPolicy": "string(empty)",
                "Cookies": "redacted"
              },
              "×7"
            ],
            [],
            [
              {
                "HostName": "string",
                "DisplayName": "string",
                "HostId": "string",
                "Description": "string(empty)",
                "PrivacyPolicy": "string(empty)",
                "Cookies": "redacted"
              },
              "×66"
            ]
          ]
        },
        "PurposeId": "string(uuid)",
        "CustomGroupId": "string",
        "GroupId": "string(uuid)",
        "Status": "string",
        "IsDntEnabled": "boolean",
        "Type": "enum(COOKIE)",
        "DescriptionLegal": "string(empty)",
        "IabIllustrations": [],
        "HasLegIntOptOut": "boolean",
        "HasConsentOptOut": "boolean",
        "IsGpcEnabled": "boolean",
        "VendorServices": "null",
        "TrackingTech": "null"
      },
      "×5"
    ],
    "Language": {
      "Culture": "string"
    },
    "ShowPreferenceCenterCloseButton": "boolean",
    "CustomJs": "string(empty)",
    "LifespanTypeText": "string",
    "LifespanDurationText": "string(empty)",
    "CloseText": "string",
    "BannerCloseButtonText": "string",
    "AddLinksToCookiepedia": "redacted",
    "showBannerCloseButton": "boolean",
    "AlertLayout": "string",
    "ShowAlertNotice": "boolean",
    "IsConsentLoggingEnabled": "boolean",
    "…": "259 more keys"
  },
  "CommonData": {
    "pcenterContinueWoAcceptLinkColor": "string",
    "IabThirdPartyCookieUrl": "redacted",
    "OptanonHideAcceptButton": "string(empty)",
    "OptanonStyle": "string",
    "OptanonStaticContentLocation": "string(empty)",
    "BannerCustomCSS": "string(empty)",
    "PCCustomCSS": "string(empty)",
    "PcTextColor": "string",
    "PcButtonColor": "string",
    "PcButtonTextColor": "string",
    "PcBackgroundColor": "string",
    "PcMenuColor": "string",
    "PcMenuHighLightColor": "string",
    "PcAccordionBackgroundColor": "string",
    "PCenterExpandToViewText": "string(empty)",
    "PcEnableToggles": "boolean",
    "PcLinksTextColor": "string",
    "TextColor": "string",
    "ButtonColor": "string",
    "BannerMPButtonColor": "string",
    "BannerMPButtonTextColor": "string",
    "ButtonTextColor": "string",
    "BackgroundColor": "string",
    "BannerLinksTextColor": "string",
    "BannerAccordionBackgroundColor": "string",
    "CookiePersistentLogo": "redacted",
    "OptanonLogo": "string(url)",
    "BnrLogo": "string(empty)",
    "OneTrustFooterLogo": "string(url)",
    "OptanonCookieDomain": "redacted",
    "OptanonGroupIdPerformanceCookies": "redacted",
    "OptanonGroupIdFunctionalityCookies": "redacted",
    "OptanonGroupIdTargetingCookies": "redacted",
    "OptanonGroupIdSocialCookies": "redacted",
    "ShowSubGroupCookies": "redacted",
    "LegacyBannerLayout": "string",
    "OptanonHideCookieSettingButton": "redacted",
    "UseRTL": "boolean",
    "ShowBannerAcceptButton": "boolean",
    "ShowBanner
```

### GET geolocation.onetrust.com/cookieconsentpub/v1/geo/location

Request headers of note: accept.

Response:

```json
{
  "country": "string",
  "state": "enum(ENG)",
  "stateName": "string",
  "continent": "string"
}
```

### GET accounts.google.com/gsi/fedcm.json

Request headers of note: accept.

Response:

```json
{
  "idtoken_endpoint": "redacted",
  "id_token_endpoint": "redacted",
  "id_assertion_endpoint": "string(url)",
  "metrics_endpoint": "string(url)",
  "accounts_endpoint": "string(url)",
  "client_metadata_endpoint": "string(url)",
  "client_id_metadata_endpoint": "string(url)",
  "signin_url": "string(url)",
  "login_url": "string(url)",
  "revocation_endpoint": "string(url)",
  "disconnect_endpoint": "string(url)",
  "supports_add_account": "boolean",
  "supports_use_other_account": "boolean",
  "modes": {
    "button": {
      "supports_use_other_account": "boolean"
    },
    "widget": {
      "supports_use_other_account": "boolean"
    },
    "active": {
      "supports_use_other_account": "boolean"
    },
    "passive": {
      "supports_use_other_account": "boolean"
    }
  },
  "branding": {
    "background_color": "string",
    "color": "string",
    "icons": [
      {
        "url": "string(url)",
        "size": "integer"
      },
      "×2"
    ]
  }
}
```

### GET google.com/.well-known/web-identity

Request headers of note: accept.

Response:

```json
{
  "provider_urls": [
    "string(url)",
    "×1"
  ],
  "accounts_endpoint": "string(url)",
  "login_url": "string(url)"
}
```

### GET accounts.google.com/gsi/fedcm/listaccounts

Request headers of note: accept.

Response:

```json
{
  "accounts": [],
  "site_salt": "string"
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

### POST api-iam.intercom.io/messenger/web/ping

Request headers of note: content-type.

Request:

```json
"form or text body (app_id, v, g, s, r, platform, installation_type, installation_version, Idempotency-Key, internal, is_intersection_booted, page_title, user_active_company_id, user_data, source, sampling, referer)"
```

Response:

```json
{
  "app": {
    "name": "string",
    "audio_enabled": "boolean",
    "show_powered_by": "boolean",
    "team_intro": "string",
    "team_greeting": "string",
    "messenger_background": "string",
    "expected_response_delay_translation_key": "string",
    "launcher_expected_response_delay_translation_key": "string",
    "sms_notifications_enabled": "boolean",
    "inbound_conversations_disabled": "boolean",
    "office_hours_response": "string",
    "help_center_site_url": "string(url)",
    "messenger_logo_url": "string(url)",
    "user_conversation_gifs_enabled": "boolean",
    "user_conversation_voice_notes_enabled": "boolean",
    "developer_workspace": "boolean",
    "upfront_email_collection_setting": "string",
    "temporary_expectations_message": "null",
    "localized_expected_response_delay_short_text": "string",
    "localized_expected_response_delay_long_text": "string",
    "help_center_id": "null",
    "article_auto_reaction_enabled": "boolean",
    "conversation_history_ttl_days": "null",
    "use_cache_for": []
  },
  "user": {
    "id": "string",
    "role": "string",
    "locale": "string",
    "has_conversations": "boolean",
    "anonymous_id": "string(uuid)",
    "country_code": "string",
    "new_session": "redacted",
    "help_center_require_search": "boolean",
    "requires_cookie_consent": "redacted",
    "prevent_multiple_inbound_conversation": "boolean",
    "user_assignments": {}
  },
  "client_matches": [],
  "launcher_settings": {
    "alignment": "string",
    "color": "string",
    "color_dark": "string",
    "has_required_features": "boolean",
    "horizontal_padding": "integer",
    "instant_boot_enabled": "boolean",
    "launcher_logo_url": "string(url)",
    "launcher_logo_dark_url": "string(url)",
    "messenger_layout": "string",
    "messenger_mode_switcher_enabled": "boolean",
    "secondary_color": "string",
    "secondary_color_dark": "string",
    "show_launcher": "boolean",
    "theme_mode": "string",
    "updated_at": "integer",
    "vertical_padding": "integer"
  },
  "modules": {
    "messages": {
      "google_analytics_tracking_id": "null"
    },
    "rtm": {
      "endpoints": [
        "string(url)",
        "×1"
      ],
      "options": {
        "PING_TIMEOUT": "integer",
        "PONG_TIMEOUT": "integer"
      }
    },
    "metrics": {
      "enabled": "boolean"
    },
    "error_reporting": {
      "disabled": "boolean"
    },
    "customization": {
      "brand_name": "string",
      "messenger_logo_url": "string(url)",
      "messenger_wallpaper": "string",
      "action": {
        "background_color": "string",
        "foreground_color": "string",
        "foreground_color_low_contrast": "string",
        "background_color_dark": "string",
        "foreground_color_dark": "string",
        "foreground_color_low_contrast_dark": "string"
      },
      "action_contrast_white": {
        "background_color": "string",
        "foreground_color": "string"
      },
      "action_contrast_dark": "null",
      "header": {
        "background_color": "string",
        "foreground_color": "string",
        "background_color_dark": "string",
        "foreground_color_dark": "string"
      },
      "theme_mode": "string",
      "launcher_logo_dark_url": "string(url)",
      "messenger_logo_dark_url": "string(url)",
      "custom_font": "null"
    },
    "home": {
      "header": {
        "background": {
          "enabled": "boolean",
          "animated": "boolean",
          "type": "string",
          "type_dark": "string",
          "color": "string",
          "color_dark": "string",
          "fade_to_white": "boolean",
          "fade_to_dark": "boolean",
          "gradient": [
            "string",
            "×2"
          ],
          "gradient_dark": [
            "string",
            "×3"
          ],
          "image_url": "null",
          "image_dark_url": "null"
        },
        "content": {
          "greeting": {
            "content": "string",
            "text_color": "string",
            "text_color_dark": "string",
            "opacity": "integer"
          },
          "introduction": {
            "content": "string",
            "text_color": "string",
            "text_color_dark": "string",
            "opacity": "integer"
          },
          "close_button": {
            "foreground_color": "string",
            "background_color": "string",
            "background_opacity": "number"
          },
          "show_avatars": "boolean",
          "text_color_type": "string",
          "text_color_type_dark": "string",
          "logo_url": "string(url)",
          "logo_dark_url": "string(url)"
        },
        "header_expanded": "boolean",
        "identity": "string"
      },
      "open_config": "null"
    },
    "features": {
      "checklists": "boolean",
      "checklists_reminders": "boolean",
      "inbound_messages": "boolean",
      "inbound_lead_messaging": "boolean",
      "inbound_lead_messaging_docs_site": "boolean",
      "launcher_discovery_mode": "boolean",
      "marketo_enrichment_installed": "boolean",
      "hubspot_installed": "boolean",
      "google_analytics": "boolean",
      "single_page_app_rate_limiting": "boolean",
      "cross_site_cookies": "redacted",
      "cookie_secure_flag": "redacted",
      "ticket_creation": "boolean",
      "google_analytics_4_integration": "boolean",
      "view_in_help_center_button": "boolean",
      "customer_privacy_policy": "boolean",
      "eprivacy_cookie_compliance_required": "redacted",
      "persist_client_id_for_conversation_parts": "boolean",
      "composer_is_not_hiding": "boolean",
      "unified_reply_expectations": "boolean",
      "disable_fin_image_reading": "boolean",
      "delay_tour_render": "boolean",
      "disable_tickets_after_conversation_end": "boolean",
      "new_mobile_notifications_enabled": "boolean",
      "nexus_ably": "boolean",
      "disable_ticket_email_notification": "boolean",
      "url_based_client_m
```

### GET c.amazon-adsystem.com/aat/allowlist/allowlist.json

Request headers of note: none.

Response:

```json
{
  "allowlisted": [
    "string(uuid)",
    "×6"
  ]
}
```

### GET ipv4.podscribe.com/

Request headers of note: none.

Response:

```json
{
  "ip": "string"
}
```

### GET pub.doubleverify.com/dvtag/signals/ids/pub.json

Request headers of note: none.

Response:

```json
{
  "IDS": [
    "string(numeric)",
    "×1"
  ],
  "DVR": [
    "string",
    "×1"
  ]
}
```

### GET pub.doubleverify.com/dvtag/signals/bsc/pub.json

Request headers of note: none.

Response:

```json
{
  "ABS": [
    "string(numeric)",
    "×8"
  ],
  "BSC": [
    "string(numeric)",
    "×4"
  ],
  "DVR": [
    "string",
    "×1"
  ]
}
```

### POST bzr.openai.com/v1/sdk/events

Request headers of note: content-type.

Request:

```json
{
  "obref": "string(uuid)",
  "events": [
    {
      "type": {
        "anyOf": [
          "string",
          "string(prefixed-id)"
        ]
      },
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
        "config??": {
          "automatic_advanced_matching": "string"
        },
        "contents?": [
          {
            "content_type": "string"
          },
          "×1"
        ]
      },
      "source_url?": "string(url)"
    },
    "×3"
  ]
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

### GET accdn.lpsnmedia.net/api/account/:id/configuration/setting/accountproperties

Request headers of note: none.

Response:

```json
[
  {
    "id": "string",
    "createdDate": "string",
    "type": "integer",
    "propertyValue": {
      "value": {
        "anyOf": [
          {
            "anyOf?": [
              "string",
              [],
              "string(empty)"
            ]
          },
          "integer"
        ]
      }
    },
    "deleted": "boolean",
    "modifiedDate?": "string"
  },
  "×49"
]
```

### GET accdn.lpsnmedia.net/api/account/:id/configuration/le-campaigns/zones

Request headers of note: none.

Response:

```json
[
  {
    "id": "integer",
    "createdDate": "string",
    "modifiedDate": "string",
    "name": "string",
    "deleted": "boolean",
    "zoneType": "integer",
    "mainZone": "boolean",
    "capping": "integer",
    "mapping": {
      "anyOf": [
        [
          {
            "engagementSubType": "integer"
          },
          "×3"
        ],
        [
          {
            "engagementSubType": "integer"
          },
          "×14"
        ],
        [
          {
            "engagementSubType": "integer"
          },
          "×7"
        ],
        []
      ]
    },
    "isDeleted": "boolean",
    "zoneValue?": "string"
  },
  "×33"
]
```

### GET accdn.lpsnmedia.net/api/account/:id/configuration/domainprotection/refererrestrictions

Request headers of note: none.

Response:

```json
{
  "error": "string"
}
```

### GET api.id5-sync.com/analytics/:id/id5-api-js

Request headers of note: none.

Response:

```json
{
  "sampling": "integer",
  "ingestUrl": "string(url)",
  "additionalCleanupRules": {
    "auctionEnd": [
      {
        "match": {
          "anyOf": [
            [
              [
                "string",
                "×1"
              ],
              "×1"
            ],
            [
              {
                "anyOf": [
                  [
                    "string",
                    "×1"
                  ],
                  [
                    "string",
                    "×8"
                  ]
                ]
              },
              "×5"
            ],
            [
              [
                "string",
                "×1"
              ],
              "×6"
            ],
            [
              [
                "string",
                "×1"
              ],
              "×7"
            ],
            [
              [
                "string",
                "×1"
              ],
              "×8"
            ],
            [
              [
                "string",
                "×1"
              ],
              "×12"
            ]
          ]
        },
        "apply": "string"
      },
      "×14"
    ],
    "bidWon": [
      {
        "match": [
          [
            "string",
            "×5"
          ],
          "×1"
        ],
        "apply": "string"
      },
      "×1"
    ]
  }
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
              "×1"
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

### GET id5-sync.com/bounce

Request headers of note: none.

Response:

```json
{
  "bounce": {
    "setCookie": "redacted"
  }
}
```

### GET lb.eu-1-id5-sync.com/lb/v1

Request headers of note: none.

Response:

```json
{
  "lb": "string",
  "ttl": "integer"
}
```

### GET lbs.eu-1-id5-sync.com/lbs/v1

Request headers of note: none.

Response:

```json
{
  "lbs": "string"
}
```

### POST id5-sync.com/gm/v3

Request headers of note: content-type.

Request:

```json
{
  "requests": [
    {
      "requestId": "string(uuid)",
      "requestCount": "integer",
      "role": "string",
      "cacheId": "string(numeric)",
      "refresh": "boolean",
      "source": "string",
      "sourceVersion": "string",
      "partner": "integer",
      "v": "string",
      "o": "string",
      "tml": "string(url)",
      "ref": "null",
      "cu": "string(url)",
      "u": "string(url)",
      "top": "integer",
      "localStorage": "integer",
      "id5cdn": "boolean",
      "ua": "string",
      "gdpr": "integer",
      "gpp_string": "string",
      "gpp_sid": "string(numeric)",
      "ua_hints": {
        "architecture": "string",
        "brands": [
          {
            "brand": "string",
            "version": "string(numeric)"
          },
          "×2"
        ],
        "fullVersionList": [
          {
            "brand": "string",
            "version": "string"
          },
          "×2"
        ],
        "mobile": "boolean",
        "model": "string(empty)",
        "platform": "string",
        "platformVersion": "string(numeric)"
      },
      "provider": "string",
      "true_link": {
        "booted": "boolean"
      },
      "provided_options": {},
      "extensions": {
        "lbCDN": "string",
        "lb": "string",
        "ttl": "integer",
        "bounce": {
          "setCookie": "redacted"
        },
        "lbs": "string"
      }
    },
    "×1"
  ]
}
```

Response:

```json
{
  "generic": {
    "created_at": "string(datetime)",
    "id5_consent": "boolean",
    "original_uid": "string(numeric)",
    "universal_uid": "string(numeric)",
    "link_type": "integer",
    "cascade_needed": "boolean",
    "privacy": {
      "jurisdiction": "string",
      "id5_consent": "boolean"
    },
    "ext": {
      "linkType": "integer",
      "pba": "string"
    },
    "ids": {
      "id5id": {
        "eid": {
          "source": "string",
          "uids": [
            {
              "id": "string(numeric)",
              "atype": "integer",
              "ext": "object(…)"
            },
            "×1"
          ]
        }
      }
    }
  },
  "responses": {
    "5d25eff2-fd7c-4454-a689-953cdfbfd1bd": {}
  }
}
```

### POST euwe1.idp.liveperson.net/api/account/:id/anonymous/authorize

Request headers of note: content-type.

Response:

```json
{
  "token": "redacted"
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

### POST api-iam.intercom.io/messenger/web/launcher_settings

Request headers of note: content-type.

Request:

```json
"form or text body (app_id, v, g, s, r, platform, installation_type, installation_version, Idempotency-Key, internal, is_intersection_booted, page_title, user_active_company_id, user_data, referer)"
```

Response:

```json
{
  "alignment": "string",
  "color": "string",
  "color_dark": "string",
  "has_required_features": "boolean",
  "horizontal_padding": "integer",
  "instant_boot_enabled": "boolean",
  "launcher_logo_url": "string(url)",
  "launcher_logo_dark_url": "string(url)",
  "messenger_layout": "string",
  "messenger_mode_switcher_enabled": "boolean",
  "secondary_color": "string",
  "secondary_color_dark": "string",
  "show_launcher": "boolean",
  "theme_mode": "string",
  "updated_at": "integer",
  "vertical_padding": "integer"
}
```

### GET surveys-static-prd.survicate-cdn.com/data/tldToLanguageMap.json

Request headers of note: content-type.

Response:

```json
{
  "ae": "string",
  "ar": "string",
  "at": "string",
  "au": "string",
  "az": "string",
  "be": [
    "string",
    "×2"
  ],
  "bg": "string",
  "br": "string",
  "by": "string",
  "ca": [
    "string",
    "×2"
  ],
  "ch": [
    "string",
    "×3"
  ],
  "cl": "string",
  "cn": "string",
  "cz": "string",
  "de": "string",
  "dk": "string",
  "ee": "string",
  "eg": "string",
  "es": "string",
  "fi": "string",
  "fr": "string",
  "ge": "string",
  "gr": "string",
  "hk": "string",
  "hr": "string",
  "hu": "string",
  "id": "string",
  "ie": "string",
  "il": "string",
  "in": [
    "string",
    "×2"
  ],
  "is": "string",
  "it": "string",
  "jp": "string",
  "kr": "string",
  "kz": "string",
  "lt": "string",
  "lu": [
    "string",
    "×3"
  ],
  "lv": "string",
  "ma": [
    "string",
    "×2"
  ],
  "mx": "string",
  "my": [
    "string",
    "×2"
  ],
  "nl": "string",
  "no": "string",
  "nz": "string",
  "pe": "string",
  "ph": [
    "string",
    "×2"
  ],
  "pl": "string",
  "pt": "string",
  "ro": "string",
  "rs": "string",
  "ru": "string",
  "sa": "string",
  "se": "string",
  "sg": [
    "string",
    "×4"
  ],
  "si": "string",
  "sk": "string",
  "th": "string",
  "tr": "string",
  "tw": "string",
  "ua": "string",
  "…": "4 more keys"
}
```

### GET surveys-static-prd.survicate-cdn.com/data/languageCodes.json

Request headers of note: content-type.

Response:

```json
[
  "string",
  "×195"
]
```

### GET pub.doubleverify.com/dvtag/signals/vlp/pub.json

Request headers of note: none.

Response:

```json
[
  {
    "VLP": [
      {
        "anyOf": [
          "string(numeric)",
          "string"
        ]
      },
      "×6"
    ],
    "TVP": [
      "string",
      "×6"
    ]
  },
  "×1"
]
```

### POST web-banner.ads.aps.amazon-adsystem.com/e/dtb/bid

Request headers of note: content-type.

Request:

```json
{
  "src": "integer",
  "u": "string(url)",
  "pid": "string",
  "cb": "integer",
  "ws": "string",
  "v": "string",
  "t": "integer",
  "slots": [
    {
      "sd": "string",
      "s": [
        "string",
        "×1"
      ],
      "sn": "string",
      "ext": {
        "gpid": "string",
        "tid": "string(uuid)"
      },
      "banner": {
        "pos": "integer"
      }
    },
    "×1"
  ],
  "pj": {
    "device": {
      "sua": {
        "mobile": "integer",
        "source": "integer",
        "platform": {
          "brand": "string"
        },
        "browsers": [
          {
            "brand": "string",
            "version": [
              "string(numeric)",
              "×1"
            ]
          },
          "×3"
        ]
      }
    }
  },
  "gpp": "string",
  "gpp_sid": [
    "integer",
    "×1"
  ],
  "gdprl": {
    "status": "string"
  },
  "regs": {
    "coppa": "integer"
  },
  "rt": "string",
  "source": {
    "tid": "string(uuid)"
  }
}
```

Response:

```json
{
  "requestId": "string(uuid)",
  "contextual": {
    "cb": "string(numeric)",
    "cmp": "string(url)"
  }
}
```

### POST prod.us-east-1.cxm-bcn.publisher-services.amazon.dev/v1/recordVendorsLoaded

Request headers of note: content-type.

Request:

```json
[
  {
    "publisherId": "string(numeric)",
    "sourceId": "string(numeric)",
    "clientName": "string",
    "vendorId": "string",
    "propertyId": "string(numeric)"
  },
  "×1"
]
```

## Console errors and warnings

- [mobile] warning: @honeycombio/opentelemetry-web: ❌ Missing API Key. Set `apiKey` in HoneycombOptions. Telemetry will not be exported.
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [mobile] warning: [GSI_LOGGER]: Your client application uses one of the Google One Tap prompt UI status methods that may stop functioning when FedCM becomes mandatory. Refer to the migration guide to update your code accordingly and opt-in to FedCM to test y
- [mobile] error: Provider's accounts list is empty.
- [mobile] warning: Namespace clash happened, with name: window.owpbjs, now you can provide your custom namespace, by creating new profile version in the UI. Existing PWT version details: undefined
- [mobile] warning: [GPT] PubAdsService.setTargeting is deprecated, use googletag.setConfig({targeting: ...}) instead.
https://goo.gle/gpt-message#170
- [mobile] warning: The following functions are deprecated: googletag.pubads().setTagForChildDirectedTreatment(), googletag.pubads().clearTagForChildDirectedTreatment(), googletag.pubads().setRequestNonPersonalizedAds(), and googletag.pubads().setTagForUnderAg
- [mobile] warning: Unrecognized feature: 'attribution-reporting'.
- [mobile] error: requestStorageAccess: Permission denied.
- [mobile] warning: The resource https://cdn.cookielaw.org/scripttemplates/202604.1.0/assets/otCommonStyles.css was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value a
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [mobile] warning: The resource https://cdn.cookielaw.org/scripttemplates/202604.1.0/assets/otCommonStyles.css was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value a
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [mobile] warning: MVT configuration is not defined! Check the MvtProvider component near the root of your component tree
- [desktop] warning: @honeycombio/opentelemetry-web: ❌ Missing API Key. Set `apiKey` in HoneycombOptions. Telemetry will not be exported.
- [desktop] warning: [GSI_LOGGER]: Your client application uses one of the Google One Tap prompt UI status methods that may stop functioning when FedCM becomes mandatory. Refer to the migration guide to update your code accordingly and opt-in to FedCM to test y
- [desktop] error: Provider's accounts list is empty.
- [desktop] warning: Unrecognized feature: 'attribution-reporting'.
- [desktop] warning: [GPT] PubAdsService.setTargeting is deprecated, use googletag.setConfig({targeting: ...}) instead.
https://goo.gle/gpt-message#170
- [desktop] warning: The following functions are deprecated: googletag.pubads().setTagForChildDirectedTreatment(), googletag.pubads().clearTagForChildDirectedTreatment(), googletag.pubads().setRequestNonPersonalizedAds(), and googletag.pubads().setTagForUnderAg
- [desktop] warning: [GPT] Slot.setTargeting is deprecated, use Slot.setConfig({targeting: ...}) instead.
https://goo.gle/gpt-message#171
- [desktop] warning: [GPT] This ad request is subject to Google's EU User Consent Policy. An IAB TCF signal was not received. This ad request will not be eligible for personalized ads.
https://goo.gle/gpt-message#175
- [desktop] warning: Namespace clash happened, with name: window.owpbjs, now you can provide your custom namespace, by creating new profile version in the UI. Existing PWT version details: undefined
- [desktop] error: requestStorageAccess: Permission denied.
