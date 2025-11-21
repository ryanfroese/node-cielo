/**
 * Demo script for Cielo HVAC control
 *
 * REQUIRED: Set TWOCAPTCHA_API_KEY environment variable before running
 * Example: export TWOCAPTCHA_API_KEY="your-api-key"
 *
 * Usage: node demo.js -u username -p password -i ip -m macAddress
 */

/**
 * Includes
 */
const commandLineArgs = require('command-line-args');
const {CieloHVAC, CieloAPIConnection} = require('./Cielo.js');
const HttpsProxyAgent = require('https-proxy-agent');
const url = require('url');

/**
 * Constants
 */
const OPTION_DEFINITIONS = [
  {name: 'username', alias: 'u', type: String},
  {name: 'password', alias: 'p', type: String},
  {name: 'ip', alias: 'i', type: String},
  {name: 'verbose', alias: 'v', type: Boolean},
  {name: 'macAddress', alias: 'm', type: String},
];
const OPTIONS = commandLineArgs(OPTION_DEFINITIONS);

/**
 * Debug Proxy Settings
 */
const PROXY = 'http://127.0.0.1:8888';
const agentOptions = url.parse(PROXY);
const agent = OPTIONS.verbose ? new HttpsProxyAgent(agentOptions) : undefined;
if (agent) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

/**
 * Example Usage.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
(async () => {
  const api = new CieloAPIConnection(
    (commandedState) => {
      console.log('Commanded State Change:', JSON.stringify(commandedState));
    },
    (roomTemperature) => {
      console.log('Updated Room Temperature:', roomTemperature);
    },
    (err) => {
      console.error('Communication Error:', err);
    },
  );
  console.log('Connecting...');
  try {
    // Use automated captcha solving with the new API
    await api.establishConnectionWithAutoSolve(
      OPTIONS.username,
      OPTIONS.password,
      OPTIONS.ip,
      agent
    );
    // Uppercase mac address before subscribing
    OPTIONS.macAddress = OPTIONS.macAddress.toUpperCase();

    await api.subscribeToHVACs([OPTIONS.macAddress]);

    console.log("Connected, hvacs: ", api.hvacs.length);
    api.hvacs.forEach((hvac) => {
      console.log(hvac.toString());
    });

    // Get initial temperature and convert to number
    const temp = parseInt(api.hvacs[0].getTemperature());

    console.log("Sending power off");
    await api.hvacs[0].powerOff(api);
    await sleep(10000);
    api.hvacs.forEach((hvac) => {
      console.log(hvac.toString());
    });

    console.log("Sending power on");
    await api.hvacs[0].powerOn(api);
    await sleep(10000);
    api.hvacs.forEach((hvac) => {
      console.log(hvac.toString());
    });

    console.log("Sending temperature 68");
    await api.hvacs[0].setTemperature(68, api);
    await sleep(10000);
    api.hvacs.forEach((hvac) => {
      console.log(hvac.toString());
    });

    console.log("Sending temperature " + temp);
    await api.hvacs[0].setTemperature(temp, api);
    await sleep(10000);
    api.hvacs.forEach((hvac) => {
      console.log(hvac.toString());
    });
  } catch (error) {
    console.error('Caught an error...');
    console.error(error);
  }
})();
