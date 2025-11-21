# Connection Management & Minimizing Captcha Solves

This guide explains how to maintain long-lived connections to minimize captcha solves and costs.

## Understanding the Connection Lifecycle

### Token Expiration
- **Access tokens expire after ~60 minutes** (expiresIn field)
- **Refresh tokens don't work for web clients** (only for mobile apps)
- **WebSocket connections can stay alive indefinitely** (as long as you don't disconnect)

### Key Insight: Keep WebSocket Alive!

The WebSocket connection can remain active long after the access token expires for **commands**, but you'll need a fresh login with captcha if the WebSocket disconnects.

**Best Practice:** Keep the WebSocket connection alive as long as possible!

## Connection Manager

We've created `CieloConnectionManager` that handles:
- ✅ Automatic reconnection on disconnect
- ✅ Token expiration monitoring
- ✅ Health checks to ensure connection is alive
- ✅ Exponential backoff on reconnection failures
- ✅ Scheduled reconnection before token expires

### Basic Usage

```javascript
const { CieloConnectionManager } = require('./CieloConnectionManager.js');

const manager = new CieloConnectionManager(
  'your@email.com',
  'yourpassword',
  '73.162.98.163',
  {
    macAddresses: ['MAC1', 'MAC2'], // Optional: Auto-subscribe on connect
    autoReconnect: true,             // Auto-reconnect on disconnect
    healthCheckInterval: 120000,     // Check health every 2 minutes
    refreshBeforeExpiry: 300000,     // Reconnect 5 min before token expires
  }
);

// Connect once
await manager.connect();

// Now you can use it for hours without reconnecting!
const hvacs = manager.getHvacs();
await hvacs[0].setTemperature(manager.getApi(), 72);

// Connection stays alive - no new captcha needed!
```

### Connection Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│  Connect with Auto-Captcha                              │
│  ↓                                                       │
│  WebSocket Established                                  │
│  ↓                                                       │
│  Health Checks Every 2 Minutes                          │
│  ↓                                                       │
│  [55 minutes later]                                     │
│  ↓                                                       │
│  Token Expiring Soon → Auto-Reconnect with New Captcha │
│  ↓                                                       │
│  Repeat                                                 │
└─────────────────────────────────────────────────────────┘
```

## Minimizing Captcha Solves - Strategies

### Strategy 1: Single Long-Lived Connection (Recommended for Always-On)

**Best for:** Home servers, Raspberry Pi, always-on devices

```javascript
// Connect once when your app starts
await manager.connect();

// Keep connection alive indefinitely
// Reconnects automatically every ~55 minutes with new captcha

// Cost: ~720 solves/month = $2.16/month
```

**Pros:**
- Always ready to respond instantly
- Perfect for Apple Home
- Simple implementation

**Cons:**
- Highest cost ($2.16/month)
- Requires always-on device

### Strategy 2: On-Demand Connection with Caching

**Best for:** Occasional use, serverless functions

```javascript
let cachedManager = null;
let connectionTime = null;

async function getManager() {
  const now = Date.now();
  const maxAge = 50 * 60 * 1000; // 50 minutes

  if (!cachedManager || (now - connectionTime) > maxAge) {
    // Connection expired or doesn't exist
    cachedManager = new CieloConnectionManager(...);
    await cachedManager.connect();
    connectionTime = now;
  }

  return cachedManager;
}

// Use it
const manager = await getManager();
const hvacs = manager.getHvacs();
// ... control HVACs
```

**Cost:** Depends on usage
- If used 6 times/day: ~180 solves/month = $0.54/month
- If used 1 time/day: ~30 solves/month = $0.09/month

### Strategy 3: Connection Pool (Advanced)

**Best for:** Multiple simultaneous users, high traffic

```javascript
const connectionPool = new Map();

async function getOrCreateConnection(userId) {
  if (!connectionPool.has(userId)) {
    const manager = new CieloConnectionManager(...);
    await manager.connect();
    connectionPool.set(userId, {
      manager,
      lastUsed: Date.now(),
    });
  }

  const entry = connectionPool.get(userId);
  entry.lastUsed = Date.now();
  return entry.manager;
}

// Cleanup old connections periodically
setInterval(() => {
  const now = Date.now();
  const maxIdle = 10 * 60 * 1000; // 10 minutes

  for (const [userId, entry] of connectionPool.entries()) {
    if (now - entry.lastUsed > maxIdle) {
      entry.manager.disconnect();
      connectionPool.delete(userId);
    }
  }
}, 60000); // Check every minute
```

## Health Monitoring

The Connection Manager automatically monitors connection health:

```javascript
const status = manager.getStatus();
console.log(status);
// {
//   isConnected: true,
//   reconnectAttempts: 0,
//   tokenExpiresAt: 1763694145000,
//   timeUntilExpiry: 3300000, // milliseconds
//   hvacCount: 2
// }
```

### Custom Health Checks

```javascript
const manager = new CieloConnectionManager(username, password, ip, {
  healthCheckInterval: 60000, // Check every 1 minute
  onConnected: () => {
    console.log('✅ Connected!');
  },
  onDisconnected: () => {
    console.log('⚠️  Disconnected');
  },
  onError: (err) => {
    console.error('Error:', err.message);
  },
});
```

## Cost Optimization Summary

| Strategy | Reconnects/Month | Cost/Month | Use Case |
|----------|-----------------|------------|----------|
| Always-On (hourly) | 720 | $2.16 | Apple Home, home automation |
| Cached (6x/day) | 180 | $0.54 | Regular use, check temps multiple times daily |
| On-Demand (1x/day) | 30 | $0.09 | Occasional use, manual control |

## Apple Home Integration Example

```javascript
class CieloHomebridge {
  constructor() {
    this.manager = null;
  }

  async init() {
    this.manager = new CieloConnectionManager(
      process.env.CIELO_EMAIL,
      process.env.CIELO_PASSWORD,
      process.env.PUBLIC_IP,
      {
        macAddresses: [process.env.MAC_ADDRESS],
        autoReconnect: true,
        onStateChange: (state) => this.updateHomeKit(state),
        onTemperature: (temp) => this.updateTemperature(temp),
      }
    );

    await this.manager.connect();
    console.log('Cielo connected for Apple Home');
  }

  async setTemperature(temp) {
    const hvac = this.manager.getHvacs()[0];
    await hvac.setTemperature(this.manager.getApi(), temp);
  }

  async setPower(on) {
    const hvac = this.manager.getHvacs()[0];
    if (on) {
      await hvac.powerOn(this.manager.getApi());
    } else {
      await hvac.powerOff(this.manager.getApi());
    }
  }

  getTemperature() {
    const hvac = this.manager.getHvacs()[0];
    return hvac.getRoomTemperature();
  }
}
```

## Interactive Testing

Try the interactive test to see connection management in action:

```bash
export TWOCAPTCHA_API_KEY="your-key"
node test-interactive.js
```

Features:
- ✅ Connects once and stays connected
- ✅ Lists all available HVACs
- ✅ Interactive control menu
- ✅ Real-time status updates
- ✅ Automatic reconnection on disconnect
- ✅ Token expiration monitoring

## Troubleshooting

### Connection Keeps Dropping

**Possible causes:**
- Network instability
- Firewall blocking WebSocket
- Server-side disconnect

**Solution:**
```javascript
const manager = new CieloConnectionManager(username, password, ip, {
  autoReconnect: true,
  maxReconnectAttempts: 10, // Try more times
  reconnectDelay: 10000,    // Wait 10s before retry
});
```

### High Captcha Costs

**Solutions:**
1. Increase `healthCheckInterval` to check less frequently
2. Increase `refreshBeforeExpiry` to use tokens longer (but risk disconnect)
3. Use on-demand connection pattern instead of always-on
4. Pool connections if serving multiple users

### Token Expires Before Reconnection

**Issue:** Connection drops before scheduled reconnection

**Solution:**
```javascript
const manager = new CieloConnectionManager(username, password, ip, {
  refreshBeforeExpiry: 600000, // Reconnect 10 minutes before expiry (safer)
});
```

## Best Practices

1. **Always use CieloConnectionManager** instead of raw CieloAPIConnection
2. **Set autoReconnect: true** for production
3. **Monitor connection status** periodically
4. **Handle disconnects gracefully** in your app
5. **Cache connections** when possible to minimize captcha solves
6. **Use health checks** to detect issues early
7. **Log reconnection events** to understand usage patterns

## Next Steps

- Try the interactive test: `node test-interactive.js`
- Integrate into your Apple Home setup
- Monitor costs in your 2Captcha dashboard
- Adjust reconnection intervals based on your usage

---

**Remember:** The WebSocket connection is your friend! Keep it alive and you'll minimize captcha solves and costs. 🎉
