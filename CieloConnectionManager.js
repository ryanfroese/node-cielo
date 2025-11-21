/**
 * Cielo Connection Manager
 *
 * Manages a persistent connection to the Cielo API with automatic reconnection.
 * Keeps the WebSocket alive as long as possible to minimize captcha solves.
 *
 * Features:
 * - Automatic reconnection on disconnect
 * - Token expiration monitoring
 * - Connection health checks
 * - Minimizes captcha solves by keeping connection alive
 */

const { CieloAPIConnection } = require('./Cielo.js');

class CieloConnectionManager {
  constructor(username, password, ip, options = {}) {
    this.username = username;
    this.password = password;
    this.ip = ip;
    this.macAddresses = options.macAddresses || [];

    // Callbacks
    this.onStateChange = options.onStateChange || ((state) => console.log('State:', state));
    this.onTemperature = options.onTemperature || ((temp) => console.log('Temp:', temp));
    this.onError = options.onError || ((err) => console.error('Error:', err));
    this.onConnected = options.onConnected || (() => console.log('Connected!'));
    this.onDisconnected = options.onDisconnected || (() => console.log('Disconnected'));

    // Connection state
    this.api = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 5000; // 5 seconds
    this.tokenExpiresAt = null;
    this.tokenRefreshTimer = null;
    this.healthCheckTimer = null;

    // Options
    this.autoReconnect = options.autoReconnect !== false; // Default true
    this.healthCheckInterval = options.healthCheckInterval || 60000; // 1 minute
    this.refreshBeforeExpiry = options.refreshBeforeExpiry || 300000; // 5 minutes
    this.disableTokenRefresh = options.disableTokenRefresh || false; // New: disable token-based refresh
  }

  /**
   * Connect to Cielo API and subscribe to HVACs
   */
  async connect() {
    try {
      console.log('🔌 Connecting to Cielo API...');

      this.api = new CieloAPIConnection(
        (state) => this.onStateChange(state),
        (temp) => this.onTemperature(temp),
        (err) => this.handleError(err)
      );

      // Use automated captcha solving
      await this.api.establishConnectionWithAutoSolve(
        this.username,
        this.password,
        this.ip
      );

      // Subscribe to HVACs if provided
      if (this.macAddresses.length > 0) {
        await this.api.subscribeToHVACs(this.macAddresses);
      }

      // Mark as connected
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Track token expiration
      this.tokenExpiresAt = this.api.getExpiresIn() * 1000; // Convert to ms
      console.log(`✅ Connected! Token expires at ${new Date(this.tokenExpiresAt).toLocaleString()}`);

      // Start monitoring
      this.startHealthCheck();
      this.scheduleTokenRefresh();

      this.onConnected();

      return this.api;

    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      this.isConnected = false;

      if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        throw error;
      }
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    console.log('🔌 Disconnecting...');

    this.stopHealthCheck();
    this.stopTokenRefresh();

    this.isConnected = false;
    this.api = null;

    this.onDisconnected();
  }

  /**
   * Get the API instance
   */
  getApi() {
    if (!this.isConnected || !this.api) {
      throw new Error('Not connected. Call connect() first.');
    }
    return this.api;
  }

  /**
   * Get all HVACs
   */
  getHvacs() {
    return this.getApi().hvacs;
  }

  /**
   * Find HVAC by MAC address
   */
  findHvac(macAddress) {
    const hvacs = this.getHvacs();
    return hvacs.find(h => h.getMacAddress().toUpperCase() === macAddress.toUpperCase());
  }

  /**
   * Subscribe to additional HVACs
   */
  async subscribeToHvacs(macAddresses) {
    await this.getApi().subscribeToHVACs(macAddresses);
    this.macAddresses = [...new Set([...this.macAddresses, ...macAddresses])];
  }

  /**
   * Handle errors
   */
  handleError(err) {
    console.error('⚠️  Error:', err.message);

    // Check if it's a connection error
    if (err.message.includes('WebSocket') || err.message.includes('connection')) {
      this.isConnected = false;

      if (this.autoReconnect) {
        console.log('🔄 Connection lost, will attempt to reconnect...');
        this.scheduleReconnect();
      }
    }

    this.onError(err);
  }

  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    const maxDelay = 5 * 60 * 1000; // Max 5 minutes
    const actualDelay = Math.min(delay, maxDelay);

    console.log(`⏳ Reconnecting in ${Math.round(actualDelay / 1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, actualDelay);
  }

  /**
   * Start health check to monitor connection
   */
  startHealthCheck() {
    this.stopHealthCheck(); // Clear any existing

    this.healthCheckTimer = setInterval(() => {
      if (!this.isConnected) {
        console.log('⚠️  Health check failed: Not connected');
        this.stopHealthCheck();

        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      } else {
        // Connection is alive
        console.log('💚 Health check: Connection alive');
      }
    }, this.healthCheckInterval);
  }

  /**
   * Stop health check
   */
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Schedule token refresh before it expires
   *
   * Note: Token refresh doesn't work for web clients, so we'll need to
   * reconnect with a new captcha solve when the token expires.
   *
   * However, WebSocket connections can stay alive longer than token expiry.
   * Set disableTokenRefresh: true to only reconnect on actual connection loss.
   */
  scheduleTokenRefresh() {
    this.stopTokenRefresh(); // Clear any existing

    // Skip token-based refresh if disabled (rely only on health checks)
    if (this.disableTokenRefresh) {
      console.log('⏰ Token refresh disabled - will only reconnect on connection loss');
      return;
    }

    if (!this.tokenExpiresAt) {
      return;
    }

    const now = Date.now();
    const expiresIn = this.tokenExpiresAt - now;
    const refreshAt = expiresIn - this.refreshBeforeExpiry;

    if (refreshAt <= 0) {
      // Token is about to expire or already expired
      console.log('⚠️  Token expired or expiring soon');
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
      return;
    }

    console.log(`⏰ Will reconnect in ${Math.round(refreshAt / 60000)} minutes (before token expires)`);

    this.tokenRefreshTimer = setTimeout(() => {
      console.log('🔄 Token expiring soon, reconnecting with fresh captcha...');
      this.disconnect();
      this.connect();
    }, refreshAt);
  }

  /**
   * Stop token refresh timer
   */
  stopTokenRefresh() {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      tokenExpiresAt: this.tokenExpiresAt,
      timeUntilExpiry: this.tokenExpiresAt ? this.tokenExpiresAt - Date.now() : null,
      hvacCount: this.api?.hvacs?.length || 0,
    };
  }
}

module.exports = { CieloConnectionManager };
