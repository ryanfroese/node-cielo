#!/bin/bash
# This script opens Chrome with proxy settings bypassing system settings

# Kill any existing Chrome instances using the test profile
pkill -f "chrome-mitm-profile"

# Open Chrome with explicit proxy settings
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --proxy-server="127.0.0.1:8888" \
  --user-data-dir="/tmp/chrome-mitm-profile" \
  --ignore-certificate-errors \
  --ignore-urlfetcher-cert-requests \
  "http://mitm.it" &

echo "Chrome opened with proxy settings on port 8888"
echo "Visit http://mitm.it to verify the proxy is working"
echo ""
echo "When done capturing traffic, close Chrome and run:"
echo "  rm -rf /tmp/chrome-mitm-profile"
