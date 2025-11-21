# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NodeJS library that provides an interface to the SmartCielo API for controlling AC equipment (specifically Cielo thermostats) over the internet. It uses WebSockets for real-time bidirectional communication with the API.

**Requirements:**
- Node.js: Version 18.0.0 or higher (tested with Node.js 22)

## Commands

### Installation
```bash
npm install
```

### Running the Demo
```bash
node demo.js -u <username> -p <password> -i <ip_address> -m <mac_address_thermostat>
```

Options:
- `-u` or `--username`: SmartCielo account username
- `-p` or `--password`: SmartCielo account password
- `-i` or `--ip`: Public IP address of the network where HVACs are located
- `-m` or `--macAddress`: MAC address of the thermostat (will be uppercased automatically)
- `-v` or `--verbose`: Enable debug mode (routes traffic through HTTP proxy on localhost:8888)

## Architecture

### Core Classes

**CieloAPIConnection** (`Cielo.js:15-496`)
- Main API client that manages authentication and WebSocket communication
- Uses private fields for session management (`#sessionID`, `#userID`, `#accessToken`)
- Maintains an array of subscribed HVAC devices (`hvacs`)
- Provides three callback functions for state changes:
  - `commandCallback`: Fires when a command is sent
  - `temperatureCallback`: Fires on temperature updates
  - `errorCallback`: Fires on errors

**CieloHVAC** (`Cielo.js:498-704`)
- Represents a single HVAC unit
- Stores device state (power, temperature, mode, fan speed)
- Stores device metadata (MAC address, device name, appliance ID, firmware version, device type version)
- Provides methods to control the HVAC (powerOn, powerOff, setTemperature, setMode, setFanSpeed)
- All control methods require the API connection object to be passed in

### Authentication Flow (v2.0+)

1. `establishConnection()` is called with username/password/IP and **optional captchaToken**
2. Password is automatically SHA-256 hashed to match web UI behavior
3. `#getAccessTokenAndSessionId()` makes a POST to `/auth/login` endpoint with captcha token
4. Access token, refresh token, session ID, and user ID are stored in private fields
5. `subscribeToHVACs()` is called with an array of MAC addresses
6. `#getDeviceInfo()` fetches all devices for the account using new API key
7. CieloHVAC objects are created for each matching MAC address
8. `#connect()` establishes WebSocket connection with **Origin header** to `wss://apiwss.smartcielo.com/websocket/`

**CRITICAL:** Captcha tokens are REQUIRED for authentication and expire within minutes. For Apple Home integration, tokens must be refreshed for each new connection.

### WebSocket Communication (v2.0+)

**CRITICAL:** WebSocket connections MUST include `Origin: https://home.cielowigle.com` header or server returns 500 error.

The WebSocket connection handles messages identified by `message_type` field:
- `"StateUpdate"`: Unified message type for both command state changes AND temperature updates
- Contains `lat_env_var.temperature` for room temperature (renamed from `temp`)
- Contains `lat_env_var.humidity` for room humidity (new field)

Commands are sent via WebSocket using JSON payloads built by `#buildCommandPayload()` which includes:
- Device identification (MAC address, appliance ID, device type version, firmware version)
- `user_id` instead of `token` field
- `connection_source: 0` instead of `2`
- `mid: "WEB"` as static value instead of sessionId
- Action details (actionType, actionValue)
- Full state object with all HVAC parameters including new fields (turbo, light, followme)

### Device Type Version Handling

The `deviceTypeVersion` field (e.g., "BI01", "BI02") is critical for API compatibility:
- Retrieved from device info during subscription
- Must start with "BI" prefix (validated in CieloHVAC constructor at `Cielo.js:530-535`)
- Defaults to "BI01" if invalid or missing
- Passed to API in all command payloads
- Recent fix (PR #1) ensured this field is properly passed through to API

### API Endpoints (v2.0+)

- Login: `https://api.smartcielo.com/auth/login` (CHANGED from `/web/login`)
- Device list: `https://api.smartcielo.com/web/devices?limit=420` (unchanged)
- Token refresh (currently unused): `https://api.smartcielo.com/web/token/refresh` (unchanged)
- WebSocket: `wss://apiwss.smartcielo.com/websocket/?sessionId={sessionId}&token={accessToken}`

All REST endpoints require:
- `x-api-key` header with value `XiZ0PkwbNlQmu3Zrt7XV3EHBj1b1bHU9k02MSJW2` (CHANGED from old key)
- `authorization` header with access token (except login)
- `content-type: application/json; charset=UTF-8`
- Specific headers mimicking web browser requests

WebSocket connection requires:
- **CRITICAL:** `Origin: https://home.cielowigle.com` header
- `User-Agent` header matching web browser
- SessionId and accessToken passed as query parameters in URL

### Entry Points

- `index.js`: Simple module export of Cielo.js
- `demo.js`: Command-line demo showing connection, subscription, and HVAC control
- Main exports: `CieloAPIConnection` and `CieloHVAC` classes

### Debug Mode

When verbose flag (`-v`) is used:
- HTTP/HTTPS traffic routes through proxy at `http://127.0.0.1:8888`
- TLS certificate validation is disabled
- Useful for inspecting API traffic with tools like Charles Proxy or Fiddler

## API v2.0 Changes

The library was updated in v2.0.0 to match the new Cielo web UI API discovered through traffic captures in November 2025.

### Breaking Changes

1. **Captcha Required**: All logins now require a captcha token from reCAPTCHA v2
   - Token obtained by clicking reCAPTCHA checkbox on https://home.cielowigle.com
   - Extract token with: `grecaptcha.getResponse()` in browser console
   - Tokens expire within minutes (5-10 minutes typical)
   - Pass token to `establishConnection(username, password, ip, agent, captchaToken)`

2. **Password Hashing**: Passwords are automatically SHA-256 hashed
   - DO NOT hash passwords manually before passing to library
   - Library handles hashing internally to match web UI

3. **New Endpoints**: Login endpoint changed from `/web/login` to `/auth/login`

4. **New API Key**: Updated to match current web UI

5. **WebSocket Origin Header**: WebSocket connections MUST include Origin header
   - Without `Origin: https://home.cielowigle.com`, server returns 500 error
   - Critical for Apple Home integration reliability

### New Features in v2.0

- Humidity data available in state updates (`lat_env_var.humidity`)
- Refresh token support for future token renewal
- Unified `StateUpdate` message type for WebSocket messages
- Better web UI matching for improved compatibility

### For Apple Home Integration

When integrating with Apple HomeKit:
1. **Use captcha tokens** - Ensures requests match web UI exactly
2. **Handle token expiration** - Implement token refresh strategy:
   - Option A: Use automated captcha solving service (2Captcha, etc.)
   - Option B: Manual token refresh every few minutes
   - Option C: Test token longevity in production (may last hours)
3. **Keep Origin header** - Critical for WebSocket reliability

### Testing

Test script with manual captcha token:
```bash
node test-with-token.js "<captcha-token>"
```

This tests the complete flow: login → subscribe → get status → send command

See `USAGE_WITH_CAPTCHA.md` for detailed usage instructions.
