#!/usr/bin/env node

/**
 * Test script to verify keepalive mechanisms
 * This helps us test without incrementing versions and publishing
 *
 * Extended version: Tests for 30 minutes with detailed monitoring
 */

// Load environment variables from .env file
require('dotenv').config();

const { CieloAPIConnection } = require('./Cielo.js');
const fs = require('fs');
const path = require('path');

// Load credentials from environment (now loaded from .env)
const username = process.env.CIELO_USERNAME;
const password = process.env.CIELO_PASSWORD;
const ip = process.env.CIELO_IP || '0.0.0.0';
const twocaptchaKey = process.env.TWOCAPTCHA_API_KEY;
const macAddresses = process.env.CIELO_MAC_ADDRESSES?.split(',') || [];

// Log file setup
const logFileName = `keepalive-test-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.log`;
const logFilePath = path.join(__dirname, logFileName);

function writeLog(message, alsoConsole = false) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFilePath, logEntry);
  if (alsoConsole) {
    console.log(message);
  }
}

// Initialize log file
fs.writeFileSync(logFilePath, `WebSocket Keepalive Test Log\n`);
fs.appendFileSync(logFilePath, `Started: ${new Date().toISOString()}\n`);
fs.appendFileSync(logFilePath, `${'='.repeat(70)}\n\n`);

// Intercept console.log to capture keepalive messages from Cielo.js
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function(...args) {
  const message = args.join(' ');
  // Log keepalive-related messages
  if (message.includes('[Keepalive')) {
    writeLog(message);
  }
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  const message = args.join(' ');
  // Log all errors
  if (message.includes('[Keepalive') || message.includes('WebSocket')) {
    writeLog(`ERROR: ${message}`);
  }
  originalConsoleError.apply(console, args);
};

if (!username || !password || !twocaptchaKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   CIELO_USERNAME, CIELO_PASSWORD, TWOCAPTCHA_API_KEY');
  console.error('');
  console.error('Usage:');
  console.error('   CIELO_USERNAME="your@email.com" \\');
  console.error('   CIELO_PASSWORD="yourpass" \\');
  console.error('   TWOCAPTCHA_API_KEY="your-key" \\');
  console.error('   CIELO_MAC_ADDRESSES="MAC1,MAC2" \\');
  console.error('   node test-keepalive.js');
  process.exit(1);
}

console.log('🧪 WebSocket Keepalive Test Script');
console.log('===================================');
console.log('Target: 30 minutes (2x the 15-minute disconnect threshold)');
console.log(`📄 Logging to: ${logFileName}`);
console.log('');

// Test statistics
let connectionActive = true;
let connectionTime;
let lastUpdate;
let stateUpdateCount = 0;
let temperatureUpdateCount = 0;
let lastMilestone = 0;

const api = new CieloAPIConnection(
  (commandedState) => {
    stateUpdateCount++;
    lastUpdate = new Date();
    const elapsed = Math.round((lastUpdate - connectionTime) / 1000);
    const message = `[${elapsed}s] 📊 State update #${stateUpdateCount} for device ${commandedState.mac_address}`;
    console.log(message);
    writeLog(`State update received: ${JSON.stringify(commandedState)}`);
  },
  (roomTemp) => {
    temperatureUpdateCount++;
    lastUpdate = new Date();
    const elapsed = Math.round((lastUpdate - connectionTime) / 1000);
    const message = `[${elapsed}s] 🌡️  Temperature update #${temperatureUpdateCount}: ${roomTemp}°C`;
    console.log(message);
    writeLog(`Temperature update: ${roomTemp}°C`);
  },
  (err) => {
    const elapsed = Math.round((new Date() - connectionTime) / 1000);
    console.error(`\n❌ [${elapsed}s] CONNECTION LOST:`, err.message);
    writeLog(`ERROR: Connection lost after ${elapsed}s: ${err.message}`);
    writeLog(`Error stack: ${err.stack}`);
    printStatistics(elapsed);
    connectionActive = false;
    process.exit(1);
  }
);

