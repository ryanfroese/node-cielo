/**
 * Helper module to obtain a real captcha token from the Cielo web UI
 * This ensures we match the web UI behavior EXACTLY for Apple Home integration
 */

const puppeteer = require('puppeteer');

/**
 * Launches a headless browser to get a real captcha token from the Cielo web UI
 *
 * @returns {Promise<string>} The captcha token
 */
async function getCaptchaToken() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Set user agent to match Chrome
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36');

    // Navigate to Cielo login page
    await page.goto('https://home.cielowigle.com/', {
      waitUntil: 'networkidle2'
    });

    // Wait a bit for captcha to load
    await page.waitForTimeout(2000);

    // Try to extract captcha token by intercepting network requests
    let captchaToken = null;

    // Set up request interception to capture the login request
    await page.setRequestInterception(true);

    page.on('request', (request) => {
      // Let all requests through
      request.continue();
    });

    page.on('requestfinished', async (request) => {
      if (request.url().includes('/auth/login')) {
        try {
          const postData = request.postData();
          if (postData) {
            const data = JSON.parse(postData);
            if (data.captchaToken) {
              captchaToken = data.captchaToken;
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });

    // Fill in dummy credentials to trigger captcha token generation
    // Note: This won't actually log in, just generate the token
    await page.waitForSelector('input[type="email"], input[type="text"]', { timeout: 5000 });
    await page.type('input[type="email"], input[type="text"]', 'dummy@example.com');
    await page.type('input[type="password"]', 'dummypassword');

    // Click login button to trigger the request
    await page.click('button[type="submit"]');

    // Wait for the login request to complete
    await page.waitForTimeout(3000);

    if (!captchaToken) {
      throw new Error('Could not extract captcha token');
    }

    return captchaToken;

  } finally {
    await browser.close();
  }
}

/**
 * Alternative method: Extract captcha token by executing page JavaScript
 * This tries to find the captcha token in the page's JavaScript context
 */
async function getCaptchaTokenFromPage() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36');

    await page.goto('https://home.cielowigle.com/', {
      waitUntil: 'networkidle2'
    });

    // Wait for captcha to be ready
    await page.waitForTimeout(3000);

    // Try to execute captcha if it's hCaptcha or Turnstile
    const token = await page.evaluate(() => {
      // Check for hCaptcha
      if (window.hcaptcha) {
        try {
          const response = window.hcaptcha.getResponse();
          if (response) return response;
        } catch (e) {}
      }

      // Check for Cloudflare Turnstile
      if (window.turnstile) {
        try {
          const response = window.turnstile.getResponse();
          if (response) return response;
        } catch (e) {}
      }

      // Check for reCAPTCHA v3
      if (window.grecaptcha) {
        // reCAPTCHA v3 requires execution, can't get token this way
        return null;
      }

      return null;
    });

    if (token) {
      return token;
    }

    throw new Error('Could not find captcha token on page');

  } finally {
    await browser.close();
  }
}

module.exports = {
  getCaptchaToken,
  getCaptchaTokenFromPage
};
