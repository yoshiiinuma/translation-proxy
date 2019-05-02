
import fs from 'fs';

import { loadConfig } from './conf.js';
import Logger from './logger.js';
import { createProxyServer } from './proxy.js';

const usage = () => {
  console.log('');
  console.log('USAGE: npm run exec -- [CONFIGFILE]');
  console.log('USAGE: node dist/server.js [CONFIGFILE]');
  console.log('');
  console.log('CONFIGFILE:     default ./config/config.json');
  console.log('');
};

const DEFAULT_CONF = './config/config.json';
let filename = DEFAULT_CONF;

if (process.argv.length > 3) {
  usage();
  process.exit();
}

if (process.argv.length == 3) {
  filename = process.argv[2];
}
if (!fs.existsSync(filename)) {
  console.log('Config File Not Found: ' + filename + "\n");
  usage();
  process.exit();
}

const conf = loadConfig(filename);

Logger.initialize(conf);

const server = createProxyServer(conf);
server.start();