function printStatistics(elapsed) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const stats = [
    '\n📊 ========== TEST STATISTICS ==========',
    `⏱️  Connection Duration: ${minutes}m ${seconds}s`,
    `📊 State Updates Received: ${stateUpdateCount}`,
    `🌡️  Temperature Updates Received: ${temperatureUpdateCount}`,
    `📨 Total Messages Received: ${stateUpdateCount + temperatureUpdateCount}`,
  ];

  if (lastUpdate) {
    const timeSinceLastUpdate = Math.round((new Date() - lastUpdate) / 1000);
    stats.push(`⌚ Time Since Last Update: ${timeSinceLastUpdate}s`);
  }

  stats.push('');
  stats.push('📡 KEEPALIVE STRATEGIES THAT WERE ACTIVE:');
  stats.push('   ✓ Strategy 1: WebSocket ping/pong (every 5min)');
  stats.push('   ✓ Strategy 2: Application ping (every 7min)');
  stats.push('   ✓ Strategy 3: State query (every 10min)');
  stats.push('   ✓ Strategy 4: Heartbeat (every 8min)');
  stats.push('========================================\n');

  // Print to console
  stats.forEach(line => console.log(line));

  // Write to log file
  writeLog('\n' + '='.repeat(70));
  writeLog('TEST STATISTICS');
  writeLog('='.repeat(70));
  writeLog(`Connection Duration: ${minutes}m ${seconds}s`);
  writeLog(`State Updates: ${stateUpdateCount}`);
  writeLog(`Temperature Updates: ${temperatureUpdateCount}`);
  writeLog(`Total Messages: ${stateUpdateCount + temperatureUpdateCount}`);
  if (lastUpdate) {
    const timeSinceLastUpdate = Math.round((new Date() - lastUpdate) / 1000);
    writeLog(`Time Since Last Update: ${timeSinceLastUpdate}s`);
  }
  writeLog('\nKEEPALIVE STRATEGIES ACTIVE:');
  writeLog('  - WebSocket ping/pong (every 5min)');
  writeLog('  - Application ping (every 7min)');
  writeLog('  - State query (every 10min)');
  writeLog('  - Heartbeat (every 8min)');
  writeLog('='.repeat(70) + '\n');
}

