# Changelog

All notable changes to `node-smartcielo-ws` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

See `API_STATUS.md` for the current state of the Cielo API, including which
endpoints work, which are misleading, and how the findings were verified.

## [2.2.1] - 2026-08-31

### Fixed

- Login failures were reported as `Login failed: Unknown error`. The API returns
  `{"error": {"code", "message"}}`, but only the top-level `message` was read, so
  a wrong password was indistinguishable from an outage. The real code and
  message are now shown, e.g. `Login failed: 403: forbidden`.

  Note that a rejected captcha and a wrong password both return `403 forbidden`,
  so a login failure is deliberately *not* treated as permanent - stopping on
  one would let a single stale captcha disable the plugin. Retries continue
  under the existing backoff.

## [2.2.0] - 2026-08-31

**Upgrade required.** Every earlier version is unable to list devices or stay
signed in, because of a server-side change at Cielo.

### Fixed

- **Log in as an iOS client, not a web client.** Cielo's `WEB` session type is
  broken server-side: its access tokens are rejected by the device-list endpoint
  (`498`) and by the refresh endpoint (`401`, even for a token five seconds old).
  Cielo's own web app fails the same way — it signs in, refreshes, receives 401
  and signs itself out, reproducible in a clean browser profile. The `IOS`
  session type works. Same account, credentials and IP: `WEB` fails, `IOS`
  succeeds.
- **`/web/devices?limit=420` is not retired**, contrary to what its `498`
  responses suggest. It rejects `WEB` tokens and serves `IOS` tokens normally,
  returning `macAddress`, `applianceId`, `deviceTypeVersion`, `fwVersion` and
  `latestAction`.
- **Token refresh works again**, corrected to the verified contract:
  `POST /web/token/refresh/1` (not `GET`, and not the path without `/1` — both
  are IAM-authed), using the data API key rather than the login key, with the
  refresh token in the body and the access token in `Authorization`. The server
  **rotates the refresh token on every call**; the returned value is now kept,
  without which the next refresh fails.
- **Generate a `sessionId`.** The iOS login response does not include one, and
  the WebSocket rejects an omitted or empty value with `502`. Any non-empty
  string is accepted.

### Changed

- Each instance sends a randomised device identity at login rather than the
  literal `"WEB"`, so it occupies its own session slot instead of competing with
  the user's browser or phone.
- Refresh-first reconnect is enabled by default (`CIELO_ENABLE_REFRESH_LOGIN=0`
  disables it). Verified end to end: four consecutive connections, one captcha
  solve in total.

## [2.1.1] - 2026-08-31

### Security

- **Removed hardcoded credentials.** A plaintext account password was present in
  four test scripts in this public repository from 2.0.0 onward, and
  `.npmignore` deliberately kept one of them (`test-interactive.js`) in the
  package — so it also shipped inside published tarballs from 2.0.3 through
  2.1.1. A live 2Captcha API key was committed in `SUMMARY.md`. Both secrets
  have been rotated. Test scripts now read credentials from the environment, the
  published tarball contains only library files, and `npm test` now fails on a
  hardcoded credential or on any credential-reading file becoming publishable.

### Fixed

- Device-list failures rejected a bare API error object, which callers logged as
  `[object Object]`. Rejections are now real `Error`s carrying the API code and
  message, and the HTTP status and body are logged when a request fails.

## [2.1.0] - 2026-08-31

### Fixed

- **WebSocket host was wrong.** `apiwss.smartcielo.com` is a different subdomain
  from the one the web app uses and answers every upgrade with `403`. Because
  sign-in succeeds first, this meant paying for a captcha and *then* failing, on
  every attempt. Now `wss.smartcielo.com`, with the session id and token
  URL-encoded. Credit to the reporter of homebridge-smartcielo#12 for capturing
  the real handshake and ruling out cookies, `x-api-key` and query encoding.
- **Every failure was reported twice.** A failing socket emits both `error` and
  `close`, and both invoked the error callback, so consumers scheduled two
  reconnects — and bought two captchas — per dropped connection. Both now route
  through a single-shot notifier, with timers still cleared on each invocation
  so the keepalive interval cannot leak.
- **Permanent 2Captcha errors are distinguishable.** `ERROR_ZERO_BALANCE`, a
  wrong or banned key and similar now raise `PermanentCaptchaError` so callers
  stop rather than retrying — retrying is what re-drains an account once it is
  topped up.
- `sendCommand` rejects when the socket is not `OPEN` instead of writing into a
  dead socket and reporting a success that never reached the unit.

### Changed

- Removed unconditional per-message tracing to `./cielo-debug.log`, written with
  `appendFileSync`. It was unbounded and synchronous; on one host it exceeded
  10MB and silently broke nightly Homebridge backups. Tracing is now opt-in via
  `CIELO_DEBUG=1`.
- Output goes through an injectable logger (`setLogger`). The token refresh path
  was logging its full response body, which contains both tokens; it now logs
  only whether the refresh succeeded.

## [2.0.7] and earlier

WebSocket ping/pong keepalive for the 15-minute disconnect, automatic device
discovery when no MAC addresses are given, removal of the puppeteer dependency,
`BP` device-type support, and the move to captcha-based authentication for the
v2 Cielo API.

Versions before 2.2.0 cannot list devices against the current API, and versions
2.0.3 through 2.1.1 contain a hardcoded credential in the published tarball.

[2.2.0]: https://github.com/ryanfroese/node-cielo/releases/tag/v2.2.0
[2.1.1]: https://github.com/ryanfroese/node-cielo/releases/tag/v2.1.1
[2.1.0]: https://github.com/ryanfroese/node-cielo/releases/tag/v2.1.0
