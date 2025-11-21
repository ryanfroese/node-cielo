const querystring = require("querystring");
const fetch = require("node-fetch");
const WebSocket = require("ws");
const crypto = require("crypto");

// Constants
const API_HOST = "api.smartcielo.com";
const API_HTTP_PROTOCOL = "https://";
const PING_INTERVAL = 5 * 60 * 1000;
const DEFAULT_POWER = "off";
const DEFAULT_MODE = "auto";
const DEFAULT_FAN = "auto";
const DEFAULT_TEMPERATURE = 75;
const API_KEY = "XiZ0PkwbNlQmu3Zrt7XV3EHBj1b1bHU9k02MSJW2";
const APP_VERSION = "1.4.4";

// Exports
class CieloAPIConnection {
  // Connection information
  #sessionID;
  #userID;
  #accessToken;
  #refreshToken;
  #expiresIn;
  #agent;
  #commandCount = 0;
  #previousPowerStates = {}; // Track previous power states by MAC address

  /**
   * WebSocket connection to API
   *
   * @type WebSocket
   */
  #ws;

  /**
   * An array containing all subscribed HVACs
   *
   * @type CieloHVAC[]
   */
  hvacs = [];

  // Callbacks
  #commandCallback;
  #temperatureCallback;
  #errorCallback;

  /**
   * Creates an API connection object that will use the provided callbacks
   * once created.
   *
   * @param {function} commandCallback Callback that executes whenever a
   *      command is sent
   * @param {function} temperatureCallback Callback that executes whenever a
   *      temperature update is received
   * @param {function} errorCallback Callback that executes whenever an error
   *      is encountered
   */
  constructor(commandCallback, temperatureCallback, errorCallback) {
    this.#commandCallback = commandCallback;
    this.#temperatureCallback = temperatureCallback;
    this.#errorCallback = errorCallback;
  }

  // Connection methods
  /**
   * Creates the hvacs array using the provided macAddresses and establishes
   * the WebSockets connection to the API to receive updates.
   *
   * @param {string[]} macAddresses Optional MAC addresses of desired HVACs.
   *                                 If not provided or empty, subscribes to ALL devices on account.
   * @returns {Promise<void>} A Promise containing nothing if resolved, error
   *      if an error occurs establishing the WebSocket connection
   */
  async subscribeToHVACs(macAddresses = []) {
    // Clear the array of any previously subscribed HVACs
    this.hvacs = [];
    this.#commandCount = 0;

    // console.log("accessToken:", this.#accessToken);

    // Get the initial information on all devices
    const deviceInfo = await this.#getDeviceInfo();

    // Ensure the request was successful
    if (deviceInfo.error) return Promise.reject(deviceInfo.error);

    // If no MAC addresses specified, subscribe to ALL devices
    const subscribeToAll = !macAddresses || macAddresses.length === 0;

    // Extract the relevant HVACs from the results
    for (const device of deviceInfo.data.listDevices) {
      if (subscribeToAll || macAddresses.includes(device.macAddress)) {
        // Debug log device info
        const fs = require('fs');
        fs.appendFileSync('cielo-debug.log', `\n[${new Date().toISOString()}] SUBSCRIBING TO DEVICE:\n${JSON.stringify({
          macAddress: device.macAddress,
          deviceName: device.deviceName,
          applianceId: device.applianceId,
          fwVersion: device.fwVersion,
          deviceTypeVersion: device.deviceTypeVersion
        }, null, 2)}\n`);

        let hvac = new CieloHVAC(
          device.macAddress,
          device.deviceName,
          device.applianceId,
          device.fwVersion,
          device.deviceTypeVersion
        );
        hvac.updateState(
          device.latestAction.power,
          device.latestAction.temp,
          device.latestAction.mode,
          device.latestAction.fanspeed
        );
        hvac.updateRoomTemperature(device.latEnv.temp);
        this.hvacs.push(hvac);
      }
    }

    // Establish the WebSocket connection
    return this.#connect();
  }

