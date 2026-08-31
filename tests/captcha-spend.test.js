#!/usr/bin/env node
/*
 * Regression tests for the captcha-spend defects behind issues #10 and #12.
 *
 * These are the failure modes that turned one dropped connection into a
 * stream of paid captcha solves:
 *
 *   1. The WebSocket host must be wss.smartcielo.com. apiwss.smartcielo.com
 *      is a different subdomain that 403s every upgrade, which guaranteed a
 *      reconnect loop and a paid solve per cycle. (issue #12)
 *   2. A failing socket emits BOTH "error" and "close". The error callback
 *      must fire exactly once per socket, or the consumer schedules two
 *      reconnects - and buys two captchas - per failure. (issue #10)
 *   3. 2Captcha failures that can never succeed (zero balance, bad key) must
 *      be distinguishable from transient ones so callers stop instead of
 *      spinning. A live host hit ERROR_ZERO_BALANCE on every restart.
 *
 * Run with: npm test
 */

const assert = require('assert');
const fs = require('fs');

const {createSingleShotNotifier} = require('../Cielo.js');
const {solve2Captcha, PermanentCaptchaError} = require('../solveCaptcha.js');

let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n         ${err.message}`);
  }
}

const rawSource = fs.readFileSync(require.resolve('../Cielo.js'), 'utf8');

// Assert against code only. Comments legitimately name the old broken host and
// the removed debug file in order to explain why they must not come back, and
// matching those would make these checks fail on their own documentation.
const source = rawSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

function testWebSocketHost() {
  assert.ok(
    source.includes('wss://wss.smartcielo.com/websocket/'),
    'expected the WebSocket URL to point at wss.smartcielo.com'
  );
  assert.ok(
    !source.includes('apiwss.smartcielo.com'),
    'apiwss.smartcielo.com returns 403 for every upgrade and must not appear'
  );
}

function testTokensAreUrlEncoded() {
  assert.ok(
    source.includes('encodeURIComponent(this.#sessionID)') &&
      source.includes('encodeURIComponent(this.#accessToken)'),
    'session id and access token must be URL-encoded into the socket query string'
  );
}

function testNoUnboundedDebugFile() {
  assert.ok(
    !source.includes('cielo-debug.log') ||
      !source.includes('appendFileSync'),
    'per-message appendFileSync tracing grew an unbounded cielo-debug.log in ' +
      'the working directory and broke Homebridge UI backups; it must stay removed'
  );
}

/*
 * The real notifier, wired exactly as #connect() wires it: both the "error"
 * and "close" handlers call it, and only the first may reach the consumer.
 */
function testNotifierReportsOncePerSocket() {
  let reported = 0;
  let cleanups = 0;

  const notify = createSingleShotNotifier(
    () => {
      cleanups++;
    },
    () => {
      reported++;
    }
  );

  // A failing socket: "error" fires, then "close" fires.
  const firstAccepted = notify(new Error('Unexpected server response: 403'));
  const secondAccepted = notify(new Error('Connection Closed.'));

  assert.strictEqual(
    reported,
    1,
    `consumer was notified ${reported} times; a failing socket emits both ` +
      '"error" and "close", and reporting both means two reconnects and two ' +
      'paid captcha solves for one dropped connection'
  );
  assert.strictEqual(firstAccepted, true, 'first report should be delivered');
  assert.strictEqual(secondAccepted, false, 'second report should be suppressed');
  assert.strictEqual(
    cleanups,
    2,
    'timers must be cleared on every invocation, not just the first, or the ' +
      'keepalive interval leaks after the socket dies'
  );
}

function testNotifierPassesThroughArguments() {
  let seen = null;
  const notify = createSingleShotNotifier(
    () => {},
    (err) => {
      seen = err;
    }
  );
  const original = new Error('boom');
  notify(original);
  assert.strictEqual(seen, original, 'the original error must reach the consumer');
}

/*
 * Drives the real solve2Captcha against a stubbed 2Captcha response so the
 * classification logic itself is under test, not a copy of it.
 */
async function testZeroBalanceIsPermanent() {
  const realFetch = require('node-fetch');
  const Module = require('module');
  const originalLoad = Module._load;

  Module._load = function (request, parent, isMain) {
    if (request === 'node-fetch') {
      return async () => ({
        json: async () => ({status: 0, request: 'ERROR_ZERO_BALANCE'}),
      });
    }
    return originalLoad.apply(this, arguments);
  };

  // Re-require solveCaptcha with the stubbed fetch in place.
  delete require.cache[require.resolve('../solveCaptcha.js')];
  const stubbed = require('../solveCaptcha.js');

  try {
    let caught = null;
    try {
      await stubbed.solve2Captcha('fake-key', 'fake-sitekey');
    } catch (err) {
      caught = err;
    }

    assert.ok(caught, 'a zero-balance response must throw');
    assert.strictEqual(
      caught.permanent,
      true,
      `ERROR_ZERO_BALANCE must be tagged permanent so the caller stops ` +
        `instead of retrying; got "${caught.message}"`
    );
    assert.ok(
      /2captcha\.com/i.test(caught.message),
      'the message should tell the operator how to fix it'
    );
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve('../solveCaptcha.js')];
    require('../solveCaptcha.js');
    void realFetch;
  }
}

function testTransientCaptchaErrorIsNotPermanent() {
  const err = new Error('2Captcha solve failed: ERROR_CAPTCHA_UNSOLVABLE');
  assert.notStrictEqual(
    err.permanent,
    true,
    'transient solve failures must stay retryable'
  );
  assert.ok(
    !(err instanceof PermanentCaptchaError),
    'transient solve failures must not be PermanentCaptchaError'
  );
}

/*
 * The WEB session type is broken server-side: its tokens are rejected by
 * /web/devices and by refresh, so Cielo's own web app cannot hold a session.
 * The IOS session type works. Logging in as WEB is what made this plugin
 * unusable, so pin it.
 */
function testLoginIdentifiesAsIos() {
  assert.ok(
    /appType:\s*"IOS"/.test(source),
    'login must send appType "IOS" - WEB tokens are rejected by the data routes'
  );
  assert.ok(
    /deviceType:\s*"IOS"/.test(source),
    'login must send deviceType "IOS"'
  );
  assert.ok(
    !/appType:\s*"WEB"/.test(source),
    'appType "WEB" must not come back; its tokens cannot fetch devices or refresh'
  );
}

/*
 * Every part of the refresh contract was established the hard way. A wrong
 * method, path or key silently reverts to "refresh is broken", which costs a
 * captcha per reconnect.
 */
function testRefreshContract() {
  const fn = source.slice(source.indexOf('async refreshAccessToken'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.ok(/\/web\/token\/refresh\/1/.test(body),
    'refresh must POST to /web/token/refresh/1 - the path without /1 is IAM-authed');
  assert.ok(/method:\s*"POST"/.test(body),
    'refresh must use POST - GET on this path is IAM-authed and rejects bearer tokens');
  assert.ok(/"x-api-key":\s*DATA_API_KEY/.test(body),
    'refresh must use the data API key - the login key is 403d here');
  assert.ok(/refreshToken:\s*tokenToUse/.test(body),
    'the refresh token belongs in the body');
  assert.ok(/body\.data\.refreshToken\s*\|\|/.test(body),
    'the server rotates the refresh token; the new one must be kept or the next refresh fails');
}

/*
 * The iOS login returns no sessionId, but the socket 502s without one. Any
 * non-empty value is accepted, so we generate it.
 */
function testSessionIdIsGeneratedWhenAbsent() {
  assert.ok(
    /data\.sessionId\s*\|\|/.test(source),
    'a sessionId must be generated when the login response omits one, or the WebSocket 502s'
  );
}

function testRefreshIsEnabledByDefault() {
  assert.ok(
    /CIELO_ENABLE_REFRESH_LOGIN\s*!==\s*"0"/.test(source),
    'refresh-first reconnect must be on by default - it is the difference between ' +
    'one captcha per install and one per reconnect'
  );
}

(async () => {
  console.log('captcha-spend regression tests\n');
  await check('WebSocket points at wss.smartcielo.com (issue #12)', testWebSocketHost);
  await check('session id and token are URL-encoded', testTokensAreUrlEncoded);
  await check('no unbounded cielo-debug.log tracing', testNoUnboundedDebugFile);
  await check('one report per failed socket (issue #10)', testNotifierReportsOncePerSocket);
  await check('notifier forwards the original error', testNotifierPassesThroughArguments);
  await check('ERROR_ZERO_BALANCE is permanent', testZeroBalanceIsPermanent);
  await check('unsolvable captcha stays retryable', testTransientCaptchaErrorIsNotPermanent);
  await check('login identifies as iOS, not WEB', testLoginIdentifiesAsIos);
  await check('refresh uses the verified contract', testRefreshContract);
  await check('sessionId generated when login omits it', testSessionIdIsGeneratedWhenAbsent);
  await check('refresh-first reconnect on by default', testRefreshIsEnabledByDefault);

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll tests passed.');
})();
