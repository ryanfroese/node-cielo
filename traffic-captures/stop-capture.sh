#!/bin/bash
# Stop the traffic capture and analyze results

echo "=== Stopping Cielo Traffic Capture ==="
echo ""

# Close Chrome
echo "1. Closing Chrome with proxy profile..."
pkill -f "chrome-mitm-profile"
sleep 2

# Stop mitmdump
echo "2. Stopping mitmdump..."
pkill -INT mitmdump
sleep 3

# Verify it stopped
if pgrep mitmdump > /dev/null; then
    echo "   Force stopping mitmdump..."
    pkill -9 mitmdump
    sleep 1
fi

echo "   ✓ mitmdump stopped"

# Show file sizes
echo ""
echo "=== Capture Summary ==="
if [ -f "cielo-traffic.mitm" ]; then
    size=$(ls -lh cielo-traffic.mitm | awk '{print $5}')
    echo "Capture file: cielo-traffic.mitm ($size)"
fi

if [ -f "mitmdump.log" ]; then
    size=$(ls -lh mitmdump.log | awk '{print $5}')
    echo "Log file: mitmdump.log ($size)"

    echo ""
    echo "API calls captured:"
    grep -E "(POST|GET|PUT).*(smartcielo\.com)" mitmdump.log | grep -v "OPTIONS" | wc -l | xargs echo "  HTTP requests:"
    grep "WebSocket.*message" mitmdump.log | wc -l | xargs echo "  WebSocket messages:"
fi

echo ""
echo "✓ Capture stopped. You can now analyze the results."
