#!/bin/bash
# Start a fresh traffic capture session for Cielo API analysis

echo "=== Cielo Traffic Capture - Fresh Start ==="
echo ""

# Kill any existing mitmdump processes
echo "1. Stopping any existing mitmdump processes..."
pkill -9 mitmdump 2>/dev/null
sleep 1

# Kill any existing Chrome instances using the proxy profile
echo "2. Closing any Chrome instances with proxy profile..."
pkill -f "chrome-mitm-profile" 2>/dev/null
sleep 1

# Archive old capture if it exists
if [ -f "cielo-traffic.mitm" ]; then
    echo "3. Archiving old capture file..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    mv cielo-traffic.mitm "cielo-traffic-${timestamp}.mitm.old"
    mv mitmdump.log "mitmdump-${timestamp}.log.old" 2>/dev/null
fi

# Start fresh mitmdump
echo "4. Starting mitmdump on port 8888..."
mitmdump -w cielo-traffic.mitm --listen-port 8888 > mitmdump.log 2>&1 &
MITM_PID=$!
sleep 2

# Check if mitmdump started successfully
if ps -p $MITM_PID > /dev/null; then
    echo "   ✓ mitmdump running (PID: $MITM_PID)"
else
    echo "   ✗ Failed to start mitmdump"
    exit 1
fi

# Open Chrome with proxy
echo "5. Opening Chrome with proxy configuration..."
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --proxy-server="127.0.0.1:8888" \
  --user-data-dir="/tmp/chrome-mitm-profile" \
  --ignore-certificate-errors \
  --ignore-urlfetcher-cert-requests \
  "https://home.cielowigle.com" &

echo ""
echo "=== Capture is ready! ==="
echo ""
echo "Next steps:"
echo "  1. In Chrome, log in to your Cielo account"
echo "  2. Select a thermostat/HVAC unit"
echo "  3. Perform these actions:"
echo "     - Turn power ON"
echo "     - Change temperature (up and down)"
echo "     - Change mode (heat/cool/auto)"
echo "     - Change fan speed (if available)"
echo "     - Turn power OFF"
echo "     - Wait 30 seconds for heartbeat messages"
echo "  4. Close Chrome when done"
echo ""
echo "To stop capture: ./stop-capture.sh"
echo ""
echo "Capture file: cielo-traffic.mitm"
echo "Log file: mitmdump.log"