  /**
   * Obtains authentication and socket connection information from the API.
   *
   * @param {string} username The username to login with
   * @param {string} password The password for the provided username (plaintext - will be hashed)
   * @param {string} ip The public IP address of the network the HVACs are on
   * @param {string} agent Optional parameter specifying the agent type to identify as during the request
   * @param {string} captchaToken Optional captcha token for exact web UI matching (recommended for Apple Home)
   * @returns {Promise<void>} A Promise containing nothing if resolved, and
   *      an error if one occurs during authentication
   */
  async establishConnection(username, password, ip, agent, captchaToken) {
    // Store agent for proxy support
    this.#agent = agent;

    await this.#getAccessTokenAndSessionId(username, password, ip, captchaToken).then(
      (data) => {
        // console.log(data);
        // Save the results
        this.#sessionID = data.sessionId;
        this.#userID = data.userId;
        this.#accessToken = data.accessToken;
        this.#refreshToken = data.refreshToken;
        this.#expiresIn = data.expiresIn;
        return;
      }
    );
    return Promise.resolve();
  }

  /**
   * Get the current refresh token (for persistent storage)
   *
   * Store this token securely to enable login without captcha.
   * Use refreshAccessToken() to get a new access token from a stored refresh token.
   *
   * @returns {string} The current refresh token
   */
  getRefreshToken() {
    return this.#refreshToken;
  }

  /**
   * Get the current access token expiration time
   *
   * @returns {number} Unix timestamp when the access token expires
   */
  getExpiresIn() {
    return this.#expiresIn;
  }

  /**
   * Refresh the access token using the stored refresh token
   *
   * This allows reconnecting WITHOUT captcha by using a previously saved refresh token.
   * This is how the iOS app stays logged in - it refreshes tokens instead of re-logging in.
   *
   * @param {string} refreshToken Optional refresh token to use (defaults to stored token)
   * @returns {Promise<void>} A Promise that resolves when the token is refreshed
   */
  async refreshAccessToken(refreshToken) {
    const tokenToUse = refreshToken || this.#refreshToken;

    if (!tokenToUse) {
      return Promise.reject(new Error('No refresh token available. Must login first.'));
    }

    const refreshUrl = new URL(
      `${API_HTTP_PROTOCOL}${API_HOST}/web/token/refresh?refreshToken=${tokenToUse}`
    );

    const refreshPayload = {
      agent: this.#agent,
      headers: {
        accept: "application/json, text/plain, */*",
        authorization: tokenToUse,
        "content-type": "application/json; charset=utf-8",
        "x-api-key": API_KEY,
      },
      method: "GET",
    };

    return fetch(refreshUrl, refreshPayload)
      .then((response) => {
        console.log('Refresh response status:', response.status);
        return response.json().then(json => ({ status: response.status, body: json }));
      })
      .then(({status, body}) => {
        console.log('Refresh response body:', JSON.stringify(body, null, 2));
        if (body.data) {
          // Update stored tokens
          this.#accessToken = body.data.accessToken;
          this.#refreshToken = body.data.refreshToken;
          this.#expiresIn = body.data.expiresIn;
          return Promise.resolve();
        } else {
          return Promise.reject(new Error('Token refresh failed (' + status + '): ' + (body.message || body.error?.message || 'Unknown error')));
        }
      })
      .catch((error) => {
        return Promise.reject(new Error('Token refresh failed: ' + error.message));
      });
  }

  /**
   * Establish connection with automated captcha solving
   *
   * This method automatically solves the Cloudflare Turnstile captcha using 2Captcha service
   * before establishing the connection. No manual captcha token required!
   *
   * REQUIREMENTS:
   * 1. Install: npm install (solveCaptcha.js is already in the project)
   * 2. Sign up at https://2captcha.com/ and add funds
   * 3. Set environment variables:
   *    - TWOCAPTCHA_API_KEY: Your 2Captcha API key
   *    - CIELO_TURNSTILE_SITEKEY: The Cloudflare Turnstile siteKey from Cielo's login page
   *
   * To find the siteKey, see instructions in solveCaptcha.js
   *
   * @param {string} username The account username/email
   * @param {string} password The account password (will be automatically SHA-256 hashed)
   * @param {string} ip The public IP address to authenticate from (or '0.0.0.0')
   * @param {*} agent Optional parameter specifying the agent type (for proxy support)
   * @param {Object} captchaOptions Optional 2Captcha configuration (see solveCaptcha.js)
   * @returns {Promise<void>} A Promise that resolves when connected, rejects on error
   *
   * @example
   * // Set environment variables first:
   * // export TWOCAPTCHA_API_KEY="your-api-key"
   * // export CIELO_TURNSTILE_SITEKEY="0x..."
   *
   * const api = new CieloAPIConnection(...);
   * await api.establishConnectionWithAutoSolve(
   *   'your@email.com',
   *   'yourpassword',
   *   '73.162.98.163'
   * );
   */
  async establishConnectionWithAutoSolve(username, password, ip, agent, captchaOptions = {}) {
    // Lazy-load the captcha solver to avoid requiring it if not used
    const { solveCieloCaptcha } = require('./solveCaptcha.js');

    console.log('🔓 Solving captcha automatically...');

    // Solve the captcha using 2Captcha
    const captchaToken = await solveCieloCaptcha(captchaOptions);

    console.log('✅ Captcha solved! Logging in...');

    // Use the regular establishConnection with the solved token
    return this.establishConnection(username, password, ip, agent, captchaToken);
  }

  /**
   * Get all devices on the account
   *
   * Returns a list of all devices associated with the account.
   * Useful for discovering available HVACs before subscribing.
   *
   * @returns {Promise<Array>} Array of device objects with macAddress, deviceName, etc.
   *
   * @example
   * const devices = await api.getAllDevices();
   * const macAddresses = devices.map(d => d.macAddress);
   * await api.subscribeToHVACs(macAddresses);
   */
  async getAllDevices() {
    const deviceInfo = await this.#getDeviceInfo();

    if (deviceInfo.error) {
      throw new Error(`Failed to get devices: ${deviceInfo.error.message}`);
    }

    // Return array of devices (structure is data.listDevices)
    return deviceInfo.data?.listDevices || [];
  }

  /**
   *
   * @returns
   */
  async #connect() {
    // Establish the WebSockets connection
    const connectUrl = new URL(
      "wss://apiwss.smartcielo.com/websocket/" +
        "?sessionId=" +
        this.#sessionID +
        "&token=" +
        this.#accessToken
    );

    // Match the web UI's WebSocket connection headers exactly
    const wsOptions = {
      headers: {
        'Origin': 'https://home.cielowigle.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      }
    };

    this.#ws = new WebSocket(connectUrl, wsOptions);

    // Start the socket when opened
    this.#ws.on("open", () => {
      this.#startSocket();
    });

    // Log errors for debugging
    this.#ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.#errorCallback(error);
    });

    // Provide notification to the error callback when the connection is
    // closed
    this.#ws.on("close", () => {
      this.#errorCallback(new Error("Connection Closed."));
    });

    // Subscribe to status updates
    this.#ws.on("message", (message) => {
      const data = JSON.parse(message);

      // Write to debug log file
      const fs = require('fs');
      const debugLog = `\n[${new Date().toISOString()}] RECEIVED MESSAGE:\n${JSON.stringify(data, null, 2)}\n`;
      fs.appendFileSync('cielo-debug.log', debugLog);

      // New API uses message_type field to identify message type
      if (
        data.message_type &&
        typeof data.message_type === "string" &&
        data.message_type.length > 0 &&
        data.action &&
        typeof data.action === "object"
      ) {
        const messageType = data.message_type;
        const status = data.action;
        const thisMac = data.mac_address;

        // Handle StateUpdate messages (replaces both WEB and Heartbeat)
        if (messageType === "StateUpdate") {
          // Update HVAC state
          this.hvacs.forEach((hvac, index) => {
            if (hvac.getMacAddress() === thisMac) {
              this.hvacs[index].updateState(
                status.power,
                status.temp,
                status.mode,
                status.fanspeed
              );

              // Update room temperature and humidity if available
              if (data.lat_env_var) {
                const roomTemp = data.lat_env_var.temperature;
                const humidity = data.lat_env_var.humidity;

                if (roomTemp !== undefined) {
                  this.hvacs[index].updateRoomTemperature(roomTemp);
                }

                // Store humidity if available (could add to CieloHVAC in future)
                // For now just pass it through callback
              }

              // Update previous power state
              this.#previousPowerStates[thisMac] = status.power;
            }
          });

          // Trigger command callback for state changes
          if (this.#commandCallback !== undefined) {
            this.#commandCallback(status);
          }

          // Trigger temperature callback if temperature data available
          if (this.#temperatureCallback !== undefined && data.lat_env_var && data.lat_env_var.temperature) {
            this.#temperatureCallback(data.lat_env_var.temperature);
          }
        }
      }
    });

    // Provide notification to the error callback when an error occurs
    this.#ws.on("error", (err) => {
      this.#errorCallback(err);
    });

    // Return a promise to notify the user when the socket is open
    return new Promise((resolve) => {
      this.#ws.on("open", () => {
        resolve();
      });
    });
  }

  // API Calls
  /**
   * Hashes a password using SHA-256 to match the web UI behavior
   *
   * @param {string} password The plaintext password
   * @returns {string} The SHA-256 hashed password (lowercase hex)
   */
  #hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Authenticates with the Cielo API and obtains access token, session ID,
   * and user ID.
   *
   * @param {string} username The username to login with
   * @param {string} password The password for the provided username
   * @param {string} ip The public IP address of the network the HVACs are on
   * @param {string} captchaToken Optional captcha token for web UI compatibility
   * @returns {Promise<Object>} A Promise containing the login data
   */
  async #getAccessTokenAndSessionId(username, password, ip, captchaToken) {
    const appUserUrl = new URL(API_HTTP_PROTOCOL + API_HOST + "/auth/login");

    // Hash the password to match web UI behavior
    const hashedPassword = this.#hashPassword(password);

    const requestBody = {
      user: {
        userId: username,
        password: hashedPassword,
        mobileDeviceId: "WEB",
        deviceTokenId: "WEB",
        appType: "WEB",
        appVersion: APP_VERSION,
        timeZone: "America/Los_Angeles",
        mobileDeviceName: "chrome",
        deviceType: "WEB",
        ipAddress: ip || "0.0.0.0",
        isSmartHVAC: 0,
        locale: "en",
      }
    };

    // Include captchaToken if provided (matches web UI exactly)
    if (captchaToken) {
      requestBody.captchaToken = captchaToken;
    }

    const appUserPayload = {
      agent: this.#agent,
      method: "POST",
      headers: {
        authority: "api.smartcielo.com",
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/json; charset=UTF-8",
        origin: "https://home.cielowigle.com",
        pragma: "no-cache",
        referer: "https://home.cielowigle.com/",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(requestBody),
    };

    console.log("Request body:", JSON.stringify(requestBody, null, 2));

    const loginData = await fetch(appUserUrl, appUserPayload)
      .then((response) => response.json())
      .then((responseJSON) => {
        console.log("Login response:", JSON.stringify(responseJSON, null, 2));

        // Check for successful response
        if (responseJSON.status !== 200 || !responseJSON.data || !responseJSON.data.user) {
          throw new Error(`Login failed: ${responseJSON.message || 'Unknown error'}`);
        }

        const initialLoginData = responseJSON.data.user;
        return initialLoginData;
      })
      .catch((error) => {
        console.error("Login error:", error);
        throw error;
      });
    return loginData;
  }

  /**
   * Performs the initial subscription to the API, providing current status of
   * all devices in the account.
   *
   * @param {any} accessCredentials A JSON object containing valid credentials
   * @returns {Promise<any>} A Promise containing the JSON response
   */
  async #getDeviceInfo() {
    const deviceInfoUrl = new URL(
      API_HTTP_PROTOCOL + API_HOST + "/web/devices?limit=420"
    );
    const deviceInfoPayload = {
      agent: this.#agent,
      method: "GET",
      headers: {
        authority: "api.smartcielo.com",
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        authorization: this.#accessToken,
        "cache-control": "no-cache",
        "content-type": "application/json; charset=utf-8",
        origin: "https://home.cielowigle.com",
        pragma: "no-cache",
        referer: "https://home.cielowigle.com/",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "macOS",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
        "x-api-key": "7xTAU4y4B34u8DjMsODlEyprRRQEsbJ3IB7vZie4",
      },
    };
    const devicesData = await fetch(deviceInfoUrl, deviceInfoPayload)
      .then((response) => response.json())
      .then((responseJSON) => {
        // console.log("devicesResponse... ", responseJSON.data.listDevices);
        return responseJSON;
      })
      .catch((error) => {
        console.error(error);
        return;
      });
    return devicesData;
  }

  /**
   * Starts the WebSocket connection and periodically pings it to keep it
   * alive
   *
   * @returns {Promise<any>} A Promise containing nothing if resolved, and an
   *      error if rejected
   */
  async #startSocket() {
    // Periodically ping the socket to keep it alive, seems to be unnessesary with current API
    // setInterval(async () => {
    //   try {
    //     console.log('pinging socket');
    //     await this.#pingSocket();
    //   } catch (error) {
    //     this.#errorCallback(error);
    //   }
    // }, PING_INTERVAL);

    return Promise.resolve();
  }

  /**
   *This refreshes the token by returning a refreshed token, may not be neccesary with the new API
   * @returns
   */
  async #pingSocket() {
    const time = new Date();
    const pingUrl = new URL(
      "https://api.smartcielo.com/web/token/refresh" +
        "?refreshToken=" +
        this.#accessToken
    );
    const pingPayload = {
      agent: this.#agent,
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        authorization: this.#accessToken,
        "cache-control": "no-cache",
        "content-type": "application/json; charset=utf-8",
        pragma: "no-cache",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "x-api-key": "7xTAU4y4B34u8DjMsODlEyprRRQEsbJ3IB7vZie4",
      },
      referrer: "https://home.cielowigle.com/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: null,
      method: "GET",
      mode: "cors",
      credentials: "include",
    };
    const pingResponse = await fetch(pingUrl, pingPayload)
      .then((response) => response.json())
      .then((responseJSON) => {
        const expires = new Date(responseJSON.data.expiresIn * 1000);
        // Calculate the difference between the two dates in minutes
        const diffMinutes = Math.round((expires - time) / 60000);

        // Log the difference to the console
        console.log(
          `The refreshed token will expire in ${diffMinutes} minutes.`
        );
        return responseJSON;
      })
      .catch((error) => {
        console.error(error);
        return;
      });

    return pingResponse;
  }

  // Utility methods
  /**
   * Creates an object containing all necessary fields for a command
   *
   * @param {string} temp Temperature setting
   * @param {string} power Power state, on or off
   * @param {string} fanspeed Fan speed setting
   * @param {string} mode Mode setting, heat, cool, or auto
   * @param {string} macAddress Device MAC address
   * @param {number} applianceID Appliance ID
   * @param {boolean} isAction Whether or not the command is an action
   * @param {string} performedAction Value this command is modifying
   * @param {string} performedValue Updated value for command
   * @param {string} mid Session ID
   * @param {string} deviceTypeVersion Device type version
   * @param {string} fwVersion Firmware version
   * @returns {any}
   */
  #buildCommand(
    temp,
    power,
    fanspeed,
    mode,
    isAction,
    performedAction,
    performedValue
  ) {
    // Convert temp to string for actions object (API expects string, not number)
    const tempValue = isAction && performedAction === "temp" ? String(performedValue) : temp;

    return {
      power: isAction && performedAction === "power" ? performedValue : power,
      mode: isAction && performedAction === "mode" ? performedValue : mode,
      fanspeed: isAction && performedAction === "fanspeed" ? performedValue : fanspeed,
      temp: tempValue,
      swing: "adjust",
      swinginternal: "",
      turbo: "off",
      light: "on/off",
      followme: "off",
    };
  }

  /**
   * Returns a JSON command payload to execute a parameter change
   *
   * @param {CieloHVAC} hvac The HVAC to perform the action on
   * @param {string} performedAction The parameter to change
   * @param {string} performedActionValue The value to change it to
   * @returns {string}
   */
  #buildCommandPayload(hvac, performedAction, performedActionValue) {
    const commandCount = this.#commandCount++;
    const macAddress = hvac.getMacAddress();

    // Track previous power state for this device
    const oldPower = this.#previousPowerStates[macAddress] || "off";

    // Update power state if this is a power command
    if (performedAction === "power") {
      this.#previousPowerStates[macAddress] = performedActionValue;
    }

    const result = JSON.stringify({
      action: "actionControl",
      actionSource: "WEB",
      applianceType: "AC",
      macAddress: macAddress,
      deviceTypeVersion: hvac.getDeviceTypeVersion() || "BI01",
      fwVersion: hvac.getFwVersion(),
      applianceId: hvac.getApplianceID(),
      actionType: performedAction,
      actionValue: performedActionValue,
      connection_source: 0,
      user_id: this.#userID,
      preset: 0,
      oldPower: oldPower,
      myRuleConfiguration: {},
      mid: "WEB",
      actions: this.#buildCommand(
        hvac.getTemperature(),
        hvac.getPower(),
        hvac.getFanSpeed(),
        hvac.getMode(),
        true,
        performedAction,
        performedActionValue
      ),
      application_version: APP_VERSION,
      ts: Math.round(Date.now() / 1000),
    });
    return result;
  }

  /**
   * Sends a command to the HVAC
   *
   * @param {CieloHVAC} hvac The HVAC to perform the action on
   * @param {string} performedAction The parameter to change
   * @param {string} performedActionValue The value to change it to
   * @returns {Promise<void>}
   */
  async sendCommand(hvac, performedAction, performedActionValue) {
    const payload = this.#buildCommandPayload(hvac, performedAction, performedActionValue);

    // Write to debug log file
    const fs = require('fs');
    const debugLog = `\n[${new Date().toISOString()}] SENDING COMMAND:\n${JSON.stringify(JSON.parse(payload), null, 2)}\n`;
    fs.appendFileSync('cielo-debug.log', debugLog);

    return new Promise((resolve, reject) => {
      this.#ws.send(payload, (error) => {
        if (error) {
          fs.appendFileSync('cielo-debug.log', `ERROR: ${error.message}\n`);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

class CieloHVAC {
  #power = DEFAULT_POWER;
  #temperature = DEFAULT_TEMPERATURE;
  #mode = DEFAULT_MODE;
  #fanSpeed = DEFAULT_FAN;
  #roomTemperature = DEFAULT_TEMPERATURE;
  #deviceName = "HVAC";
  #macAddress = "0000000000";
  #deviceTypeVersion = "BI01";
  #applianceID = 0;
  #fwVersion = "0.0.0";

  /**
   * Creates a new HVAC with the provided parameters
   *
   * @param {string} macAddress HVAC's MAC address
   * @param {string} deviceName HVAC's name
   * @param {number} applianceID Internal appliance ID
   * @param {string} fwVersion Firmware version
   */
  constructor(
    macAddress,
    deviceName,
    applianceID,
    fwVersion,
    deviceTypeVersion
  ) {
    this.#macAddress = macAddress;
    this.#deviceName = deviceName;
    this.#applianceID = applianceID;
    this.#fwVersion = fwVersion;

    if (deviceTypeVersion && (deviceTypeVersion.startsWith("BI") || deviceTypeVersion.startsWith("BP"))) {
      this.#deviceTypeVersion = deviceTypeVersion;
    } else {
      // Defaults back to BP01 if the deviceTypeVersion is not valid
      console.warn(`Invalid deviceTypeVersion: ${deviceTypeVersion}, defaulting to BP01`);
      this.#deviceTypeVersion = "BP01";
    }
  }

  /**
   * Returns the current power state
   *
   * @returns {string}
   */
  getPower() {
    return this.#power;
  }

  /**
   * Returns the current temperature setting
   *
   * @returns {string}
   */
  getTemperature() {
    return this.#temperature;
  }

  /**
   * Returns the current mode setting
   *
   * @returns {string}
   */
  getMode() {
    return this.#mode;
  }

  /**
   * Returns the current fan speed
   *
   * @returns {string}
   */
  getFanSpeed() {
    return this.#fanSpeed;
  }

  /**
   * Returns the current room temperature
   *
   * @returns {string}
   */
  getRoomTemperature() {
    return this.#roomTemperature;
  }

  /**
   * Returns the device's MAC address
   *
   * @returns {string}
   */
  getMacAddress() {
    return this.#macAddress;
  }

  /**
   * Returns the device type version
   * @returns {string}
   */
  getDeviceTypeVersion() {
    return this.#deviceTypeVersion;
  }

  /**
   * Returns the appliance ID
   *
   * @returns {number}
   */
  getApplianceID() {
    return this.#applianceID;
  }

  /**
   * Returns the device's firmware version
   *
   * @returns {string}
   */
  getFwVersion() {
    return this.#fwVersion;
  }

  /**
   * Returns the device's name
   *
   * @returns {string}
   */
  getDeviceName() {
    return this.#deviceName;
  }

  /**
   * Returns a string representation containing state data
   *
   * @returns {string}
   */
  toString() {
    return (
      this.#deviceName +
      " " +
      this.#macAddress +
      ": " +
      [
        this.#power,
        this.#mode,
        this.#fanSpeed,
        this.#temperature,
        this.#roomTemperature,
      ].join(", ")
    );
  }

  /**
   * Updates the state of the HVAC using the provided parameters
   *
   * @param {string} power Updated power state, on or off
   * @param {string} temperature Updated temperature setting
   * @param {string} mode Updated mode, heat, cool, or auto
   * @param {string} fanSpeed Updated fan speed
   */
  updateState(power, temperature, mode, fanSpeed) {
    // TODO: Do some bounds checking
    this.#power = power;
    this.#temperature = temperature;
    this.#mode = mode;
    this.#fanSpeed = fanSpeed;
  }

  /**
   * Updates the measured room temperature
   *
   * @param {string} roomTemperature Updated room temperature
   */
  updateRoomTemperature(roomTemperature) {
    this.#roomTemperature = roomTemperature;
  }

  setMode(mode, api) {
    return api.sendCommand(this, "mode", mode);
  }

  setFanSpeed(fanspeed, api) {
    return api.sendCommand(this, "fanspeed", fanspeed);
  }

  setTemperature(temperature, api) {
    return api.sendCommand(this, "temp", temperature);
  }

  /**
   * Powers on the HVAC
   *
   * @param {CieloAPIConnection} api The API to use to execute the command
   * @return {Promise<void>}
   */
  powerOn(api) {
    return api.sendCommand(this, "power", "on");
  }

  /**
   * Powers off the HVAC
   *
   * @param {CieloAPIConnection} api The API to use to execute the command
   * @return {Promise<void>}
   */
  powerOff(api) {
    return api.sendCommand(this, "power", "off");
  }
}

module.exports = {
  CieloHVAC: CieloHVAC,
  CieloAPIConnection: CieloAPIConnection,
};
