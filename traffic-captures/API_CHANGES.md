# Cielo API Changes - Old vs New

This document details all the differences between the old Cielo API (currently implemented in node-cielo) and the new API captured from the web UI (Nov 2025).

---

## 1. Authentication Changes

### 1.1 Login Endpoint

| Aspect | Old API | New API |
|--------|---------|---------|
| **Endpoint** | `POST /web/login` | `POST /auth/login` |
| **API Key Header** | `7xTAU4y4B34u8DjMsODlEyprRRQEsbJ3IB7vZie4` | `XiZ0PkwbNlQmu3Zrt7XV3EHBj1b1bHU9k02MSJW2` |

### 1.2 Login Request Body

**OLD Request:**
```json
{
  "user": {
    "userId": "ryan.c.froese@gmail.com",
    "password": "mypassword",
    "mobileDeviceId": "WEB",
    "deviceTokenId": "WEB",
    "appType": "WEB",
    "appVersion": "1.0",
    "timeZone": "America/Los_Angeles",
    "mobileDeviceName": "chrome",
    "deviceType": "WEB",
    "ipAddress": "73.162.xxx.xxx",
    "isSmartHVAC": 0,
    "locale": "en"
  }
}
```

**NEW Request:**
```json
{
  "user": {
    "userId": "ryan.c.froese@gmail.com",
    "password": "4a643bada5eadf434ad25c63efa08f35f189cc984a023f13d7d71a363f6ef2a7",
    "mobileDeviceId": "WEB",
    "deviceTokenId": "WEB",
    "appType": "WEB",
    "appVersion": "1.4.4",
    "timeZone": "America/Los_Angeles",
    "mobileDeviceName": "chrome",
    "deviceType": "WEB",
    "ipAddress": "0.0.0.0",
    "isSmartHVAC": 0,
    "locale": "en"
  },
  "captchaToken": "<very long token - 2048+ chars>"
}
```

**Key Differences:**
- ⚠️ **NEW**: `captchaToken` field (may be optional for API access - needs testing)
- ⚠️ **NEW**: Password appears to be SHA-256 hashed in web UI
- `appVersion`: `"1.0"` → `"1.4.4"`
- `ipAddress`: Can use `"0.0.0.0"` instead of actual IP

### 1.3 Login Response

**OLD Response Fields:**
```json
{
  "data": {
    "user": {
      "sessionId": "chrome-1234567890",
      "userId": "9yjCpPYIJ1",
      "accessToken": "eyJhbGc..."
    }
  }
}
```

**NEW Response Fields:**
```json
{
  "status": 200,
  "message": "SUCCESS",
  "data": {
    "user": {
      "userId": "9yjCpPYIJ1",
      "accessToken": "eyJhbGc...",
      "sessionId": "chrome-1763596524897811712",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 1763600124,
      "userName": "Ryan",
      "firstName": "Ryan",
      "lastName": "Froese"
      // ... many more user profile fields
    },
    "currentTs": 1763596524,
    "x-api-key": "3iCWYuBqpY2g7yRq3yyTk1XCS4CMjt1n9ECCjdpd"
  }
}
```

**Key Differences:**
- ✅ **NEW**: `refreshToken` field for token refresh
- ✅ **NEW**: `expiresIn` timestamp for token expiration
- ✅ **NEW**: Returns user profile fields (userName, firstName, lastName)
- ✅ **NEW**: Returns another x-api-key in response body (may be for subsequent requests)

---

## 2. WebSocket Connection

### 2.1 WebSocket URL

**UNCHANGED**: `wss://apiwss.smartcielo.com/websocket/`

Query parameters remain the same:
- `sessionId`: Session ID from login
- `token`: Access token from login

---

## 3. WebSocket Commands (Client → Server)

### 3.1 Command Structure Comparison

**OLD Command (Power On):**
```json
{
  "action": "actionControl",
  "macAddress": "C45BBEC42467",
  "deviceTypeVersion": "BP01",
  "fwVersion": "1.0.9,2.4.0",
  "actionSource": "WEB",
  "applianceType": "AC",
  "applianceId": 1675,
  "actionType": "power",
  "actionValue": "on",
  "connection_source": 2,
  "token": "eyJhbGc...",
  "actions": {
    "power": "on",
    "mode": "auto",
    "fanspeed": "auto",
    "temp": "75",
    "swing": "auto/stop",
    "turbo": "off",
    "light": "off",
    "oldPower": "off"
  },
  "mid": "chrome-1234567890",
  "application_version": "1.0.0",
  "ts": 1647617408
}
```

