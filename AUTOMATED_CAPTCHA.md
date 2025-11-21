# Automated Captcha Solving with 2Captcha

This guide explains how to use automated captcha solving for the Cielo API, eliminating the need for manual captcha token extraction.

## Table of Contents

- [Overview](#overview)
- [Cost](#cost)
- [Setup](#setup)
- [Usage](#usage)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Apple Home Integration](#apple-home-integration)

## Overview

The Cielo API requires solving a **Cloudflare Turnstile** captcha on every login. This library integrates with [2Captcha](https://2captcha.com/), a service that automatically solves captchas for you.

**Benefits:**
- ✅ No manual captcha solving required
- ✅ Perfect for automation and Apple Home integration
- ✅ Reliable and fast (10-30 seconds per solve)
- ✅ Affordable (~$3 per 1,000 solves)

**How it works:**
1. Your code calls `establishConnectionWithAutoSolve()`
2. The library sends the captcha to 2Captcha's API
3. 2Captcha solves it (usually takes 10-30 seconds)
4. The library receives the token and logs you in automatically

## Cost

**2Captcha Pricing:**
- $3 per 1,000 Cloudflare Turnstile solves
- ~$0.003 per solve

**Monthly cost estimates for Apple Home:**
- Reconnect every 60 minutes: ~$2.16/month (720 solves)
- Reconnect every 4 hours: ~$0.54/month (180 solves)
- Reconnect daily: ~$0.09/month (30 solves)

**Tips to minimize cost:**
- Cache connections as long as possible (tokens valid for ~60 minutes)
- Only reconnect when needed (on connection loss or token expiration)
- Consider implementing a connection pool for multiple devices

## Setup

### Step 1: Sign up for 2Captcha

1. Go to [https://2captcha.com/](https://2captcha.com/)
2. Create an account
3. Add funds (minimum $3)
4. Get your API key from the dashboard

### Step 2: Find the Cloudflare Turnstile siteKey

The siteKey is a unique identifier for Cielo's captcha. You need to find it once and reuse it.

**Method A - Browser DevTools (Recommended):**

1. Open [https://home.cielowigle.com](https://home.cielowigle.com) in Chrome
2. Open DevTools (F12) → Network tab
3. Refresh the page
4. Filter for "challenges.cloudflare.com" or "turnstile"
5. Click on any request
6. Look for the `sitekey` parameter in the URL or headers
7. Copy the value (starts with `0x`)

**Method B - Page Source:**

1. Right-click on [https://home.cielowigle.com](https://home.cielowigle.com)
2. Select "View Page Source"
3. Search for "cf-turnstile" or "data-sitekey"
4. Copy the sitekey value

**Example siteKey format:** `0x4AAAAAAAaBcDEfGhIjKlMn`

### Step 3: Set Environment Variables

```bash
# Your 2Captcha API key
export TWOCAPTCHA_API_KEY="your-api-key-here"

# The Cloudflare Turnstile siteKey from Cielo's login page
export CIELO_TURNSTILE_SITEKEY="0x..."
```

For persistent configuration, add these to your `~/.bashrc`, `~/.zshrc`, or `.env` file.

## Usage

### Basic Usage

```javascript
const {CieloAPIConnection} = require('node-cielo');

const api = new CieloAPIConnection(
  (state) => console.log('State:', state),
  (temp) => console.log('Temp:', temp),
  (err) => console.error('Error:', err)
);

// Automatic captcha solving - no manual token needed!
await api.establishConnectionWithAutoSolve(
  'your@email.com',
  'yourpassword',
  '73.162.98.163'  // Your public IP (or use '0.0.0.0')
);

// Now you can subscribe to HVACs and control them
await api.subscribeToHVACs(['MAC_ADDRESS']);
```

### Advanced Configuration

You can customize the captcha solving behavior:

```javascript
await api.establishConnectionWithAutoSolve(
  'your@email.com',
  'yourpassword',
  '73.162.98.163',
  undefined,  // agent (for proxy support)
  {
    // Optional: Override default settings
    pollingInterval: 3000,  // Check every 3 seconds (default: 5000)
    timeout: 120000,        // Max wait time (default: 180000 = 3 minutes)
  }
);
```

### Direct 2Captcha API Usage

For more control, you can use the captcha solving functions directly:

```javascript
const { solveCieloCaptcha } = require('./solveCaptcha.js');

// Solve captcha (uses environment variables)
const token = await solveCieloCaptcha();

// Use with regular login
await api.establishConnection(
  'your@email.com',
  'yourpassword',
  '73.162.98.163',
  undefined,
  token  // Solved captcha token
);
```

Or with full control:

```javascript
const { solve2Captcha } = require('./solveCaptcha.js');

const token = await solve2Captcha(
  'your-2captcha-api-key',
  '0x4AAAAAAAaBcDEfGhIjKlMn',  // siteKey
  {
    pageUrl: 'https://home.cielowigle.com',
    pollingInterval: 5000,
    timeout: 180000,
  }
);
```

## Examples

### Example 1: Simple Automated Login

```javascript
const {CieloAPIConnection} = require('node-cielo');

(async () => {
  const api = new CieloAPIConnection(
    (state) => console.log('State update:', state),
    (temp) => console.log('Temperature:', temp),
    (err) => console.error('Error:', err)
  );

  // Automatic captcha solving
  await api.establishConnectionWithAutoSolve(
    process.env.CIELO_EMAIL,
    process.env.CIELO_PASSWORD,
    process.env.PUBLIC_IP
  );

  // Subscribe and control
  await api.subscribeToHVACs([process.env.MAC_ADDRESS]);
  await api.hvacs[0].powerOn(api);
})();
```

### Example 2: Apple Home with Error Handling

```javascript
const {CieloAPIConnection} = require('node-cielo');

class CieloAccessory {
  constructor() {
    this.api = new CieloAPIConnection(
      (state) => this.handleStateChange(state),
      (temp) => this.handleTempChange(temp),
      (err) => this.handleError(err)
    );
  }

  async connect() {
    try {
      await this.api.establishConnectionWithAutoSolve(
        process.env.CIELO_EMAIL,
        process.env.CIELO_PASSWORD,
        process.env.PUBLIC_IP
      );
      await this.api.subscribeToHVACs([process.env.MAC_ADDRESS]);
      console.log('Connected successfully!');
    } catch (error) {
      if (error.message.includes('2Captcha')) {
        console.error('2Captcha error - check API key and balance');
      } else if (error.message.includes('TWOCAPTCHA_API_KEY')) {
        console.error('Set TWOCAPTCHA_API_KEY environment variable');
      } else {
        console.error('Connection failed:', error.message);
      }
      throw error;
    }
  }

  // ... rest of your accessory implementation
}
```

### Example 3: Connection with Retry Logic

```javascript
async function connectWithRetry(maxRetries = 3) {
  const api = new CieloAPIConnection(
    (state) => console.log('State:', state),
    (temp) => console.log('Temp:', temp),
    (err) => console.error('Error:', err)
  );

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Connection attempt ${attempt}/${maxRetries}...`);

      await api.establishConnectionWithAutoSolve(
        process.env.CIELO_EMAIL,
        process.env.CIELO_PASSWORD,
        process.env.PUBLIC_IP
      );

      await api.subscribeToHVACs([process.env.MAC_ADDRESS]);
      console.log('Connected successfully!');
      return api;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }

      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Troubleshooting

### Error: "TWOCAPTCHA_API_KEY environment variable not set"

**Solution:** Set your 2Captcha API key:
```bash
export TWOCAPTCHA_API_KEY="your-api-key-here"
```

### Error: "CIELO_TURNSTILE_SITEKEY environment variable not set"

**Solution:** Find and set the siteKey (see [Setup Step 2](#step-2-find-the-cloudflare-turnstile-sitekey)):
```bash
export CIELO_TURNSTILE_SITEKEY="0x..."
```

### Error: "2Captcha submission failed: ERROR_ZERO_BALANCE"

**Cause:** Your 2Captcha account has no funds.

**Solution:** Add funds at [https://2captcha.com/](https://2captcha.com/)

### Error: "2Captcha submission failed: ERROR_WRONG_USER_KEY"

**Cause:** Invalid 2Captcha API key.

**Solution:** Check your API key at [https://2captcha.com/](https://2captcha.com/)

### Error: "2Captcha timeout after 180000ms"

**Cause:** The captcha took too long to solve (very rare).

**Solution:**
- Retry the operation
- Increase the timeout in captchaOptions
- Check 2Captcha status at [https://2captcha.com/](https://2captcha.com/)

### Error: "forbidden" or "captcha token has expired"

**Cause:** The siteKey might be incorrect, or Cielo changed their captcha implementation.

**Solution:**
1. Re-find the siteKey using DevTools (see Setup Step 2)
2. Update the environment variable
3. Retry

### Captcha solving is slow (>60 seconds)

**Cause:** 2Captcha service is experiencing high load.

**Solution:**
- Wait and retry (usually temporary)
- Check service status: [https://2captcha.com/](https://2captcha.com/)
- Consider increasing the timeout

## Apple Home Integration

### Recommended Implementation

For Apple Home, you want to:
1. Connect once on startup
2. Maintain the connection as long as possible
3. Reconnect automatically if disconnected
4. Minimize captcha solves to reduce cost

```javascript
class CieloHomebridge {
  constructor() {
    this.api = null;
    this.reconnectTimer = null;
    this.tokenExpiresAt = null;
  }

  async connect() {
    try {
      console.log('Connecting to Cielo...');

      this.api = new CieloAPIConnection(
        (state) => this.updateHomeKit(state),
        (temp) => this.updateTemperature(temp),
        (err) => this.handleConnectionError(err)
      );

      await this.api.establishConnectionWithAutoSolve(
        process.env.CIELO_EMAIL,
        process.env.CIELO_PASSWORD,
        process.env.PUBLIC_IP
      );

      await this.api.subscribeToHVACs([process.env.MAC_ADDRESS]);

      // Track token expiration (expires in ~60 minutes)
      this.tokenExpiresAt = Date.now() + (55 * 60 * 1000); // Refresh at 55min

      // Schedule reconnection before token expires
      this.scheduleReconnect();

      console.log('Connected successfully!');

    } catch (error) {
      console.error('Connection failed:', error.message);
      // Retry after delay
      setTimeout(() => this.connect(), 60000);
    }
  }

  scheduleReconnect() {
    // Clear existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Reconnect 5 minutes before expiration
    const timeUntilReconnect = this.tokenExpiresAt - Date.now();

    this.reconnectTimer = setTimeout(() => {
      console.log('Token expiring soon, reconnecting...');
      this.connect();
    }, timeUntilReconnect);
  }

  handleConnectionError(err) {
    console.error('Connection error:', err.message);
    // Attempt to reconnect
    this.connect();
  }

  // ... rest of your Homebridge implementation
}
```

### Cost Optimization Tips

1. **Cache the connection**: Keep it alive as long as possible
2. **Monitor token expiration**: Reconnect just before expiration (~55 minutes)
3. **Implement exponential backoff**: On errors, wait before retrying
4. **Share connections**: If you have multiple accessories, share one connection

### Estimated Monthly Costs

Based on different reconnection strategies:

| Strategy | Reconnects/Day | Reconnects/Month | Cost/Month |
|----------|---------------|------------------|------------|
| Every 60 min | 24 | 720 | $2.16 |
| Every 4 hours | 6 | 180 | $0.54 |
| Every 12 hours | 2 | 60 | $0.18 |
| Once daily | 1 | 30 | $0.09 |

**Recommendation:** Reconnect every 4-12 hours for best balance of reliability and cost.

## Testing

Run the included test script to verify your setup:

```bash
# Set environment variables
export TWOCAPTCHA_API_KEY="your-api-key"
export CIELO_TURNSTILE_SITEKEY="0x..."

# Run test
node test-auto-captcha.js
```

This will:
1. Verify your environment variables
2. Solve a captcha automatically
3. Login to Cielo
4. Connect to your HVAC
5. Test power control
6. Display timing and cost information

## Support

- **2Captcha Support:** [https://2captcha.com/support](https://2captcha.com/support)
- **node-cielo Issues:** [GitHub Issues](https://github.com/ryanfroese/node-cielo/issues)

## License

This automated captcha solving integration is provided as-is. 2Captcha is a third-party service with its own terms of service and pricing.
