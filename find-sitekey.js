/**
 * Helper script to find the Cloudflare Turnstile siteKey
 *
 * This script fetches the Cielo login page and tries to extract the siteKey automatically.
 * If it can't find it automatically, it will show you how to find it manually.
 */

const fetch = require('node-fetch');

async function findSiteKey() {
  console.log('🔍 Searching for Cloudflare Turnstile siteKey...');
  console.log('');

  try {
    // Fetch the login page
    const response = await fetch('https://home.cielowigle.com');
    const html = await response.text();

    // Try to find siteKey in various ways
    const patterns = [
      /data-sitekey="([^"]+)"/i,
      /sitekey["\s:=]+["']([0-9a-zA-Z_-]+)["']/i,
      /"sitekey"[:\s]+"([^"]+)"/i,
      /siteKey["\s:=]+["']([0-9a-zA-Z_-]+)["']/i,
    ];

    let siteKey = null;

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[1].startsWith('0x')) {
        siteKey = match[1];
        break;
      }
    }

    if (siteKey) {
      console.log('✅ Found siteKey automatically!');
      console.log('');
      console.log('SiteKey:', siteKey);
      console.log('');
      console.log('Set it now:');
      console.log(`export CIELO_TURNSTILE_SITEKEY="${siteKey}"`);
      console.log('');
    } else {
      console.log('⚠️  Could not find siteKey automatically in the HTML.');
      console.log('');
      console.log('The siteKey is loaded dynamically via JavaScript.');
      console.log('You need to find it manually using Chrome DevTools.');
      console.log('');
      showManualInstructions();
    }

  } catch (error) {
    console.error('❌ Error fetching page:', error.message);
    console.log('');
    showManualInstructions();
  }
}

function showManualInstructions() {
  console.log('📋 MANUAL INSTRUCTIONS:');
  console.log('');
  console.log('1. Open Chrome browser');
  console.log('2. Go to: https://home.cielowigle.com');
  console.log('3. Press F12 to open DevTools');
  console.log('4. Click the "Network" tab');
  console.log('5. Check "Preserve log" checkbox');
  console.log('6. Refresh the page (Ctrl+R or Cmd+R)');
  console.log('7. In the filter box, type: turnstile OR cloudflare');
  console.log('8. Look for requests to challenges.cloudflare.com');
  console.log('9. Click on any of those requests');
  console.log('10. Look in the request URL or Headers for "sitekey"');
  console.log('11. The sitekey starts with "0x" followed by letters/numbers');
  console.log('');
  console.log('Alternative method:');
  console.log('1. Right-click on the page → "Inspect Element"');
  console.log('2. Press Ctrl+F (Cmd+F on Mac) to search');
  console.log('3. Search for: cf-turnstile');
  console.log('4. Look for data-sitekey attribute');
  console.log('');
  console.log('Once you find it, set the environment variable:');
  console.log('export CIELO_TURNSTILE_SITEKEY="0x..."');
  console.log('');
}

findSiteKey();