**NEW Command (Power On):**
```json
{
  "action": "actionControl",
  "actionSource": "WEB",
  "applianceType": "AC",
  "macAddress": "C45BBEC42467",
  "deviceTypeVersion": "BP01",
  "fwVersion": "1.0.9,2.4.0",
  "applianceId": 1675,
  "actionType": "power",
  "actionValue": "on",
  "connection_source": 0,
  "user_id": "9yjCpPYIJ1",
  "preset": 0,
  "oldPower": "off",
  "myRuleConfiguration": {},
  "mid": "WEB",
  "actions": {
    "power": "on",
    "mode": "heat",
    "fanspeed": "auto",
    "temp": "73",
    "swing": "adjust",
    "swinginternal": "",
    "turbo": "off",
    "light": "on/off",
    "followme": "off"
  },
  "application_version": "1.4.4",
  "ts": 1763596544
}
```

### 3.2 Field Changes Summary

| Field | Old Value | New Value | Notes |
|-------|-----------|-----------|-------|
| `connection_source` | `2` | `0` | Changed value |
| `token` | `"eyJhbGc..."` | ❌ Removed | Replaced with `user_id` |
| `user_id` | ❌ Not present | `"9yjCpPYIJ1"` | **NEW** - Use userId from login |
| `preset` | ❌ Not present | `0` | **NEW** - Always 0 |
| `oldPower` | Inside `actions` | Top-level field | **MOVED** - Now required at top level |
| `myRuleConfiguration` | ❌ Not present | `{}` | **NEW** - Empty object |
| `mid` | `"chrome-1234..."` (sessionId) | `"WEB"` | Changed to static "WEB" |
| `application_version` | `"1.0.0"` | `"1.4.4"` | Updated version |
| `actions.swing` | `"auto/stop"` | `"adjust"` | Different value format |
| `actions.swinginternal` | ❌ Not present | `""` | **NEW** - Empty string |
| `actions.light` | `"off"` | `"on/off"` | Different value format |
| `actions.followme` | ❌ Not present | `"off"` | **NEW** - Always "off" |

### 3.3 Command Examples

#### Temperature Change

**OLD:**
```json
{
  "actionType": "temp",
  "actionValue": "68",
  "actions": {
    "temp": "68"
  }
}
```

**NEW:**
```json
{
  "actionType": "temp",
  "actionValue": 72,
  "actions": {
    "temp": "72"
  }
}
```
Note: actionValue is now a number, not a string.

#### Mode Change

**OLD:**
```json
{
  "actionType": "mode",
  "actionValue": "cool",
  "actions": {
    "mode": "cool"
  }
}
```

**NEW:**
```json
{
  "actionType": "mode",
  "actionValue": "cool",
  "actions": {
    "mode": "cool"
  }
}
```
Note: Mode change structure is mostly the same.

---

## 4. WebSocket Responses (Server → Client)

### 4.1 Message Type Identification

**OLD Method:**
```javascript
const type = data.mid; // "WEB" or "Heartbeat"
```

**NEW Method:**
```javascript
const type = data.message_type; // "StateUpdate"
```

### 4.2 Response Structure Comparison

**OLD Response (Command State Change - mid: "WEB"):**
```json
{
  "message_type": "...",
  "action": {
    "power": "on",
    "temp": "73",
    "mode": "heat",
    "fanspeed": "auto"
  },
  "lat_env_var": {
    "temp": "80"
  },
  "mac_address": "C45BBEC42467",
  "mid": "WEB"
}
```

**OLD Response (Heartbeat - mid: "Heartbeat"):**
```json
{
  "lat_env_var": {
    "temperature": "80"
  },
  "mac_address": "C45BBEC42467",
  "mid": "Heartbeat"
}
```

