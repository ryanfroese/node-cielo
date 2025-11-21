/**
 * Test token refresh (no captcha needed!)
 *
 * This simulates how the iOS app stays logged in without needing captcha
 */

const fetch = require('node-fetch');

// Get these from a successful login
const REFRESH_TOKEN = process.argv[2];

if (!REFRESH_TOKEN) {
  console.log('❌ No refresh token provided!');
  console.log('');
  console.log('Usage: node test-refresh-token.js "<refresh-token>"');
  console.log('');
  console.log('Get a refresh token by:');
  console.log('1. Login with captcha using test-with-token.js');
  console.log('2. Copy the refreshToken from the login response');
  console.log('3. Use it here to get a new access token WITHOUT captcha!');
  process.exit(1);
}

async function testRefreshToken() {
  console.log('Testing token refresh (no captcha needed)...');
  console.log('Refresh token (first 50 chars):', REFRESH_TOKEN.substring(0, 50) + '...');
  console.log('');

  const response = await fetch(`https://api.smartcielo.com/web/token/refresh?refreshToken=${REFRESH_TOKEN}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'x-api-key': 'XiZ0PkwbNlQmu3Zrt7XV3EHBj1b1bHU9k02MSJW2',
      'authorization': REFRESH_TOKEN,
      'content-type': 'application/json; charset=utf-8',
    }
  });

  const data = await response.json();

  console.log('Response status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.status === 200 && data.data) {
    console.log('\n✅ SUCCESS! Got new access token WITHOUT captcha!');
    console.log('\nNew Access Token:', data.data.accessToken?.substring(0, 50) + '...');
    console.log('New Refresh Token:', data.data.refreshToken?.substring(0, 50) + '...');
    console.log('Expires In:', data.data.expiresIn);
    console.log('\n💡 This is how iOS app stays logged in!');
    console.log('   1. Login ONCE with captcha');
    console.log('   2. Save refresh token');
    console.log('   3. Use refresh endpoint forever (no captcha)');
  } else {
    console.log('\n❌ Token refresh failed');
    console.log('Refresh token may be expired or invalid');
  }
}

testRefreshToken().catch(console.error);
