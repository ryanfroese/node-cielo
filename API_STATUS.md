# Cielo API status and findings

Last verified: **2026-08-31**, against the live API and the production web app
bundle (`main.385ff48ff2da2a90.js` from `home.cielowigle.com`).

Read this before changing authentication, the device list, or reconnect logic.
Several "obvious" fixes here are wrong, and the notes say why.

## Summary

| Capability | State | Notes |
|---|---|---|
| Login (`POST /auth/login`) | **works** | captcha required; field is `captchaToken` (camelCase) |
| Access token lifetime | **3600s** | exactly one hour |
| WebSocket | **works** | `wss://wss.smartcielo.com`, keepalive verified |
| Device list (REST) | **broken** | every known route rejects a valid token |
| Token refresh | **broken** | rejects a refresh token 5 seconds old |

The WebSocket path is healthy. The REST data path is not, and the failure is
server-side: **Cielo's own web app cannot hold a session either**, reproduced in
a clean incognito profile with no extensions.

## What works

### Login

```
POST https://api.smartcielo.com/auth/login
x-api-key: XiZ0PkwbNlQmu3Zrt7XV3EHBj1b1bHU9k02MSJW2
content-type: application/json; charset=UTF-8
origin: https://home.cielowigle.com

{"user": {"userId": "...", "password": "<sha256 hex>", "mobileDeviceId": "WEB",
          "deviceTokenId": "WEB", "appType": "WEB", "appVersion": "1.4.4",
          "deviceType": "WEB", "ipAddress": "...", "isSmartHVAC": 0,
          "locale": "en", ...},
 "captchaToken": "<recaptcha v2 token>"}
```

The captcha field is **`captchaToken`**, camelCase. Issue #6 reported that it
had become `captcha_token`; that is not correct against the current API — a
live login with camelCase returns `status: 200 / SUCCESS`. The API no longer
emits the `'captcha_token' is a required property` message that report quoted.

Returns `data.user` with `accessToken`, `refreshToken`, `expiresIn` (an absolute
unix timestamp, consistently `now + 3600`), `sessionId`, `userId`.

### WebSocket

```
wss://wss.smartcielo.com/websocket/?sessionId=<sessionId>&token=<accessToken>
Origin: https://home.cielowigle.com
```

Verified live: the socket opens, ping/pong keepalive gets a pong, and the
server pushes `StateUpdate` frames carrying `mac_address`, `device_name`,
`fw_version`, `device_status`, the full `action` state (power, mode, temp,
fanspeed, swing, turbo, followme) and `lat_env_var` (room temperature and
humidity).

