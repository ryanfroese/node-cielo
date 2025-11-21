# Finding the Cloudflare Turnstile SiteKey - Detailed Guide

## Method 1: Inspect the Captcha Element Directly

When the captcha is visible on the page:

1. **Right-click directly on the captcha checkbox**
2. Select **"Inspect"** or **"Inspect Element"**
3. In the Elements panel that opens, you should see something like:
   ```html
   <div class="cf-turnstile" data-sitekey="0x...">
   ```
   OR it might be nested in an iframe or parent element
4. Look for `data-sitekey` attribute on the element or its parents
5. The value starting with `0x` is your siteKey

## Method 2: Network Tab - Look for Different Patterns

1. Open DevTools → **Network** tab
2. Check **"Preserve log"**
3. Clear the network log (trash icon)
4. **Refresh the page completely** (Cmd+Shift+R or Ctrl+Shift+R for hard refresh)
5. Try filtering for these terms one at a time:
   - `turnstile`
   - `api.js`
   - `challenges`
   - `cdn.cgi`
6. Look for requests to domains like:
   - `challenges.cloudflare.com`
   - `*.cloudflareinsights.com`
7. Click on those requests and check:
   - Request URL
   - Request Headers
   - Response Headers
   - Look for `sitekey` parameter

## Method 3: Check the Page Source for Turnstile Script

1. Press **Cmd+U** (or **Ctrl+U**) to view page source
2. Press **Cmd+F** (or **Ctrl+F**) to search
3. Search for: `turnstile`
4. Look for script tags like:
   ```html
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
   ```
5. Or search for `0x4` (most Cloudflare siteKeys start with 0x4)

## Method 4: Console - Wait for Captcha to Load

```javascript
// Paste this, then DO NOT click anything for 5 seconds
setTimeout(() => {
  const turnstileDiv = document.querySelector('div[class*="turnstile"], div[id*="turnstile"], iframe[src*="cloudflare"]');
  if (turnstileDiv) {
    console.log('Found element:', turnstileDiv);
    console.log('Parent HTML:', turnstileDiv.parentElement.outerHTML);

    // Check all attributes
    for (let attr of turnstileDiv.attributes || []) {
      console.log(`${attr.name}: ${attr.value}`);
    }
  }

  // Check all iframes
  document.querySelectorAll('iframe').forEach((iframe, i) => {
    console.log(`\nIframe ${i}:`);
    console.log('  src:', iframe.src);
    console.log('  id:', iframe.id);
    console.log('  class:', iframe.className);
  });
}, 5000);
```

Wait 5 seconds and check the console output.

## Method 5: Actually Login and Check the Token Request

This is the most reliable method:

1. Open DevTools → **Network** tab
2. Check **"Preserve log"**
3. Filter by **"Fetch/XHR"** (click the button at top of Network tab)
4. **Enter your username and password**
5. **Click LOGIN button**
6. Watch the Network tab - you should see a request to `/auth/login`
7. Click on that request
8. Go to **"Payload"** or **"Request"** tab
9. Look at the `captchaToken` value
10. The captcha token format might give us clues

## Method 6: Use a Known Working Token to Test

Since we already have working captcha tokens from your previous tests, we could:

1. Try common Cloudflare Turnstile siteKeys for testing
2. Use 2Captcha's test mode first
3. Monitor what siteKey 2Captcha discovers when solving

Common Cloudflare test siteKeys:
- `0x4AAAAAAADnPIDROzqa0Azq` (always passes)
- `0x4AAAAAAADBBEhIlkAAAABc` (always fails - for testing)

