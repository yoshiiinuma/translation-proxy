
import fs from 'fs';
import http from 'http';
import https from 'https';

import Logger from './logger.js';
import { loadConfig } from './conf.js';
//import { setUpProxy } from './proxy.js';
//import { createHtmlPageTranslator } from './page-translator.js';
import { createRequestHandler } from './request-handler.js';
import { clientError } from './error-handler.js';
import { setUpPreprocessor } from './middle-preprocess.js';
import MiddleCache from './middle-cache.js';
import { setTranslator } from './response-handler.js';

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

Logger.initialize(conf);

const certs = {
  key: fs.readFileSync(conf.sslKey),
  cert: fs.readFileSync(conf.sslCert),
};

const translator = createHtmlPageTranslator(conf);
//const proxy = setUpProxy(conf, translator);

const RequestHandler = createRequestHandler();

setTranslator(translator);
RequestHandler.use(setUpPreprocessor(conf));
RequestHandler.use(MiddleCache);

const httpServer = http.createServer(RequestHandler.serve);
const httpsServer = https.createServer(certs, RequestHandler.serve);
const serverHttpPort = conf.serverHttpPort || 80;
const serverHttpsPort = conf.serverHttpsPort || 443;

httpServer.on('clientError', clientError);
httpsServer.on('clientError', clientError);

httpServer.listen(serverHttpPort, '0.0.0.0');
httpsServer.listen(serverHttpsPort, '0.0.0.0');

