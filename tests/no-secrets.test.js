#!/usr/bin/env node
/*
 * Fails the build if a credential is hardcoded in a tracked file, or if a file
 * that reads credentials would be published to npm.
 *
 * This exists because it already happened: a plaintext Cielo password sat in
 * four tracked test scripts for roughly nine months in a public repository,
 * and .npmignore deliberately kept one of them (test-interactive.js) in the
 * package, so it shipped inside every published tarball. Both the password and
 * a live 2Captcha API key had to be rotated.
 *
 * Run with: npm test
 */

const assert = require('assert');
const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n         ${err.message}`);
  }
}

const tracked = execSync('git ls-files', {cwd: root, encoding: 'utf8'})
  .split('\n')
  .filter((f) => f && /\.(js|json|md|txt|sh|ya?ml)$/.test(f));

/*
 * Assignments of a credential-ish name to a non-empty string literal. Reading
 * from process.env is the correct pattern and must not trip this.
 */
const ASSIGNMENT = new RegExp(
  String.raw`\b(password|passwd|api[_-]?key|apikey|secret|token)\b\s*[:=]\s*['"\`]([^'"\`]{6,})['"\`]`,
  'i'
);

// Values that are obviously not real credentials.
const PLACEHOLDER = /^(your|my|test|example|dummy|fake|changeme|xxx|<|\$\{|process\.env|\.\.\.|redacted|none|null|undefined|placeholder|paste)/i;

/*
 * Cielo's own public API keys, lifted from their web bundle. These are not
 * user secrets - every client must send one, and they are served to anyone who
 * loads home.cielowigle.com. They are allowed to appear in source.
 */
const VENDOR_PUBLIC_KEYS = new Set([
  'XiZ0PkwbNlQmu3Zrt7XV3EHBj1b1bHU9k02MSJW2',
  '7xTAU4y4B34u8DjMsODlEyprRRQEsbJ3IB7vZie4',
  'wJouJUSVk83bW80PfM8Niao3QMuJBsbOUorJC2af',
  'Fr9ZVRxvJB22rNAvndQVi3yGssx1gIZhazrlH1QS',
  '6Lewqu8nAAAAAOudyOyScwjI4dFukcDvJZprnZB6', // reCAPTCHA site key (public by design)
]);

function scan(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const bad = [];
  text.split('\n').forEach((line, i) => {
    // Reading from the environment is the correct pattern.
    if (/process\.env/.test(line)) {
      return;
    }
    // Log statements routinely contain labels like "Access Token:", which are
    // not assignments however much they look like one to a regex.
    if (/\bconsole\.(log|error|warn|info|debug)\s*\(/.test(line)) {
      return;
    }
    const m = ASSIGNMENT.exec(line);
    if (!m) {
      return;
    }
    const value = m[2].trim();
    if (PLACEHOLDER.test(value) || VENDOR_PUBLIC_KEYS.has(value)) {
      return;
    }
    // Real credentials are opaque tokens. Anything containing code punctuation
    // is a fragment of an expression the regex ran across, not a secret.
    if (/[(),+\s]/.test(value)) {
      return;
    }
    // Ignore bare header/field names, e.g. "x-api-key".
    if (/^[A-Za-z-]+$/.test(value) && value.length < 12) {
      return;
    }
    bad.push(`${file}:${i + 1}  ${m[1]} = <${value.length} chars>`);
  });
  return bad;
}

check('no hardcoded credentials in tracked files', () => {
  const found = tracked.flatMap(scan);
  assert.strictEqual(
    found.length,
    0,
    'hardcoded credential(s) found - read them from process.env instead:\n         ' +
      found.join('\n         ')
  );
});

check('no credential-reading file is publishable', () => {
  const listed = execSync('npm pack --dry-run --json', {cwd: root, encoding: 'utf8'});
  const files = JSON.parse(listed)[0].files.map((f) => f.path);
  const risky = files.filter((f) => /^(test-|tests\/|demo\.js|\.env)/.test(f));
  assert.strictEqual(
    risky.length,
    0,
    'these would be published and may read credentials: ' + risky.join(', ')
  );
});

check('.env is gitignored', () => {
  let ignored = true;
  try {
    execSync('git check-ignore -q .env', {cwd: root});
  } catch (e) {
    ignored = false;
  }
  assert.ok(ignored, '.env must be gitignored so local credentials cannot be committed');
});

check('.env is not tracked', () => {
  assert.ok(
    !tracked.includes('.env'),
    '.env is tracked by git - remove it from the index and rotate anything it contained'
  );
});

if (failures > 0) {
  console.error(`\n${failures} secret-scan check(s) failed`);
  process.exit(1);
}
console.log('\nSecret scan clean.');
