/**
 * Interactive CLI test for Cielo API
 *
 * This script provides an interactive menu to test HVAC control.
 * It maintains a persistent connection and lets you:
 * - List available HVACs
 * - Select an HVAC to control
 * - Turn on/off
 * - Adjust temperature
 * - Change mode
 * - View status
 *
 * Usage: node test-interactive.js
 */

const readline = require('readline');
const { CieloConnectionManager } = require('./CieloConnectionManager.js');

// Your Cielo credentials
const USERNAME = 'ryan.c.froese@gmail.com';
const PASSWORD = 'sBqs4jNR2FYmz@R';
const IP = '73.162.98.163';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to ask questions
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Helper to pause
function pause() {
  return question('\nPress Enter to continue...');
}

// Clear screen
function clearScreen() {
  console.log('\x1Bc');
}

// Display header
function showHeader() {
  console.log('═══════════════════════════════════════');
  console.log('  Cielo HVAC Interactive Test');
  console.log('═══════════════════════════════════════');
  console.log('');
}

// Display HVAC list
function displayHvacList(hvacs) {
  console.log('\n📋 Available HVACs:\n');
  hvacs.forEach((hvac, index) => {
    const status = hvac.getPower() === 'on' ? '🟢 ON' : '⚪ OFF';
    console.log(`  ${index + 1}. ${hvac.getDeviceName()} (${hvac.getMacAddress()})`);
    console.log(`     Status: ${status} | Mode: ${hvac.getMode()} | Temp: ${hvac.getTemperature()}° | Room: ${hvac.getRoomTemperature()}°`);
    console.log('');
  });
}

