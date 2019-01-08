
import fs from 'fs';
import http from 'http';
import https from 'https';

import Logger from './logger.js';
import { loadConfig } from './conf.js';
import { setUpProxy, clientError } from './proxy.js';

const setUncaughtExceptionHandler = () => {
  process.on('uncaughtException', (err) => {
    Logger.fatal('########################################################################');
    Logger.fatal('Uncaught Exception');
    Logger.fatal(err);
    Logger.fatal('########################################################################');
  });
  process.on('unhandledRejection', (reason, p) => {
    Logger.fatal('########################################################################');
    Logger.fatal('Unhandled Rejection');
    Logger.fatal(reason);
    Logger.fatal(p);
    Logger.fatal('########################################################################');
  });
};

const conf = loadConfig('./config/config.json');

const certs = {
  key: fs.readFileSync(conf.sslKey),
  cert: fs.readFileSync(conf.sslCert),
};

const proxy = setUpProxy(conf);

const httpServer = http.createServer(proxy.serve);
const httpsServer = https.createServer(certs, proxy.serve);
const serverHttpPort = conf.serverHttpPort || 80;
const serverHttpsPort = conf.serverHttpsPort || 443;

httpServer.on('clientError', clientError);
httpsServer.on('clientError', clientError);

httpServer.listen(serverHttpPort, '0.0.0.0');
httpsServer.listen(serverHttpsPort, '0.0.0.0');

