
import fs from 'fs';
import http from 'http';
import https from 'https';
import stoppable from 'stoppable';

import Logger from './logger.js';
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

const DEFAULT_GRACE = 3000;

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

const serverCloseError = (err) => {
  Logger.error('Server Close Error');
  Logger.error(err);
}

const setupRequestHandler = (conf) => {
  const Translator = createHtmlPageTranslator(conf);
  const ResponseCache = createResponseCache(conf);

  const ResponseHandler = setUpResponseHandler(Translator, ResponseCache);

  const MiddlePreprocessor = setUpPreprocessor(conf);
  const MiddleFirewall = setUpMiddleFirewall(conf);
  const MiddleCachePurger = setUpMiddleCachePurger(ResponseCache);
  const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);
  const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);

  const RequestHandler = setUpRequestHandler();
  RequestHandler.use(MiddlePreprocessor);
  RequestHandler.use(MiddleFirewall);
  RequestHandler.use(MiddleCachePurger);
  RequestHandler.use(MiddleCache);
  RequestHandler.use(MiddleProxy);

  return {
    RequestHandler,
    ResponseCache
  };
};

export const createProxyServer = (conf) => {
  const grace = (conf.shutdownGrace) ? parseInt(conf.shutdownGrace) : DEFAULT_GRACE;
  const certs = {
    key: fs.readFileSync(conf.sslKey),
    cert: fs.readFileSync(conf.sslCert),
  };

  const serverHttpPort = conf.serverHttpPort || 80;
  const serverHttpsPort = conf.serverHttpsPort || 443;
  let httpServer;
  let httpsServer;
  let shuttingDown = false;
  let graceful = true;
  let running = false;

  const { RequestHandler, ResponseCache } = setupRequestHandler(conf);

  const createServer = () => {
    //httpServer = http.createServer(RequestHandler.serve);
    //httpsServer = https.createServer(certs, RequestHandler.serve);
    httpServer = stoppable(http.createServer(RequestHandler.serve));
    httpsServer = stoppable(https.createServer(certs, RequestHandler.serve));

    httpServer.on('clientError', clientError);
    httpsServer.on('clientError', clientError);
    httpServer.isRunning = false;
    httpsServer.isRunning = false;
  };

  const shutdownServer = (server) => {
    server.stop((err, rslt) => {
      if (err) {
        serverCloseError(err);
        process.exit(1);
      }
      server.isRunning = false;
      shutdownServices();
      graceful = graceful && rslt;
    });
  };

  process.on('SIGINT', () => {
    shutdownServer(httpServer);
    shutdownServer(httpsServer);
  })

  const start = () => {
    Logger.info('SERVER STARTED');
    httpServer.listen(serverHttpPort, '0.0.0.0');
    httpsServer.listen(serverHttpsPort, '0.0.0.0');
    httpServer.isRunning = true;
    httpsServer.isRunning = true;
    running = true;
  }

  const shutdownServices = () => {
    if (!httpServer.isRunning && !httpsServer.isRunning) {
      Logger.info('SERVER SHUTDOWN');
      if (!shuttingDown) {
        shuttingDown = true;
        Logger.debug('SHUTDOWN CALLED: HTTP (' + httpServer.isRunning + '), HTTPS (' + httpsServer.isRunning + ')');
        Logger.info('CLOSING ResponseCache');
        ResponseCache.close();
        running = false;
      }
    }
  }

  const isGraceful = () => {
    return graceful;
  };

  const isRunning = () => {
    return running;
  };

  setUncaughtExceptionHandler();
  createServer();

  return {
    start: start,
    isGraceful: isGraceful,
    isRunning: isRunning,
    pid: process.pid,
  };
};


