/**
 * Captcha solving module for Cielo API
 *
 * Since Cielo requires a reCAPTCHA v2 captcha token and tokens expire quickly,
 * this module provides automated solving via 2Captcha service.
 *
 * SETUP:
 * 1. Sign up at https://2captcha.com/
 * 2. Add funds ($3 for ~1,000 solves)
 * 3. Get your API key from the dashboard
 * 4. Find the reCAPTCHA siteKey (instructions below)
 *
 * HOW TO FIND THE SITEKEY:
 * 1. Open https://home.cielowigle.com in Chrome
 * 2. Right-click on the captcha checkbox -> Inspect
 * 3. Look for an iframe with src containing "google.com/recaptcha"
 * 4. Find the "k=" parameter in the iframe URL
 * 5. That's your siteKey (e.g., 6Lewqu8nAAAAAOudyOyScwjI4dFukcDvJZprnZB6)
 *
 * KNOWN SITEKEY for Cielo: 6Lewqu8nAAAAAOudyOyScwjI4dFukcDvJZprnZB6
 */

const fetch = require('node-fetch');

/**
 * Solve reCAPTCHA v2 captcha using 2Captcha service
 *
 * @param {string} apiKey Your 2Captcha API key
 * @param {string} siteKey The reCAPTCHA siteKey from Cielo's page
 * @param {Object} options Optional configuration
 * @param {string} options.pageUrl The page URL where the captcha appears (default: https://home.cielowigle.com)
 * @param {number} options.pollingInterval How often to check for results in ms (default: 5000)
 * @param {number} options.timeout Maximum time to wait in ms (default: 180000 = 3 minutes)
 * @returns {Promise<string>} The captcha token
 */
/**
 * Helper function to retry network requests with exponential backoff
 */
async function fetchWithRetry(url, maxRetries = 3, initialDelay = 2000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      lastError = error;

      // Check if it's a network/DNS error that's worth retrying
      const isNetworkError = error.message.includes('EAI_AGAIN') ||
                            error.message.includes('ENOTFOUND') ||
                            error.message.includes('ETIMEDOUT') ||
                            error.message.includes('ECONNREFUSED');

      if (isNetworkError && attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[2Captcha] Network error (${error.message.split(',')[0]}) - retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry non-network errors or if we've exhausted retries
      throw error;
    }
  }

  throw lastError;
}

async function solve2Captcha(apiKey, siteKey, options = {}) {
  const pageUrl = options.pageUrl || 'https://home.cielowigle.com';
  const pollingInterval = options.pollingInterval || 5000;
  const timeout = options.timeout || 180000; // 3 minutes

  if (!apiKey) {
    throw new Error('2Captcha API key is required. Sign up at https://2captcha.com/');
  }

  if (!siteKey) {
    throw new Error('reCAPTCHA siteKey is required. See instructions in solveCaptcha.js');
  }

  console.log('[2Captcha] Submitting captcha to 2Captcha service...');

  // Submit captcha to 2Captcha using reCAPTCHA v2 method with retry
  const submitUrl = `https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`;

  const submitResponse = await fetchWithRetry(submitUrl);

  if (submitResponse.status !== 1) {
    throw new Error(`2Captcha submission failed: ${submitResponse.request}`);
  }

  const captchaId = submitResponse.request;
  console.log(`[2Captcha] Captcha submitted. ID: ${captchaId}`);
  console.log('[2Captcha] Waiting for solution (this usually takes 10-30 seconds)...');

  // Wait before first check (captchas typically take 10-30 seconds)
  await new Promise(resolve => setTimeout(resolve, 10000));

  const startTime = Date.now();
  let attempts = 0;

  // Poll for result
  while (Date.now() - startTime < timeout) {
    attempts++;

    const resultUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`;
    const result = await fetchWithRetry(resultUrl);

    if (result.status === 1) {
      console.log(`[2Captcha] ✅ Captcha solved! (took ${attempts} attempts, ${Math.round((Date.now() - startTime) / 1000)}s)`);
      return result.request; // This is the captcha token
    }

    if (result.request === 'CAPCHA_NOT_READY') {
      // Still processing, continue polling
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
      continue;
    }

    // Any other response is an error
    throw new Error(`2Captcha error: ${result.request}`);
  }

  throw new Error(`2Captcha timeout after ${timeout}ms`);
}

/**
 * Manual method: Extract captcha token from browser DevTools
 *
 * Instructions:
 * 1. Open https://home.cielowigle.com in Chrome
 * 2. Open DevTools (F12) -> Network tab
 * 3. Filter for "/auth/login"
 * 4. Enter your credentials and click login
 * 5. Click on the "login" request in Network tab
 * 6. Go to "Payload" or "Request" tab
 * 7. Copy the "captchaToken" value
 * 8. Paste it here
 *
 * @param {string} token The manually extracted token
 * @returns {string} The token (validated)
 */
function useManualToken(token) {
  if (!token || token.length < 100) {
    throw new Error('Invalid captcha token - it should be very long (2000+ characters)');
  }
  return token;
}

/**
 * Get captcha token from environment variable
 * Useful for testing or when you have a semi-permanent solution
 */
function getFromEnv() {
  const token = process.env.CIELO_CAPTCHA_TOKEN;
  if (!token) {
    throw new Error('CIELO_CAPTCHA_TOKEN environment variable not set');
  }
  return useManualToken(token);
}

/**
 * Convenience function for solving Cielo captcha
 *
 * Can provide API key via options.apiKey or TWOCAPTCHA_API_KEY environment variable
 * Can provide siteKey via options.siteKey or CIELO_RECAPTCHA_SITEKEY environment variable
 *
 * @param {Object} options Optional configuration
 * @param {string} options.apiKey 2Captcha API key (overrides environment variable)
 * @param {string} options.siteKey reCAPTCHA siteKey (overrides environment variable)
 * @returns {Promise<string>} The captcha token
 */
async function solveCieloCaptcha(options = {}) {
  // Check options first, then fall back to environment variables
  const apiKey = options.apiKey || process.env.TWOCAPTCHA_API_KEY;
  const siteKey = options.siteKey || process.env.CIELO_RECAPTCHA_SITEKEY || '6Lewqu8nAAAAAOudyOyScwjI4dFukcDvJZprnZB6'; // Default to known siteKey

  if (!apiKey) {
    throw new Error(
      'TWOCAPTCHA_API_KEY not configured.\n' +
      'Either:\n' +
      '1. Pass it via options: { apiKey: "your-key" }\n' +
      '2. Set environment variable: export TWOCAPTCHA_API_KEY="your-key"\n' +
      'Get your API key from https://2captcha.com/'
    );
  }

  console.log(`[2Captcha] Using siteKey: ${siteKey}`);

  return solve2Captcha(apiKey, siteKey, options);
}

module.exports = {
  solve2Captcha,
  solveCieloCaptcha,
  useManualToken,
  getFromEnv,
};
