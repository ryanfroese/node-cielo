# Quick Start: Automated Captcha Solving

Get up and running with automated captcha solving in 5 minutes!

## 1. Sign Up for 2Captcha

1. Go to [https://2captcha.com/](https://2captcha.com/)
2. Create account
3. Add $3 (gives you ~1,000 captcha solves)
4. Get API key from dashboard

## 2. Find the SiteKey

**Easy method:**

1. Open https://home.cielowigle.com in Chrome
2. Press F12 (DevTools) → Network tab
3. Refresh page
4. Filter for "cloudflare" or "turnstile"
5. Look for `sitekey` in any request
6. Copy the value (starts with `0x`)

## 3. Set Environment Variables

```bash
export TWOCAPTCHA_API_KEY="your-api-key-here"
export CIELO_TURNSTILE_SITEKEY="0x..."
```

## 4. Test It!

```bash
node test-auto-captcha.js
```

## 5. Use in Your Code

```javascript
const {CieloAPIConnection} = require('node-cielo');

const api = new CieloAPIConnection(
  (state) => console.log('State:', state),
  (temp) => console.log('Temp:', temp),
  (err) => console.error('Error:', err)
);

// No manual captcha needed!
await api.establishConnectionWithAutoSolve(
  'your@email.com',
  'yourpassword',
  '73.162.98.163'
);

await api.subscribeToHVACs(['YOUR_MAC_ADDRESS']);
```

## Cost

- **$3 = 1,000 captcha solves**
- **Each solve = ~$0.003**
- **Monthly cost:**
  - Reconnect hourly: $2.16/month
  - Reconnect every 4 hours: $0.54/month
  - Reconnect daily: $0.09/month

## Need Help?

- **Full documentation:** See `AUTOMATED_CAPTCHA.md`
- **Troubleshooting:** Check the troubleshooting section in `AUTOMATED_CAPTCHA.md`
- **Issues:** [GitHub Issues](https://github.com/ryanfroese/node-cielo/issues)

That's it! You're ready to use automated captcha solving. 🎉
