
import fs from 'fs';
import http from 'http';
import https from 'https';

import Logger from './logger.js';
import { loadConfig } from './conf.js';
import { clientError } from './error-handler.js';
import AgentSelector from './agent-selector.js';
import createResponseCache from './response-cache.js';
import { createHtmlPageTranslator } from './page-translator.js';
import { setUpRequestHandler } from './request-handler.js';
import { setUpResponseHandler } from './response-handler.js';
import { setUpPreprocessor } from './middle-preprocess.js';
import { setUpMiddleFirewall } from './middle-firewall.js';
import { setUpMiddleCachePurger } from './middle-cache-purger.js';
import { setUpMiddleCache } from './middle-cache.js';
import { setUpMiddleProxy } from './middle-proxy.js';

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

setUncaughtExceptionHandler();

const conf = loadConfig('./config/config.json');

Logger.initialize(conf);

const certs = {
  key: fs.readFileSync(conf.sslKey),
  cert: fs.readFileSync(conf.sslCert),
};

const Translator = createHtmlPageTranslator(conf);
const ResponseCache = createResponseCache(conf);

const RequestHandler = setUpRequestHandler();
const ResponseHandler = setUpResponseHandler(Translator, ResponseCache);

const MiddlePreprocessor = setUpPreprocessor(conf);
const MiddleFirewall = setUpMiddleFirewall(conf);
const MiddleCachePurger = setUpMiddleCachePurger(ResponseCache);
const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);
const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);

RequestHandler.use(MiddlePreprocessor);
RequestHandler.use(MiddleFirewall);
RequestHandler.use(MiddleCachePurger);
RequestHandler.use(MiddleCache);
RequestHandler.use(MiddleProxy);

const httpServer = http.createServer(RequestHandler.serve);
const httpsServer = https.createServer(certs, RequestHandler.serve);
const serverHttpPort = conf.serverHttpPort || 80;
const serverHttpsPort = conf.serverHttpsPort || 443;

httpServer.on('clientError', clientError);
httpsServer.on('clientError', clientError);

httpServer.listen(serverHttpPort, '0.0.0.0');
httpsServer.listen(serverHttpsPort, '0.0.0.0');

