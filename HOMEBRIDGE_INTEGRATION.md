# Homebridge Integration - Migration to v2.0

This document summarizes the changes made to integrate node-cielo v2.0 with the homebridge-smartcielo plugin.

## Changes to node-cielo (node-smartcielo-ws)

### Version Bump
- **Old:** v1.1.5
- **New:** v2.0.0 (breaking changes due to new Cielo API)

### Key Bug Fixes

1. **deviceTypeVersion validation** (`Cielo.js:780`)
   - **Issue:** Only accepted "BI" prefix, rejected "BP" devices
   - **Fix:** Now accepts both "BI" and "BP" prefixes
   - **Impact:** All device types now work correctly

2. **Temperature command format** (`Cielo.js:656`)
   - **Issue:** `actions.temp` sent as number instead of string
   - **Fix:** Convert temperature to string in actions object
   - **Impact:** Temperature changes now work

3. **Power/fanspeed in actions object** (`Cielo.js:656-661`)
   - **Issue:** Not updating when those were the action being performed
   - **Fix:** Added conditional logic for all action types
   - **Impact:** All commands now work reliably

### New Features

1. **Automated captcha solving** (`Cielo.js:250`)
   - Added `establishConnectionWithAutoSolve()` method
   - Uses 2Captcha service via `solveCaptcha.js`
   - Eliminates need for manual token extraction

2. **Connection management** (`CieloConnectionManager.js`)
   - Persistent WebSocket connections
   - Auto-reconnection on disconnect
   - Token expiration monitoring
   - Health checks

3. **Device discovery** (`Cielo.js:278`)
   - Added `getAllDevices()` method
   - Returns list of all devices on account
   - Enables automatic device enumeration

### Files Added/Modified

**New Files:**
- `solveCaptcha.js` - 2Captcha integration
- `CieloConnectionManager.js` - Connection lifecycle management
- `test-interactive.js` - Interactive CLI for testing
- `AUTOMATED_CAPTCHA.md` - Captcha solving guide
- `CONNECTION_MANAGEMENT.md` - Connection best practices
- `SUMMARY.md` - Overall project summary
- `HOMEBRIDGE_INTEGRATION.md` - This file

**Modified Files:**
- `Cielo.js` - Core API updates, bug fixes
- `demo.js` - Updated to use auto-solve
- `package.json` - Version bump to 2.0.0

## Changes to homebridge-smartcielo

### Code Changes

**`src/platform.ts`:**
- Line 52: Changed `establishConnection` → `establishConnectionWithAutoSolve`
- Line 73: Changed `establishConnection` → `establishConnectionWithAutoSolve`
- Updated log messages to mention auto-captcha

**`package.json`:**
- Updated dependency: `node-smartcielo-ws: ^1.1.5` → `^2.0.0`

**`CLAUDE.md`:**
- Added section about TWOCAPTCHA_API_KEY requirement
- Added cost estimates for captcha usage

**New Files:**
- `SETUP_LOCAL_TESTING.md` - Guide for linking local packages

### Configuration Requirements

**New Environment Variable:**
```bash
export TWOCAPTCHA_API_KEY="your-api-key"
```

This must be set before starting Homebridge.

### Breaking Changes

The homebridge-cielo plugin now requires:
1. **node-smartcielo-ws v2.0.0** (breaking change in dependency)
2. **TWOCAPTCHA_API_KEY environment variable** (new requirement)
3. **2Captcha account** with positive balance

### Migration Path

For users upgrading from v1.x to v2.x:

1. Sign up for 2Captcha: https://2captcha.com/
2. Add funds ($1 = ~333 captcha solves)
3. Set environment variable:
   ```bash
   export TWOCAPTCHA_API_KEY="your-key"
   ```
4. Update homebridge-cielo to latest version
5. Restart Homebridge

### Expected Costs

- **Per captcha:** $0.003
- **Reconnection interval:** ~55 minutes
- **Daily reconnections:** ~26
- **Monthly cost:** ~$2.16

For most home users, $5 in 2Captcha credit will last 2-3 months.

## Testing Checklist

### node-cielo standalone
- [x] Auto-captcha solve works
- [x] Login successful
- [x] WebSocket connection established
- [x] Device discovery works
- [x] Power commands work (on/off)
- [x] Temperature commands work
- [x] Mode changes work
- [x] Fan speed changes work
- [x] State updates received correctly
- [x] Auto-reconnection works

### homebridge-cielo integration
- [ ] Plugin loads successfully
- [ ] Devices discovered in HomeKit
- [ ] Power on/off via HomeKit
- [ ] Temperature changes via HomeKit
- [ ] Mode changes via HomeKit
- [ ] Status updates in real-time
- [ ] Auto-reconnection after disconnect
- [ ] Survives Homebridge restart

## Known Issues

1. **First-time delay:** Initial connection takes 10-30 seconds due to captcha solving
2. **Reconnection cost:** Each reconnection (~every 55 min) costs $0.003
3. **No offline mode:** Plugin requires active internet connection for captcha solving

## Future Improvements

1. **Captcha caching:** Investigate if captcha tokens can be reused longer
2. **Connection pooling:** Share connections across multiple plugin instances
3. **Fallback auth:** Add option for manual captcha token if auto-solve fails
4. **Health monitoring:** Add metrics for captcha success rate and cost tracking

## Support

For issues with:
- **node-cielo (API library):** https://github.com/ryanfroese/node-cielo/issues
- **homebridge-cielo (plugin):** https://github.com/ryanfroese/homebridge-smartcielo/issues
- **2Captcha service:** https://2captcha.com/support

## Credits

- **Cielo API v2.0 reverse engineering:** Traffic capture and analysis
- **Captcha integration:** 2Captcha service
- **Testing:** Interactive CLI and debug logging
