# Cielo API status and findings

Last verified: **2026-08-31**, against the live API and the production web app
bundle (`main.385ff48ff2da2a90.js` from `home.cielowigle.com`).

Read this before changing authentication, the device list, or reconnect logic.
Several "obvious" fixes here are wrong, and the notes say why.

## Summary

**Everything works - as long as you log in as `IOS`, not `WEB`.**

| Capability | as `WEB` | as `IOS` |
|---|---|---|
| Login (`POST /auth/login`) | works | works |
| Device list (`/web/devices?limit=420`) | **rejected (498)** | **works** |
| Token refresh (`/web/token/refresh/1`) | **rejected (401)** | **works, repeatable** |
| WebSocket | works | works (needs a generated sessionId) |

The `WEB` session type is broken server-side. Its tokens are refused by the
data routes and by refresh, which is why Cielo's own web app cannot hold a
session: it logs in, refreshes, gets 401 and signs itself out. Reproduced in a
clean incognito profile with no extensions.

This is **not** account-specific and not a block. The same account, credentials
and IP succeed under `IOS` in the same minute.

Verified end to end against the live API: four consecutive connections,
**one captcha solve total**, all four devices discovered each time.

## What works

### Login

```
POST https://api.smartcielo.com/auth/login
x-api-key: XiZ0PkwbNlQmu3Zrt7XV3EHBj1b1bHU9k02MSJW2
content-type: application/json; charset=UTF-8
origin: https://home.cielowigle.com

{"user": {"userId": "...", "password": "<sha256 hex>",
          "mobileDeviceId": "<random uuid>", "deviceTokenId": "<random hex>",
          "appType": "IOS", "appVersion": "5.0.4",
          "mobileDeviceName": "iPhone", "deviceType": "IOS",
          "ipAddress": "...", "isSmartHVAC": 0, "locale": "en", ...},
 "captchaToken": "<recaptcha v2 token>"}

Use **`IOS`**, not `WEB`. Randomise the device identity so this client holds
its own session slot instead of sharing the literal "WEB" with the user's
browser and phone.
```

The captcha field is **`captchaToken`**, camelCase. Issue #6 reported that it
had become `captcha_token`; that is not correct against the current API — a
live login with camelCase returns `status: 200 / SUCCESS`. The API no longer
emits the `'captcha_token' is a required property` message that report quoted.

Returns `data.user` with `accessToken`, `refreshToken`, `expiresIn` (an absolute
unix timestamp, consistently `now + 3600`) and `userId`. Note there is **no
`sessionId`** under an IOS login - see the WebSocket section.

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

## The parts that mislead

### Token refresh

Captured from the live web app and verified:

```
POST https://api.smartcielo.com/web/token/refresh/1
content-type, x-api-key, Authorization, Accept
{"refreshToken": "...", "locale": "en"}
```

Every part of that contract matters:

- **POST**, not GET. `GET` on this path is IAM-authed and answers any
  bearer-style request with a SigV4 complaint.
- **the `/1` segment**. `/web/token/refresh` without it is also IAM-authed.
- **the data key**, not the login key. The login key is `403`d here.
- refresh token in the **body**, access token in **`Authorization`**.

The server **rotates the refresh token on every call** - keep the returned one
or the next refresh fails.

Under a `WEB` login this returns `401` even for a token 5 seconds old (tested
across seven variants). Under an `IOS` login it succeeds and can be repeated
indefinitely, which is what reduces captcha spend to a single solve per
install rather than one per reconnect.

### Device list (works under IOS)

```
GET https://api.smartcielo.com/web/devices?limit=420
x-api-key: 7xTAU4y4B34u8DjMsODlEyprRRQEsbJ3IB7vZie4   (data key, not the login key)
authorization: <accessToken>
```

Returns `data.listDevices` with everything the plugin needs: `macAddress`,
`deviceName`, `applianceId`, `deviceTypeVersion`, `fwVersion`, `latestAction`
and `latEnv`.

This endpoint is **not** retired, despite appearing nowhere in the web bundle.
It simply rejects `WEB` tokens with `498`. The bundle's `getDevicesUrl()`
resolves to `/web/device/1`, which is what the current *web app* calls; that
route is IAM-authed for every method we can send, so it is not usable here.
`/web/devices` remains available to app clients.

### WebSocket sessionId

The IOS login response contains **no `sessionId`**, but the socket rejects an
omitted or empty one with `502`. The value is not validated server-side -
`chrome-<ts>`, `ios-<ts>`, a bare timestamp and the userId were all accepted -
so the client generates one. Only emptiness is fatal.

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
