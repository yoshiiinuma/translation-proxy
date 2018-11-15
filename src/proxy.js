
import fs from 'fs';
import http from 'http';
import https from 'https';
import url from 'url';
import requestIp from 'request-ip';

import Logger from './logger.js';
import { loadConfig } from './conf.js';

const conf = loadConfig('./config/config.json');

const notFound = (res) => {
  Logger.info('404 Not Found');
  res.writeHead(404, 'text/plain');
  res.end('Error 404: File Not Found');
};

const serverError = (e, res) => {
  Logger.info('500 Server Error');
  Logger.info(e);
  res.writeHead(500, 'text/plain');
  res.end('Error 500: Internal Server Error');
};

const clientError = (e, socket) => {
  Logger.info('400 Bad Request');
  Logger.info(e);
  socket.end('Error 400: Bad Request');
};

const serve = (req, res) => {
  const reqUrl = url.parse(req.url, true);
  const proxy = (req.connection.encrypted) ? https : http;
  const scheme = (req.connection.encrypted) ? 'https' : 'http';
  const remoteIp = requestIp.getClientIp(req);
  const forwardedFor = req.headers['x-forwarded-for'] || req.headers['forwarded'] || remoteIp
  let host = req.headers.host;
  //let port = (req.connection.encrypted) ? 443 : 80;
  let port = (req.connection.encrypted) ? conf.httpsPort : conf.httpPort;

  const rgxHost = /^(.+):(\d+)$/;
  const matched = rgxHost.exec(host);
  if (matched) {
    host = matched[1];
    //port = parseInt(matched[2]);
  }

  let path = reqUrl.pathname;

  let params = [];
  for(let key in reqUrl.query) {
    params.push(key + '=' + reqUrl.query[key]);
  }
  if (params.length > 0) path += '?' + params.join('&');

  const headers = {
    'Host': req.headers.host,
    'X-Forwarded-For': forwardedFor,
    'X-Forwarded-Proto': scheme,
    'X-Real-IP': remoteIp
  };

  let opts = {
    protocol: scheme + ':',
    method: req.method,
    host: host,
    port: port,
    path,
    headers
  };
  if (scheme === 'https') {
    opts.rejectUnauthorized = false;
    opts.requestCert = true;
    opts.agent = false;
  }

  console.log('---------------------------------------------------------------------');
  console.log(req.rawHeaders);
  console.log(opts);

  let posted = '';

  req.on('data', (chunk) => {
    posted += chunk;
  });

  req.on('end', (chunk) => {
    if (chunk) posted += chunk;
    startProxy(res, proxy, opts, posted);
  });

  req.on('error', (chunk) => {
    Logger.error('PROXY REQUEST ERROR');
    serverError(e, res);
  });
};

const startProxy = (res, proxy, opts, data) => {
  const proxyReq = proxy.request(opts, (proxyRes) => {
    Logger.debug(opts);
    Logger.debug('PROXY GOT RESPONSE');

    res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, proxyRes.headers)
    proxyRes.setEncoding('utf8');
    proxyRes.on('error', (e) => {
      Logger.error('PROXY RESPONSE ERROR');
      serverError(e, res);
    });
    proxyRes.on('data', (chunk) => {
      Logger.debug('PROXY RESPONSE DATA');
      res.write(chunk);
    });
    proxyRes.on('end', (chunk) => {
      Logger.debug('PROXY RESPONSE END');
      if (chunk) res.write(chunk);
      res.end(); 
    });
  });

  proxyReq.on('error', (e) => {
    Logger.error('PROXY REQUEST ERROR');
    serverError(e, res);
  });

  //if (opts.method === 'POST' || opts.method === 'PUT') {
    if (data) {
      console.log('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
      console.log(data);
      console.log('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
      proxyReq.write(data); 
    }
  //}
  proxyReq.end();
};

const certs = {
  key: fs.readFileSync(conf.sslKey),
  cert: fs.readFileSync(conf.sslCert),
};

const httpServer = http.createServer(serve);
const httpsServer = https.createServer(certs, serve);

httpServer.on('clientError', clientError);
httpsServer.on('clientError', clientError);

//httpServer.listen(80, '127.0.0.1');
//httpsServer.listen(443, '127.0.0.1');
httpServer.listen(80, '0.0.0.0');
httpsServer.listen(443, '0.0.0.0');

