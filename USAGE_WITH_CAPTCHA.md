# Using node-cielo with Captcha Token (for Apple Home Integration)

## Why You Need This

The new Cielo API includes a captcha token in login requests. For Apple Home integration or other automation scenarios, you want to mimic the web UI **EXACTLY** to avoid any potential blocking or rate limiting.

## Two Options

### Option 1: Without Captcha (Simpler, May Work)

Try this first - the API might accept requests without the captcha token:

```javascript
const {CieloAPIConnection} = require('./Cielo.js');

const api = new CieloAPIConnection(
  (commandedState) => console.log('State:', commandedState),
  (temp) => console.log('Temp:', temp),
  (err) => console.error('Error:', err)
);

await api.establishConnection(
  'your@email.com',
  'yourpassword',  // Will be automatically SHA-256 hashed
  '73.162.98.163'  // Your public IP (or use '0.0.0.0')
);
```

### Option 2: With Captcha Token (Exact Web UI Match - Recommended for Apple Home)

Install puppeteer for automatic captcha token generation:

```bash
npm install puppeteer
```

Then use it in your code:

```javascript
const {CieloAPIConnection} = require('./Cielo.js');
const {getCaptchaToken} = require('./getCaptchaToken.js');

const api = new CieloAPIConnection(
  (commandedState) => console.log('State:', commandedState),
  (temp) => console.log('Temp:', temp),
  (err) => console.error('Error:', err)
);

// Get a real captcha token from the web UI
const captchaToken = await getCaptchaToken();

// Use it for authentication
await api.establishConnection(
  'your@email.com',
  'yourpassword',
  '73.162.98.163',
  undefined,  // agent (for proxy support)
  captchaToken  // The captcha token
);
```

## What Changed in v2.0

### Breaking Changes:
1. **Password Hashing**: Passwords are now automatically SHA-256 hashed to match web UI
2. **New API Endpoint**: Changed from `/web/login` to `/auth/login`
3. **New API Key**: Updated to match current web UI
4. **WebSocket Message Format**: Now uses `message_type: "StateUpdate"` instead of `mid: "WEB"/"Heartbeat"`

### New Features:
- Optional captcha token support
- Automatic password hashing (no manual hashing needed)
- Humidity data available in responses
- Refresh token support (for future token renewal)

## For Apple Home Integration

When integrating with Apple HomeKit, use **Option 2** with the captcha token to ensure your requests are indistinguishable from the web UI. This provides the best reliability and reduces the chance of being blocked.

### Example HomeKit Integration:

```javascript
const {CieloAPIConnection} = require('node-smartcielo-ws');
const {getCaptchaToken} = require('node-smartcielo-ws/getCaptchaToken');

class CieloThermostat {
  async connect() {
    this.api = new CieloAPIConnection(
      this.onStateChange.bind(this),
      this.onTemperatureChange.bind(this),
      this.onError.bind(this)
    );

    // Get fresh captcha token for authentication
    const captchaToken = await getCaptchaToken();

    await this.api.establishConnection(
      process.env.CIELO_EMAIL,
      process.env.CIELO_PASSWORD,
      process.env.PUBLIC_IP,
      undefined,
      captchaToken
    );

    await this.api.subscribeToHVACs([process.env.MAC_ADDRESS]);
  }

  async setTargetTemperature(temp) {
    await this.api.hvacs[0].setTemperature(temp.toString(), this.api);
  }

  async setMode(mode) {
    await this.api.hvacs[0].setMode(mode, this.api);
  }

  // ... other HomeKit accessory methods
}
```

## Troubleshooting

### "Login failed" Error

If you get login failures:
1. First try without captcha token (Option 1)
2. If that fails, use Option 2 with captcha token
3. Check that your password is correct (don't manually hash it - it's done automatically)
4. Verify your IP address is correct or use '0.0.0.0'

### Captcha Token Extraction Fails

If `getCaptchaToken()` fails:
1. Make sure puppeteer is installed: `npm install puppeteer`
2. Check that you have Chrome/Chromium installed
3. Try the alternative method: `getCaptchaTokenFromPage()`
4. Check your internet connection

### For Debugging

Enable detailed logging:

```javascript
// Before establishing connection
process.env.DEBUG = 'cielo:*';

// Then run your code
await api.establishConnection(...);
```

## Migration from v1.x

If you're upgrading from v1.x:

```javascript
// OLD (v1.x)
await api.establishConnection(username, password, ip, agent);

// NEW (v2.0) - Same signature, just works!
await api.establishConnection(username, password, ip, agent);

// NEW (v2.0) - With captcha for Apple Home
const captchaToken = await getCaptchaToken();
await api.establishConnection(username, password, ip, agent, captchaToken);
```

**Note**: Passwords are now automatically hashed - don't hash them yourself!
