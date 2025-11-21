// Paste this entire code block into Chrome Console at https://home.cielowigle.com
// It will try multiple methods to find the Cloudflare Turnstile siteKey

(function findSiteKey() {
  console.log('🔍 Searching for Cloudflare Turnstile siteKey...\n');

  // Method 1: Check for data-sitekey attribute
  const element1 = document.querySelector('[data-sitekey]');
  if (element1) {
    const siteKey = element1.getAttribute('data-sitekey');
    console.log('✅ Found via data-sitekey attribute:', siteKey);
    return siteKey;
  }

  // Method 2: Check for cf-turnstile elements
  const element2 = document.querySelector('.cf-turnstile, [class*="turnstile"]');
  if (element2) {
    const siteKey = element2.getAttribute('data-sitekey');
    if (siteKey) {
      console.log('✅ Found via cf-turnstile class:', siteKey);
      return siteKey;
    }
  }

  // Method 3: Check all iframes (Turnstile loads in iframe)
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    const src = iframe.src;
    if (src && src.includes('challenges.cloudflare.com')) {
      const match = src.match(/sitekey=([^&]+)/);
      if (match) {
        console.log('✅ Found in iframe src:', match[1]);
        return match[1];
      }
    }
  }

  // Method 4: Check window/global objects for Turnstile config
  if (window.turnstile) {
    console.log('Found window.turnstile object:', window.turnstile);
  }

  // Method 5: Search all script tags for siteKey
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent || script.innerHTML;
    const match = text.match(/sitekey["\s:=]+["']?(0x[0-9A-Za-z_-]+)["']?/i);
    if (match) {
      console.log('✅ Found in script tag:', match[1]);
      return match[1];
    }
  }

  console.log('❌ Could not find siteKey automatically.');
  console.log('\n📋 Next steps:');
  console.log('1. Click the Network tab in DevTools');
  console.log('2. Refresh this page (Cmd+R or Ctrl+R)');
  console.log('3. In the filter box, type: cloudflare');
  console.log('4. Click on any request to challenges.cloudflare.com');
  console.log('5. Look for "sitekey=" in the URL');
  console.log('\nOR try logging in and check the Network tab for the captcha token request.');

  return null;
})();