**NEW Response (Unified StateUpdate):**
```json
{
  "message_type": "StateUpdate",
  "action": {
    "uirules": "default:default:default",
    "device_status": "on",
    "temp": "73",
    "action_source": "WEB",
    "statustimestamp": "1763503728",
    "fanspeed": "auto",
    "turbo": "off",
    "end_turbo_timestamp": "1647618551",
    "mode": "heat",
    "swing": "adjust",
    "followme": "off",
    "light": "on/off",
    "ontimestamp": "1763596545",
    "start_turbo_timestamp": "1647617408",
    "power": "on",
    "mode_timestamp": "1763594952",
    "timestamp": "1763596545",
    "moderules": "default:default:default"
  },
  "mac_address": "C45BBEC42467",
  "mid": "WEB",
  "stateSync": "0",
  "exe": "1",
  "my_rule_configuration": {},
  "lat_env_var": {
    "temperature": "80",
    "humidity": "48"
  },
  "device_status": 1,
  "device_name": "Office",
  "fw_version": "1.0.9,2.4.0",
  "MID": "WEB"
}
```

### 4.3 Response Field Changes

| Field | Old API | New API | Notes |
|-------|---------|---------|-------|
| **Message Type Detection** | `data.mid` | `data.message_type` | Now use message_type |
| **Message Types** | `"WEB"` or `"Heartbeat"` | `"StateUpdate"` | Unified to single type |
| **Temperature Path** | `data.lat_env_var.temp` | `data.lat_env_var.temperature` | Field name changed |
| **Humidity** | ❌ Not available | `data.lat_env_var.humidity` | **NEW** - Now available |
| **Device Name** | ❌ Not available | `data.device_name` | **NEW** - Device name included |
| **Action Timestamps** | Limited | Multiple timestamps | **NEW** - Many timestamp fields |
| **Rules** | ❌ Not available | `action.uirules`, `action.moderules` | **NEW** - Rule information |

---

## 5. Implementation Checklist

### Critical Changes (Breaking)
- [ ] Change login endpoint from `/web/login` to `/auth/login`
- [ ] Update x-api-key header value
- [ ] Replace `token` field with `user_id` in WebSocket commands
- [ ] Change `mid` from sessionId to "WEB" in commands
- [ ] Update message type detection from `data.mid` to `data.message_type`
- [ ] Handle unified "StateUpdate" message type instead of "WEB"/"Heartbeat"

### Important Changes (May Break)
- [ ] Change `connection_source` from 2 to 0
- [ ] Add `preset: 0` to all commands
- [ ] Move `oldPower` to top-level (track previous state)
- [ ] Add `myRuleConfiguration: {}` to all commands
- [ ] Update temperature path from `lat_env_var.temp` to `lat_env_var.temperature`

### Nice to Have (Non-Breaking)
- [ ] Update `application_version` to "1.4.4"
- [ ] Add `swinginternal: ""` to actions
- [ ] Add `followme: "off"` to actions
- [ ] Handle humidity data from responses
- [ ] Store and use refreshToken for token renewal
- [ ] Handle expiresIn for automatic token refresh

### To Investigate
- [ ] **captchaToken**: Test if it's required for API access or can be empty/omitted
- [ ] **Password hashing**: Determine if password needs to be SHA-256 hashed or can remain plaintext

---

## 6. Migration Strategy

### Option 1: Breaking Change (Recommended)
- Update to new API completely
- Increment major version (e.g., 1.x.x → 2.0.0)
- Add migration guide for users

### Option 2: Gradual Migration
- Try new API, fallback to old if it fails
- Deprecation warnings for old API usage
- Remove old API in future version

---

## 7. Testing Checklist

After implementing changes, verify:
- [ ] Login with username/password works
- [ ] Devices can be retrieved and subscribed to
- [ ] WebSocket connection establishes successfully
- [ ] Power on/off commands work
- [ ] Temperature changes work
- [ ] Mode changes work (heat/cool/auto)
- [ ] Fan speed changes work
- [ ] State updates are received correctly
- [ ] Temperature readings are accurate
- [ ] Humidity readings are available (if supported)
- [ ] Multiple commands in sequence work
- [ ] Reconnection after disconnect works

---

## 8. Questions & Unknowns

1. **CaptchaToken**: Is this required for programmatic API access, or only for web UI?
2. **Password Format**: Does the API accept plaintext passwords, or must they be SHA-256 hashed?
3. **Secondary API Key**: The login response includes another x-api-key - is this needed for subsequent requests?
4. **Token Refresh**: How should we use the refreshToken when accessToken expires?
5. **Backward Compatibility**: Do we need to support the old API, or can we do a hard cutover?