// Display HVAC details
function displayHvacDetails(hvac) {
  const powerStatus = hvac.getPower() === 'on' ? '🟢 ON' : '⚪ OFF';

  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  ${hvac.getDeviceName().padEnd(36, ' ')}║`);
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  MAC Address: ${hvac.getMacAddress().padEnd(22, ' ')}║`);
  console.log(`║  Power:       ${powerStatus.padEnd(22, ' ')}║`);
  console.log(`║  Mode:        ${hvac.getMode().padEnd(22, ' ')}║`);
  console.log(`║  Temperature: ${(hvac.getTemperature() + '°').padEnd(22, ' ')}║`);
  console.log(`║  Fan Speed:   ${hvac.getFanSpeed().padEnd(22, ' ')}║`);
  console.log(`║  Room Temp:   ${(hvac.getRoomTemperature() + '°').padEnd(22, ' ')}║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');
}

// Main menu
async function showMainMenu(manager) {
  const hvacs = manager.getHvacs();

  if (hvacs.length === 0) {
    console.log('❌ No HVACs found. Make sure you subscribed to at least one device.');
    return null;
  }

  clearScreen();
  showHeader();
  displayHvacList(hvacs);

  console.log('Options:');
  console.log('  1-9: Select HVAC to control');
  console.log('  s:   Show status');
  console.log('  q:   Quit');
  console.log('');

  const choice = await question('Your choice: ');

  if (choice.toLowerCase() === 'q') {
    return 'quit';
  }

  if (choice.toLowerCase() === 's') {
    const status = manager.getStatus();
    console.log('\n📊 Connection Status:');
    console.log(`  Connected: ${status.isConnected ? '✅' : '❌'}`);
    console.log(`  HVACs: ${status.hvacCount}`);
    if (status.tokenExpiresAt) {
      const minutes = Math.round(status.timeUntilExpiry / 60000);
      console.log(`  Token expires in: ${minutes} minutes`);
    }
    await pause();
    return null;
  }

  const index = parseInt(choice) - 1;
  if (index >= 0 && index < hvacs.length) {
    return hvacs[index];
  }

  console.log('❌ Invalid choice');
  await pause();
  return null;
}

// Control menu for selected HVAC
async function showControlMenu(manager, hvac) {
  while (true) {
    // Get fresh API reference each time
    const api = manager.getApi();

    // Debug: Check if API has sendCommand method
    if (typeof api.sendCommand !== 'function') {
      console.error('⚠️  WARNING: API object does not have sendCommand method!');
      console.error('API type:', typeof api);
      console.error('API constructor:', api?.constructor?.name);
      console.error('API methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(api)));
    }
    clearScreen();
    showHeader();
    displayHvacDetails(hvac);

    console.log('What would you like to do?\n');
    console.log('  1. Turn ON');
    console.log('  2. Turn OFF');
    console.log('  3. Increase temperature (+1°)');
    console.log('  4. Decrease temperature (-1°)');
    console.log('  5. Set temperature');
    console.log('  6. Change mode');
    console.log('  7. Change fan speed');
    console.log('  d. Debug info');
    console.log('  r. Refresh status');
    console.log('  b. Back to main menu');
    console.log('');

    const choice = await question('Your choice: ');

    try {
      switch (choice.toLowerCase()) {
        case '1':
          console.log('\n🔄 Turning ON...');
          await hvac.powerOn(api);
          console.log('✅ Command sent! Waiting for confirmation...');
          await new Promise(r => setTimeout(r, 3000)); // Wait for state update
          break;

        case '2':
          console.log('\n🔄 Turning OFF...');
          await hvac.powerOff(api);
          console.log('✅ Command sent! Waiting for confirmation...');
          await new Promise(r => setTimeout(r, 3000));
          break;

        case '3': {
          const currentTemp = parseInt(hvac.getTemperature());
          const newTemp = currentTemp + 1;
          console.log(`\n🔄 Setting temperature to ${newTemp}°...`);
          await hvac.setTemperature(newTemp, api);
          console.log('✅ Command sent! Waiting for confirmation...');
          await new Promise(r => setTimeout(r, 3000));
          break;
        }

        case '4': {
          const currentTemp = parseInt(hvac.getTemperature());
          const newTemp = currentTemp - 1;
          console.log(`\n🔄 Setting temperature to ${newTemp}°...`);
          await hvac.setTemperature(newTemp, api);
          console.log('✅ Command sent! Waiting for confirmation...');
          await new Promise(r => setTimeout(r, 3000));
          break;
        }

        case '5': {
          const temp = await question('Enter temperature (60-90): ');
          const newTemp = parseInt(temp);
          if (newTemp >= 60 && newTemp <= 90) {
            console.log(`\n🔄 Setting temperature to ${newTemp}°...`);
            await hvac.setTemperature(newTemp, api);
            console.log('✅ Command sent! Waiting for confirmation...');
            await new Promise(r => setTimeout(r, 3000));
          } else {
            console.log('❌ Invalid temperature');
            await pause();
          }
          break;
        }

        case '6': {
          console.log('\nAvailable modes:');
          console.log('  1. auto');
          console.log('  2. cool');
          console.log('  3. heat');
          console.log('  4. dry');
          console.log('  5. fan');
          const modeChoice = await question('Select mode: ');
          const modes = ['auto', 'cool', 'heat', 'dry', 'fan'];
          const modeIndex = parseInt(modeChoice) - 1;
          if (modeIndex >= 0 && modeIndex < modes.length) {
            const mode = modes[modeIndex];
            console.log(`\n🔄 Setting mode to ${mode}...`);
            await hvac.setMode(mode, api);
            console.log('✅ Command sent! Waiting for confirmation...');
            await new Promise(r => setTimeout(r, 3000));
          } else {
            console.log('❌ Invalid mode');
            await pause();
          }
          break;
        }

        case '7': {
          console.log('\nAvailable fan speeds:');
          console.log('  1. auto');
          console.log('  2. low');
          console.log('  3. medium');
          console.log('  4. high');
          const fanChoice = await question('Select fan speed: ');
          const speeds = ['auto', 'low', 'medium', 'high'];
          const speedIndex = parseInt(fanChoice) - 1;
          if (speedIndex >= 0 && speedIndex < speeds.length) {
            const speed = speeds[speedIndex];
            console.log(`\n🔄 Setting fan speed to ${speed}...`);
            await hvac.setFanSpeed(speed, api);
            console.log('✅ Command sent! Waiting for confirmation...');
            await new Promise(r => setTimeout(r, 3000));
          } else {
            console.log('❌ Invalid fan speed');
            await pause();
          }
          break;
        }

        case 'd': {
          console.log('\n📊 Debug Info:');
          console.log(`  Current HVAC: ${hvac.getDeviceName()} (${hvac.getMacAddress()})`);
          console.log(`  Last State Update: ${lastStateUpdate ? JSON.stringify(lastStateUpdate, null, 2) : 'None'}`);
          console.log(`  Connection Status:`, manager.getStatus());
          console.log(`  API object type: ${typeof api}`);
          console.log(`  API has sendCommand: ${typeof api?.sendCommand}`);
          console.log(`  API constructor: ${api?.constructor?.name}`);
          console.log(`  API methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(api))}`);
          await pause();
          break;
        }

        case 'r':
          console.log('\n🔄 Refreshing...');
          await new Promise(r => setTimeout(r, 1000));
          break;

        case 'b':
          return;

        default:
          console.log('❌ Invalid choice');
          await pause();
      }

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      await pause();
    }
  }
}

// Main program
async function main() {
  console.log('Starting Cielo Interactive Test...\n');

  // Check environment
  if (!process.env.TWOCAPTCHA_API_KEY) {
    console.error('❌ TWOCAPTCHA_API_KEY not set!');
    console.error('Run: export TWOCAPTCHA_API_KEY="your-key"');
    process.exit(1);
  }

  // Create connection manager
  let lastStateUpdate = null;

  const manager = new CieloConnectionManager(USERNAME, PASSWORD, IP, {
    onStateChange: (state) => {
      // Store the last state update so we can see it
      lastStateUpdate = {
        time: new Date().toLocaleTimeString(),
        macAddress: state.mac_address,
        power: state.action?.power,
        mode: state.action?.mode,
        temp: state.action?.temp,
      };
      // Uncomment to debug:
      // console.log('\n[State Update]', lastStateUpdate);
    },
    onTemperature: (temp) => {
      // Silent
    },
    onError: (err) => {
      console.error('\n⚠️  Error:', err.message);
    },
    autoReconnect: true,
    healthCheckInterval: 120000, // Check every 2 minutes
  });

  try {
    // Connect and discover HVACs
    console.log('🔌 Connecting to Cielo API (this will solve captcha automatically)...');
    await manager.connect();

    console.log('\n📡 Discovering HVACs...');
    const api = manager.getApi();

    // Get all devices
    const devices = await api.getAllDevices();
    const macAddresses = devices.map(d => d.macAddress);

    console.log(`Found ${devices.length} device(s)`);

    if (macAddresses.length === 0) {
      console.log('❌ No devices found on your account.');
      manager.disconnect();
      rl.close();
      return;
    }

    // Subscribe to all devices
    await manager.subscribeToHvacs(macAddresses);

    console.log(`✅ Connected to ${manager.getHvacs().length} HVAC(s)`);
    await pause();

    // Main loop
    while (true) {
      const result = await showMainMenu(manager);

      if (result === 'quit') {
        break;
      }

      if (result) {
        // User selected an HVAC
        await showControlMenu(manager, result);
      }
    }

    // Cleanup
    console.log('\n👋 Disconnecting...');
    manager.disconnect();

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    if (manager) {
      manager.disconnect();
    }
  }

  rl.close();
  console.log('\nGoodbye! 👋\n');
  process.exit(0);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Interrupted. Exiting...\n');
  rl.close();
  process.exit(0);
});

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
