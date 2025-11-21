# Traffic Capture Instructions

This directory is for capturing Cielo web UI traffic to reverse-engineer the new API.

## Quick Start (Recommended)

### 1. Start fresh capture
```bash
cd traffic-captures
./start-fresh-capture.sh
```

This will:
- Kill any existing capture processes
- Archive old capture files
- Start mitmdump on port 8888
- Open Chrome with proxy configured
- Direct you to https://home.cielowigle.com

### 2. Perform actions in Chrome

Once Chrome opens and you've logged in, perform these actions **in order**:

1. **Login** - Enter credentials and log in
2. **Select device** - Click on your thermostat/HVAC
3. **Power on** - Turn the unit ON
4. **Change temperature** - Increase or decrease by a few degrees
5. **Change mode** - Switch between heat/cool/auto
6. **Change fan speed** - If available
7. **Power off** - Turn the unit OFF
8. **Wait 30 seconds** - Capture any heartbeat/status messages
9. **Close Chrome** when done

### 3. Stop capture
```bash
./stop-capture.sh
```

This will show a summary of what was captured.

## Manual Setup (Advanced)

If the scripts don't work, you can manually set up the capture:

### 1. Start mitmproxy in dump mode

```bash
cd traffic-captures
mitmdump -w cielo-traffic.mitm --listen-port 8888
```

This will:
- Start the proxy on `localhost:8888`
- Save all traffic to `cielo-traffic.mitm`
- Log traffic to console

### 2. Open Chrome with proxy

```bash
./start-chrome-with-proxy.sh
```

Or manually:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --proxy-server="127.0.0.1:8888" \
  --user-data-dir="/tmp/chrome-mitm-profile" \
  --ignore-certificate-errors
```

### 3. Stop the capture

- Close Chrome
- Press `Ctrl+C` in the terminal where mitmdump is running

## Analyzing Captures

After capturing, you can view the API calls in the log:
```bash
# View all Cielo API calls
grep "smartcielo.com" mitmdump.log

# Count captured requests
grep "smartcielo.com" mitmdump.log | wc -l
```

## What's Being Captured

**YES - Being captured:**
- Cielo web UI traffic from Chrome (login, API calls, WebSocket messages)
- All HTTP/HTTPS requests to `*.smartcielo.com`

**NO - Not being captured:**
- Claude Code terminal session
- Other browsers or applications
- demo.js script (unless run with `-v` flag pointing to port 8888)

## Important Notes

- The capture files may contain your credentials - they're excluded from git
- Only one mitmdump instance should run at a time
- Chrome will show certificate warnings - this is expected
- Close Chrome completely when done to avoid capturing unrelated traffic
