# Network and API map: https://www.aparat.com/signin

Captured 2026-09-29T14:13:36.361Z. Redacted by construction: no cookie, header, query or body values; JSON is reduced to key names, types and SCREAMING_CASE enum constants.

24 requests to 1 hosts.

| Type | Requests | Transferred |
| --- | --- | --- |
| script | 6 | 3964 KB |
| font | 6 | 140 KB |
| image | 4 | 11 KB |
| xhr | 4 | 3 KB |
| document | 2 | 0 KB |
| stylesheet | 2 | 12 KB |

## Hosts

| Host | Party | Requests | Types |
| --- | --- | --- | --- |
| www.aparat.com | first | 24 | document, script, image, stylesheet, xhr, font |

## Endpoints

| Method | Host | Path pattern | GraphQL | Calls | Status | Query names |
| --- | --- | --- | --- | --- | --- | --- |
| GET | www.aparat.com | `/api/fa/v1/user/Authenticate/:ui_id` |  | 2 | 200 | guid |
| POST | www.aparat.com | `/api/fa/v1/user/Authenticate/auth` |  | 2 | 200 |  |

## Shapes

### GET www.aparat.com/api/fa/v1/user/Authenticate/:ui_id

Request headers of note: accept.

Response:

```json
{
  "data": {
    "type": "string(prefixed-id)",
    "id": "integer",
    "attributes": {
      "logo": "boolean",
      "bg": "boolean",
      "provider_name_fa": "string",
      "provider_name_en": "string",
      "provider_name": "string",
      "theme": {
        "brand_color": "string",
        "text_color": "string",
        "button_color": "string",
        "logo": {
          "logo_sign": "string(url)",
          "logo_type": "string(url)"
        },
        "bg": "string(url)"
      },
      "support_array": [],
      "signup_daily": [],
      "checkbox": [],
      "recaptcha_key_signup": "null",
      "recaptcha_key_signin": "null",
      "device_type": "string",
      "google_uri": "null",
      "google_one_tap": {
        "status": "boolean",
        "client_id": "string"
      },
      "signup": {
        "options": [
          "string",
          "×2"
        ],
        "menu": [
          "string",
          "×2"
        ]
      },
      "signin": {
        "options": [
          "string",
          "×3"
        ]
      },
      "auth_methods": "redacted",
      "code_length": "integer",
      "tv_code_length": "integer",
      "abroad": "boolean",
      "captchaAvailable": "string",
      "captchaPublicKey": "string",
      "id": "integer"
    }
  }
}
```

### POST www.aparat.com/api/fa/v1/user/Authenticate/auth

Request headers of note: accept, content-type.

Request:

```json
{
  "guid": "string(uuid)"
}
```

Response:

```json
{
  "data": {
    "type": "string",
    "id": "integer",
    "attributes": {
      "temp_id": "string(numeric)",
      "GUID": "string(uuid)",
      "id": "integer"
    }
  }
}
```
