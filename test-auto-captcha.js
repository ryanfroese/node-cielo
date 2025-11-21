/**
 * Test script for automated captcha solving with 2Captcha
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. Sign up for 2Captcha:
 *    - Go to https://2captcha.com/
 *    - Create an account
 *    - Add funds (minimum $3, which gives you ~1,000 captcha solves)
 *    - Get your API key from the dashboard
 *
 * 2. Find the Cloudflare Turnstile siteKey:
 *    Option A - From browser DevTools:
 *      a. Open https://home.cielowigle.com in Chrome
 *      b. Open DevTools (F12) -> Network tab
 *      c. Refresh the page and look for requests to "challenges.cloudflare.com"
 *      d. Find the "sitekey" parameter in the URL (starts with "0x")
 *
 *    Option B - From page source:
 *      a. Right-click on page -> View Page Source
 *      b. Search for "cf-turnstile" or "data-sitekey"
 *      c. Copy the sitekey value
 *
 * 3. Set environment variables:
 *    export TWOCAPTCHA_API_KEY="your-api-key-here"
 *    export CIELO_TURNSTILE_SITEKEY="0x..."
 *
 * 4. Run this script:
 *    node test-auto-captcha.js
 *
 * COST: ~$0.003 per captcha solve (1,000 solves = $3)
 */

const {CieloAPIConnection} = require('./Cielo.js');

// Your Cielo credentials
const USERNAME = 'ryan.c.froese@gmail.com';
const PASSWORD = 'sBqs4jNR2FYmz@R';
const IP = '73.162.98.163';
const MAC_ADDRESS = 'C45BBEC42467';

(async () => {
  try {
    console.log('===========================================');
    console.log('  Cielo API - Automated Captcha Solving');
    console.log('===========================================');
    console.log('');

    // Check environment variables
    if (!process.env.TWOCAPTCHA_API_KEY) {
      console.error('❌ ERROR: TWOCAPTCHA_API_KEY environment variable not set!');
      console.error('');
      console.error('Get your API key from https://2captcha.com/ and set it:');
      console.error('  export TWOCAPTCHA_API_KEY="your-api-key-here"');
      console.error('');
      process.exit(1);
    }

    const siteKey = process.env.CIELO_RECAPTCHA_SITEKEY || '6Lewqu8nAAAAAOudyOyScwjI4dFukcDvJZprnZB6';

    console.log('✅ Environment variables configured');
    console.log(`   API Key: ${process.env.TWOCAPTCHA_API_KEY.substring(0, 10)}...`);
    console.log(`   SiteKey: ${siteKey}`);
    console.log('');

    // Create API instance
    const api = new CieloAPIConnection(
      (commandedState) => {
        console.log('📊 State Change:', JSON.stringify(commandedState, null, 2));
      },
      (roomTemperature) => {
        console.log(`🌡️  Temperature Update: ${roomTemperature}°`);
      },
      (err) => {
        console.error('❌ Error:', err.message);
      }
    );

    console.log('🤖 Starting automated login...');
    console.log('   This will:');
    console.log('   1. Submit captcha to 2Captcha service (~$0.003)');
    console.log('   2. Wait for solution (usually 10-30 seconds)');
    console.log('   3. Login to Cielo API with solved captcha');
    console.log('');

    const startTime = Date.now();

    // Use the new automated method - NO manual captcha needed!
    await api.establishConnectionWithAutoSolve(USERNAME, PASSWORD, IP);

    const loginTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`✅ Login successful! (took ${loginTime}s total)`);
    console.log('');

    console.log('📡 Subscribing to HVACs...');
    await api.subscribeToHVACs([MAC_ADDRESS]);
    console.log(`✅ Connected to ${api.hvacs.length} HVAC(s)`);
    console.log('');

    // Display HVAC status
    api.hvacs.forEach((hvac) => {
      console.log('📊 HVAC Status:');
      console.log(`   Name: ${hvac.getDeviceName()}`);
      console.log(`   MAC: ${hvac.getMacAddress()}`);
      console.log(`   Power: ${hvac.getPower()}`);
      console.log(`   Mode: ${hvac.getMode()}`);
      console.log(`   Temperature: ${hvac.getTemperature()}°`);
      console.log(`   Fan: ${hvac.getFanSpeed()}`);
      console.log(`   Room Temp: ${hvac.getRoomTemperature()}°`);
      console.log('');
    });

    console.log('🧪 Testing power toggle...');
    const currentPower = api.hvacs[0].getPower();

    if (currentPower === 'on') {
      console.log('   Turning OFF...');
      await api.hvacs[0].powerOff(api);
    } else {
      console.log('   Turning ON...');
      await api.hvacs[0].powerOn(api);
    }

    console.log('⏳ Waiting 5 seconds for state update...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('');
    console.log('===========================================');
    console.log('  ✅ Automated captcha solving works!');
    console.log('===========================================');
    console.log('');
    console.log('💡 For Apple Home integration:');
    console.log('   1. Use establishConnectionWithAutoSolve() for login');
    console.log('   2. Each login costs ~$0.003 (333 logins per $1)');
    console.log('   3. Tokens expire in ~60 minutes');
    console.log('   4. Consider caching connections to minimize cost');
    console.log('');
    console.log('💰 Cost estimate:');
    console.log('   - Reconnect every hour: ~$2.16/month');
    console.log('   - Reconnect every 4 hours: ~$0.54/month');
    console.log('   - Reconnect daily: ~$0.09/month');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error('');

    if (error.message.includes('2Captcha')) {
      console.error('💡 2Captcha issue - check your API key and account balance');
      console.error('   Visit https://2captcha.com/ to top up or check status');
    } else if (error.message.includes('TWOCAPTCHA_API_KEY')) {
      console.error('💡 Set your 2Captcha API key:');
      console.error('   export TWOCAPTCHA_API_KEY="your-api-key"');
    } else if (error.message.includes('CIELO_TURNSTILE_SITEKEY')) {
      console.error('💡 Set the Cloudflare Turnstile siteKey:');
      console.error('   export CIELO_TURNSTILE_SITEKEY="0x..."');
      console.error('   (See instructions at top of this file)');
    } else if (error.message.includes('forbidden') || error.message.includes('captcha')) {
      console.error('💡 Captcha issue - the siteKey might be incorrect');
      console.error('   Double-check the siteKey from https://home.cielowigle.com');
    } else {
      console.error('Full error:', error);
    }

    console.error('');
    process.exit(1);
  }
})();