**The host is `wss.smartcielo.com`, not `apiwss.smartcielo.com`** (issue #12).
The two answer differently even without credentials:

| Host | Response to a bogus token |
|---|---|
| `wss.smartcielo.com` | `498 invalid or expired token` — token evaluated |
| `apiwss.smartcielo.com` | `403 Forbidden` — rejected before evaluation |

The bundle confirms it: `getActionsUrl()` builds the socket URL from a `wssURL`
config value plus `/?sessionId=` and `&token=`.

Note the socket does **not** care that the access token later expires. An open
socket keeps working past the 1-hour mark, so the practical way to minimise
captcha spend is to hold one socket open rather than to re-authenticate.

## What is broken

### Token refresh

The endpoint exists and its contract is known. Captured from the live web app:

```
POST https://api.smartcielo.com/web/token/refresh/1
content-type, x-api-key, Authorization, Accept
{"refreshToken": "...", "locale": "en"}
```

It returns `401 invalid or expired token` for a refresh token **5 seconds old**.
Tested seven variants immediately after a successful login: the exact web-app
contract, both API keys, `Authorization` set to the access token and to the
refresh token, with and without `locale`, `Bearer`-prefixed, and snake_case
`refresh_token`. All 401.

The production web app hits the same 401 and logs itself out, redirecting to
`/auth/login?reason=tokenExpired`. Reproduced in clean incognito.

**Consequence: there is currently no way to reconnect without buying a
captcha.** Refresh-based login is therefore disabled in `Cielo.js` behind
`CIELO_ENABLE_REFRESH_LOGIN=1`. The fallback path is already correct, so if
Cielo fixes this, setting that variable is all that is needed.

### Device list

`/web/devices?limit=420` — what this library used to call — **no longer exists**.
It appears nowhere in the current web app bundle, and returns `498` for every
combination of key, token format, and headers.

Deobfuscating the bundle gives the replacement:

```js
getDevicesUrl() { return config.baseUrl + '/web/device/1'; }
```

But no request I can construct is accepted:

| Route | Method | Result |
|---|---|---|
| `/web/device/1` | GET, POST, PATCH, DELETE | `403 Missing Authentication Token` (route absent) |
| `/web/device/1` | PUT | `498` — route exists, token rejected |
| `/web/device` | GET | `498` — route exists, token rejected |
| `/web/device` | POST | `403 Missing Authentication Token` |

Every route that reaches the application rejects an access token that is
minutes old — **the same token the WebSocket accepts**. So the token is
genuinely valid; the REST authorizer disagrees.

### API keys

Three keys exist in the bundle. They are not interchangeable:

| Key | Purpose / behaviour |
|---|---|
| `XiZ0PkwbNlQmu3Zrt7XV3EHBj1b1bHU9k02MSJW2` | login; `403 Forbidden` on data routes |
| `7xTAU4y4B34u8DjMsODlEyprRRQEsbJ3IB7vZie4` | legacy data key; reaches the app (`498`) |
| `wJouJUSVk83bW80PfM8Niao3QMuJBsbOUorJC2af` | also reaches the app (`498`) |
| `Fr9ZVRxvJB22rNAvndQVi3yGssx1gIZhazrlH1QS` | `403 Forbidden` |

`403 Forbidden` means API Gateway rejected the key for that route. `498` means
the key was accepted and the *application* rejected the token. Use that
distinction when probing — it is the only reliable signal of whether a route
exists and which key belongs to it.

## Endpoint inventory

Extracted from the bundle's string table. Routes are `/1`-suffixed now
(`/auth/signup/1`, `/web/profile/1`, `/web/thermostat/1`), which is a versioning
scheme, not a device id.

```
/auth/login            /auth/logout          /auth/token/validate
/auth/signup/1         /auth/forgot          /auth/login/social
/web/device            /web/device/1         /web/device/appliance/6
/web/device/bulk/6     /web/device/filter    /web/dashboard
/web/token/refresh/1   /web/profile/1        /web/thermostat/1
/web/group/1           /web/schedule         /web/comfy/1
/web/sync/db/10        /web/sync/appliances/10
/web/weather/1         /web/signout/1        /web/zones
```

## Reproducing

`tests/captcha-spend.test.js` covers the parts that are settled and cheap to
check. For anything needing a live token, the experiment scripts used for this
investigation follow a deliberate two-phase shape:

1. Log in once, save the tokens to a file. This is the only step that costs
   money (~$0.003 per captcha solve).
2. Probe freely for the next hour against the saved token.

Do not put a login inside a probe loop. Each iteration is a paid solve, and
that is exactly the mistake that produced the original cost incident.

## Deobfuscating the bundle

Useful when an endpoint moves again:

1. Fetch `https://home.cielowigle.com/` and read the `main.*.js` filename.
2. The obfuscator is a rotated string table. Find `function a0_0x4b84` (the
   decoder, `array[idx - 0x9e]`) and `function a0_0x4a50` (the table), then cut
   the bundle at the end of the rotation IIFE — it terminates with
   `}(a0_0x4a50,0x...));`.
3. Run that prefix in a `vm` context and call the decoder directly. Do not try
   to reverse the rotation by hand; the IIFE mutates the array until a checksum
   matches.
4. URL builders read as `baseUrl + decoder(0xNNNN)`. Decode the index to get
   the path.

## Recommended next step

The REST failures are on Cielo's side and cannot be fixed from this client.
Worth raising with Cielo support, with the evidence above — particularly that
their own web app cannot maintain a session, which is reproducible without any
third-party client involved.
