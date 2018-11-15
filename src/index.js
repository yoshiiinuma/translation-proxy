
import http from 'http';
import httpProxy from 'http-proxy';

import Logger from './logger.js';

const opts = {
  target: {
    host: 'spo.hawaii.gov',
    port: 8080,
  }
};

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

const proxy = httpProxy.createProxyServer(opts);

proxy.on('error', (err, req, res) => {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });
  res.end('Sever Error: something went wrong.');
});

proxy.on('proxyReq', (proxyReq, req, res) => {
  console.log(proxyReq);
  
  //proxyRes.headers['X-Real-IP'] = req.headers.;
  proxyReq.headers['X-Real-IP'] = 'Real IP';
  proxyReq.pipe(req);
});

proxy.on('proxyRes', (proxyRes, req, res) => {
  console.log(proxyRes);

  proxyRes.headers['X-Proxied-By'] = 'Yoshi';
  proxyRes.pipe(res);
});

proxy.listen(80);

/*
httpProxy.createServer((req, res) => {
  console.log(req);
  proxy.web(req, res, { target: 'http://ets.hawaii.gov:80' });
}).listen(9000);

httpProxy.createServer((req, res) => {
  console.log(req);
  proxy.web(req, res, { target: 'http://ets.hawaii.gov:80' });
}).listen(9000);
*/
