#!/usr/bin/env node
/*
 * Regression tests for the deviceTypeVersion sent in command payloads.
 *
 * The server silently ignores an actionControl frame whose deviceTypeVersion
 * does not match the unit: no error, no StateUpdate, the socket stays up. The
 * constructor used to accept only BI* and BP* and replace anything else with
 * BP01, so a Breez Eco (BB12) displayed state correctly but never obeyed a
 * command.
 *
 * Run with: npm test
 */

const assert = require('assert');

const {CieloHVAC} = require('../Cielo.js');

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

function typeFor(deviceTypeVersion) {
  return new CieloHVAC('083A8D22F5A4', 'HVAC', 1829, '3.0.0,3.0.0', deviceTypeVersion)
    .getDeviceTypeVersion();
}

console.log('deviceTypeVersion regression tests\n');
check('BI types pass through', () => assert.strictEqual(typeFor('BI04'), 'BI04'));
check('BP types pass through', () => assert.strictEqual(typeFor('BP01'), 'BP01'));
check('BB types pass through (Breez Eco)', () => assert.strictEqual(typeFor('BB12'), 'BB12'));
check('missing type falls back to BP01', () => {
  assert.strictEqual(typeFor(undefined), 'BP01');
  assert.strictEqual(typeFor(''), 'BP01');
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll tests passed.');
