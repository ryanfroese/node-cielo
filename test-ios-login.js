/**
 * Test if iOS appType bypasses captcha requirement
 */

const fetch = require('node-fetch');
const crypto = require('crypto');


require('dotenv').config();

// Credentials come from the environment (see .env.example). They were
// previously hardcoded here and leaked to a public repo and to every
// published npm tarball; never inline them again.
const USERNAME = process.env.CIELO_USERNAME;
const PASSWORD = process.env.CIELO_PASSWORD;
const IP = process.env.CIELO_IP || '0.0.0.0';
const TWOCAPTCHA_API_KEY = process.env.TWOCAPTCHA_API_KEY;

if (!USERNAME || !PASSWORD) {
  console.error('Set CIELO_USERNAME and CIELO_PASSWORD in .env (copy .env.example).');
  process.exit(1);
}

async function testIOSLogin() {
  const hashedPassword = crypto.createHash('sha256').update(PASSWORD).digest('hex');

  const loginPayload = {
    user: {
      userId: USERNAME,
      password: hashedPassword,
      mobileDeviceId: "IOS_TEST_DEVICE",
      deviceTokenId: "IOS_TEST_TOKEN",
      appType: "IOS",  // Pretend to be iOS app
      appVersion: "5.0.4",  // Latest iOS version from API
      timeZone: "America/Los_Angeles",
      mobileDeviceName: "iPhone",
      deviceType: "IOS",
      ipAddress: IP,
      isSmartHVAC: 0,
      locale: "en"
    }
    // NO captchaToken!
  };

  console.log('Testing login as iOS app (without captcha)...');
  console.log('Request payload:', JSON.stringify(loginPayload, null, 2));

  const response = await fetch('https://api.smartcielo.com/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'x-api-key': 'XiZ0PkwbNlQmu3Zrt7XV3EHBj1b1bHU9k02MSJW2',
      'accept': 'application/json, text/plain, */*',
    },
    body: JSON.stringify(loginPayload)
  });

  const data = await response.json();

  console.log('\nResponse status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (data.status === 200) {
    console.log('\n✅ SUCCESS! iOS login works WITHOUT captcha!');
    console.log('\nAccess Token:', data.data.user.accessToken.substring(0, 50) + '...');
    console.log('Session ID:', data.data.user.sessionId);
    console.log('Refresh Token:', data.data.user.refreshToken.substring(0, 50) + '...');
    console.log('Expires In:', data.data.user.expiresIn);
    console.log('\n💡 This means you can bypass captcha by using appType: "IOS"!');
  } else {
    console.log('\n❌ Failed. Error:', data.error || data.message);
    if (data.error?.message === 'forbidden' || data.message?.includes('captcha')) {
      console.log('\n⚠️  iOS apps still require captcha (or this approach doesn\'t work)');
    }
  }
}

testIOSLogin().catch(console.error);
