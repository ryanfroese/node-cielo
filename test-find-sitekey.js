/**
 * Test script to help find the siteKey by trying common patterns
 */

const fetch = require('node-fetch');

const COMMON_SITEKEYS = [
  '0x4AAAAAAADnPIDROzqa0Azq', // Cloudflare test (always passes)
  '0x4AAAAAAA-DnPIDROzqa0Azq', // Cloudflare test variant
  '0x4AAAAAAADBBEhIlkAAAABc', // Cloudflare test (always fails)
];

async function testSiteKey(apiKey, siteKey) {
  console.log(`Testing siteKey: ${siteKey}...`);

  const submitUrl = `https://2captcha.com/in.php?key=${apiKey}&method=turnstile&sitekey=${siteKey}&pageurl=https://home.cielowigle.com&json=1`;

  try {
    const response = await fetch(submitUrl);
    const result = await response.json();

    console.log(`  Response: ${JSON.stringify(result)}`);

    if (result.status === 1) {
      console.log(`  ✅ SiteKey accepted! Captcha ID: ${result.request}`);
      return true;
    } else {
      console.log(`  ❌ Error: ${result.request}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('  SiteKey Tester');
  console.log('========================================');
  console.log('');

  const apiKey = process.env.TWOCAPTCHA_API_KEY;

  if (!apiKey) {
    console.error('❌ TWOCAPTCHA_API_KEY not set');
    console.error('Run: export TWOCAPTCHA_API_KEY="your-key"');
    process.exit(1);
  }

  console.log(`API Key: ${apiKey.substring(0, 10)}...`);
  console.log('');

  console.log('Testing common siteKeys...');
  console.log('');

  for (const siteKey of COMMON_SITEKEYS) {
    await testSiteKey(apiKey, siteKey);
    console.log('');
  }

  console.log('========================================');
  console.log('');
  console.log('If none worked, we need to find the real siteKey.');
  console.log('Try the inspect element method from find-sitekey-detailed.md');
  console.log('');
}

main();
