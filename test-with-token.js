/**
 * Test script for Cielo API with manual captcha token
 *
 * Usage:
 * 1. Get a fresh captcha token (instructions below)
 * 2. Run: node test-with-token.js "<your-captcha-token>"
 */

const {CieloAPIConnection} = require('./Cielo.js');

// Your credentials
const USERNAME = 'ryan.c.froese@gmail.com';
const PASSWORD = 'sBqs4jNR2FYmz@R';
const IP = '73.162.98.163';
const MAC_ADDRESS = 'C45BBEC42467';

// Get token from command line
const captchaToken = process.argv[2];

if (!captchaToken) {
  console.log('❌ No captcha token provided!');
  console.log('');
  console.log('How to get a fresh token:');
  console.log('1. Open https://home.cielowigle.com in Chrome');
  console.log('2. Open DevTools (F12) -> Network tab');
  console.log('3. Clear network log');
  console.log('4. Enter your credentials and click LOGIN');
  console.log('5. Click on the "/auth/login" request in Network tab');
  console.log('6. Go to "Payload" tab');
  console.log('7. Copy the entire "captchaToken" value');
  console.log('8. Run: node test-with-token.js "<paste-token-here>"');
  console.log('');
  process.exit(1);
}

console.log('Testing Cielo API with captcha token...');
console.log(`Token length: ${captchaToken.length} characters`);
console.log('');

(async () => {
  try {
    const api = new CieloAPIConnection(
      (commandedState) => {
        console.log('✅ State Change:', JSON.stringify(commandedState, null, 2));
      },
      (roomTemperature) => {
        console.log('🌡️  Temperature Update:', roomTemperature);
      },
      (err) => {
        console.error('❌ Error:', err.message);
      }
    );

    console.log('🔐 Logging in...');
    await api.establishConnection(USERNAME, PASSWORD, IP, undefined, captchaToken);
    console.log('✅ Login successful!');
    console.log('');

    console.log('📡 Subscribing to HVACs...');
    await api.subscribeToHVACs([MAC_ADDRESS]);
    console.log(`✅ Connected to ${api.hvacs.length} HVAC(s)`);
    console.log('');

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
    console.log('✅ Basic test complete! The API is working correctly.');
    console.log('');

    // Test refresh token (iOS app pattern)
    console.log('🔄 Testing Refresh Token (iOS app pattern)...');
    console.log('');

    const refreshToken = api.getRefreshToken();
    const expiresIn = api.getExpiresIn();
    const expiresDate = new Date(expiresIn * 1000);

    console.log('📝 Token Info:');
    console.log(`   Refresh Token (first 50 chars): ${refreshToken.substring(0, 50)}...`);
    console.log(`   Access Token Expires: ${expiresDate.toLocaleString()}`);
    console.log(`   Time until expiration: ${Math.round((expiresIn - Date.now()/1000) / 60)} minutes`);
    console.log('');

    console.log('⏳ Waiting 3 seconds, then refreshing access token...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔄 Calling refreshAccessToken() - NO CAPTCHA NEEDED!');
    await api.refreshAccessToken();

    const newExpiresIn = api.getExpiresIn();
    const newExpiresDate = new Date(newExpiresIn * 1000);

    console.log('✅ Token refreshed successfully!');
    console.log(`   New Access Token Expires: ${newExpiresDate.toLocaleString()}`);
    console.log(`   New Time until expiration: ${Math.round((newExpiresIn - Date.now()/1000) / 60)} minutes`);
    console.log('');

    console.log('🎉 All tests passed!');
    console.log('');
    console.log('💡 For Apple Home integration:');
    console.log('   1️⃣  Login ONCE with captcha token (one-time setup)');
    console.log('   2️⃣  Save the refresh token: api.getRefreshToken()');
    console.log('   3️⃣  For all future connections: api.refreshAccessToken(savedToken)');
    console.log('   4️⃣  No captcha needed after initial setup!');
    console.log('');
    console.log('💾 Save this refresh token for testing:');
    console.log(`   ${api.getRefreshToken()}`);

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error('');

    if (error.message.includes('forbidden')) {
      console.error('The captcha token has expired. Get a fresh one and try again.');
    } else if (error.message.includes('captcha')) {
      console.error('Captcha token issue. Make sure you copied the ENTIRE token.');
    } else {
      console.error('Full error:', error);
    }

    process.exit(1);
  }
})();