async function runTest() {
  try {
    console.log('1️⃣  Connecting with auto-captcha solve...');
    writeLog('TEST START: Attempting connection with auto-captcha solve');
    const startTime = new Date();
    connectionTime = startTime;

    await api.establishConnectionWithAutoSolve(
      username,
      password,
      ip,
      undefined,
      { apiKey: twocaptchaKey }
    );

    const connectDuration = Math.round((new Date() - startTime) / 1000);
    console.log(`✅ Connected successfully in ${connectDuration}s at ${connectionTime.toLocaleTimeString()}`);
    writeLog(`Connection established in ${connectDuration}s`);
    console.log('');

    // Subscribe to devices
    console.log('2️⃣  Subscribing to HVAC devices...');
    await api.subscribeToHVACs(macAddresses.length > 0 ? macAddresses : undefined);
    console.log(`✅ Subscribed to ${api.hvacs.length} device(s)`);
    writeLog(`Subscribed to ${api.hvacs.length} device(s): ${api.hvacs.map(h => h.getMacAddress()).join(', ')}`);
    if (api.hvacs.length > 0) {
      console.log('   Devices:', api.hvacs.map(h => h.getMacAddress()).join(', '));
    }
    console.log('');

    console.log('3️⃣  Monitoring connection for 30 minutes...\n');

    console.log('📡 ACTIVE KEEPALIVE STRATEGIES:');
    console.log('   Strategy 1: WebSocket ping/pong - every 5 minutes');
    console.log('   Strategy 2: Application ping - every 7 minutes');
    console.log('   Strategy 3: State query - every 10 minutes');
    console.log('   Strategy 4: Heartbeat - every 8 minutes');
    console.log('');
    console.log('🎯 TEST PARAMETERS:');
    console.log('   • Critical milestone: 15 minutes (previous disconnect point)');
    console.log('   • Success target: 30 minutes (2x threshold)');
    console.log('   • Status check: Every minute');
    console.log('   • Press Ctrl+C to stop early\n');
    console.log('━'.repeat(70));
    console.log('');

    // Monitor connection status every minute
    const monitorInterval = setInterval(() => {
      if (!connectionActive) {
        clearInterval(monitorInterval);
        return;
      }

      const elapsed = Math.round((new Date() - connectionTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const timeSinceUpdate = lastUpdate ? Math.round((new Date() - lastUpdate) / 1000) : null;

      // Regular status update
      console.log(`⏱️  ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} alive | Updates: ${stateUpdateCount + temperatureUpdateCount} | Last: ${timeSinceUpdate ? timeSinceUpdate + 's ago' : 'none'}`);

      // Milestone warnings
      if (minutes === 10 && lastMilestone < 10) {
        console.log('');
        console.log('🎯 MILESTONE: 10 minutes - two-thirds to critical 15-minute mark');
        console.log('');
        writeLog('MILESTONE: 10 minutes - two-thirds to critical 15-minute mark');
        lastMilestone = 10;
      }

      if (minutes === 14 && lastMilestone < 14) {
        console.log('');
        console.log('⚠️  CRITICAL: 14 minutes - approaching previous disconnect point');
        console.log('   Next minute will show if WebSocket ping/pong keepalive works...');
        console.log('');
        writeLog('MILESTONE: 14 minutes - approaching previous 15-minute disconnect point');
        lastMilestone = 14;
      }

      if (minutes === 15 && lastMilestone < 15) {
        console.log('');
        console.log('🎉 BREAKTHROUGH: 15 minutes - SURVIVED the disconnect threshold!');
        console.log('   WebSocket ping/pong keepalive appears to be working!');
        console.log('');
        writeLog('MILESTONE: 15 minutes - SURVIVED the previous disconnect threshold!');
        writeLog('SUCCESS: Keepalive strategies appear to be working');
        lastMilestone = 15;
      }

      if (minutes === 20 && lastMilestone < 20) {
        console.log('');
        console.log('🎯 MILESTONE: 20 minutes - keepalive confirmed, 10 more to target');
        console.log('');
        writeLog('MILESTONE: 20 minutes - keepalive confirmed');
        lastMilestone = 20;
      }

      if (minutes === 25 && lastMilestone < 25) {
        console.log('');
        console.log('🎯 MILESTONE: 25 minutes - 5 minutes to complete success');
        console.log('');
        writeLog('MILESTONE: 25 minutes - approaching completion');
        lastMilestone = 25;
      }

      // Auto-complete at 30 minutes
      if (minutes >= 30) {
        console.log('');
        console.log('━'.repeat(70));
        console.log('');
        console.log('🎉🎉🎉 TEST COMPLETE - 30 MINUTES ACHIEVED! 🎉🎉🎉');
        console.log('');
        writeLog('TEST COMPLETE: 30 minutes achieved!');
        writeLog('RESULT: WebSocket keepalive is WORKING - all strategies successful');
        printStatistics(elapsed);
        console.log('✅ RESULT: WebSocket keepalive is WORKING!');
        console.log('   The ping/pong mechanism successfully prevents disconnection.');
        console.log('');
        console.log(`📄 Full test log saved to: ${logFileName}`);
        clearInterval(monitorInterval);
        process.exit(0);
      }
    }, 60000); // Every minute

  } catch (error) {
    console.error('❌ Test failed during setup:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  const elapsed = Math.round((new Date() - connectionTime) / 1000);
  const minutes = Math.floor(elapsed / 60);

  console.log('\n');
  console.log('━'.repeat(70));
  console.log('\n⚠️  Test interrupted by user (Ctrl+C)\n');

  writeLog('\nTest interrupted by user (Ctrl+C)');
  printStatistics(elapsed);

  // Determine test result
  let result = '';
  if (elapsed >= 1800) { // 30 minutes
    result = 'PASSED - Connection survived 30 minutes!';
    console.log(`✅ ${result}`);
    console.log('   WebSocket keepalive is fully functional.');
    writeLog(`RESULT: ${result}`);
  } else if (elapsed >= 960) { // 16 minutes
    result = 'PARTIAL SUCCESS - Connection survived past 15-minute threshold';
    console.log(`✅ ${result}`);
    console.log('   WebSocket ping/pong appears to be working.');
    console.log('   Recommend running full 30-minute test to confirm.');
    writeLog(`RESULT: ${result}`);
  } else if (elapsed >= 900) { // 15 minutes
    result = 'INCONCLUSIVE - Test stopped right at 15-minute mark';
    console.log(`⚠️  ${result}`);
    console.log('   Cannot confirm if keepalive works. Run test to 16+ minutes.');
    writeLog(`RESULT: ${result}`);
  } else {
    result = `INCOMPLETE - Only tested for ${minutes} minutes (need 16+)`;
    console.log(`❌ ${result}`);
    console.log(`   Only tested for ${minutes} minutes (need 16+ to verify keepalive).`);
    writeLog(`RESULT: ${result}`);
  }

  console.log('');
  console.log(`📄 Full test log saved to: ${logFileName}`);
  writeLog(`Test ended: ${new Date().toISOString()}`);
  process.exit(0);
});

runTest();
