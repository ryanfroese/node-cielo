#!/bin/bash

# Setup script for 2Captcha automated captcha solving

echo "=========================================="
echo "  2Captcha Setup for node-cielo"
echo "=========================================="
echo ""

# Step 1: Get API Key
echo "📋 STEP 1: Get your 2Captcha API Key"
echo ""
echo "1. Go to: https://2captcha.com/setting"
echo "2. Copy your API Key"
echo ""
read -p "Enter your 2Captcha API Key: " API_KEY
echo ""

if [ -z "$API_KEY" ]; then
    echo "❌ API Key cannot be empty!"
    exit 1
fi

echo "✅ API Key saved!"
echo ""

# Step 2: Get SiteKey
echo "📋 STEP 2: Find the Cloudflare Turnstile siteKey"
echo ""
echo "Follow these steps to find the siteKey:"
echo ""
echo "1. Open Chrome browser"
echo "2. Go to: https://home.cielowigle.com"
echo "3. Press F12 to open DevTools"
echo "4. Click the 'Console' tab"
echo "5. Paste this code and press Enter:"
echo ""
echo "-------------------------------------------"
echo "document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey') || 'Not found - check Network tab'"
echo "-------------------------------------------"
echo ""
echo "If that doesn't work, try the Network tab:"
echo "  a. Click 'Network' tab in DevTools"
echo "  b. Refresh the page"
echo "  c. Filter for: cloudflare"
echo "  d. Look in request URLs for 'sitekey=0x...'"
echo ""
read -p "Enter the siteKey (starts with 0x): " SITE_KEY
echo ""

if [ -z "$SITE_KEY" ]; then
    echo "❌ SiteKey cannot be empty!"
    exit 1
fi

if [[ ! $SITE_KEY == 0x* ]]; then
    echo "⚠️  Warning: SiteKey should start with '0x'"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ SiteKey saved!"
echo ""

# Step 3: Save to environment
echo "📋 STEP 3: Save environment variables"
echo ""

# Determine shell config file
if [ -n "$ZSH_VERSION" ]; then
    CONFIG_FILE="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    CONFIG_FILE="$HOME/.bashrc"
else
    CONFIG_FILE="$HOME/.profile"
fi

echo "Detected config file: $CONFIG_FILE"
echo ""

# Check if already exists
if grep -q "TWOCAPTCHA_API_KEY" "$CONFIG_FILE" 2>/dev/null; then
    echo "⚠️  Found existing TWOCAPTCHA_API_KEY in $CONFIG_FILE"
    read -p "Replace it? (y/n): " REPLACE
    if [[ $REPLACE =~ ^[Yy]$ ]]; then
        # Remove old entries
        sed -i.bak '/TWOCAPTCHA_API_KEY/d' "$CONFIG_FILE"
        sed -i.bak '/CIELO_TURNSTILE_SITEKEY/d' "$CONFIG_FILE"
    fi
fi

# Add to config file
echo "" >> "$CONFIG_FILE"
echo "# 2Captcha configuration for node-cielo" >> "$CONFIG_FILE"
echo "export TWOCAPTCHA_API_KEY=\"$API_KEY\"" >> "$CONFIG_FILE"
echo "export CIELO_TURNSTILE_SITEKEY=\"$SITE_KEY\"" >> "$CONFIG_FILE"

# Also set for current session
export TWOCAPTCHA_API_KEY="$API_KEY"
export CIELO_TURNSTILE_SITEKEY="$SITE_KEY"

echo "✅ Environment variables added to $CONFIG_FILE"
echo ""

# Step 4: Test
echo "📋 STEP 4: Test the configuration"
echo ""
read -p "Run test now? (y/n): " RUN_TEST

if [[ $RUN_TEST =~ ^[Yy]$ ]]; then
    echo ""
    echo "Running test..."
    echo ""
    node test-auto-captcha.js
else
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "To test later, run:"
    echo "  source $CONFIG_FILE"
    echo "  node test-auto-captcha.js"
    echo ""
fi

echo ""
echo "=========================================="
echo "  Setup Complete! 🎉"
echo "=========================================="
echo ""
echo "Your credentials are saved in: $CONFIG_FILE"
echo ""
echo "Next steps:"
echo "1. Open a new terminal (or run: source $CONFIG_FILE)"
echo "2. Run: node test-auto-captcha.js"
echo ""
