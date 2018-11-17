
import fs from 'fs';
import http from 'http';
import https from 'https';
import url from 'url';
import zlib from 'zlib';
import requestIp from 'request-ip';

import Logger from './logger.js';
import { loadConfig } from './conf.js';
import getTranslator from './translate.js';

const conf = loadConfig('./config/config.json');

const translate = getTranslator(conf);

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
  const forwardedFor = req.headers['x-forwarded-for'] || req.headers['forwarded'] || remoteIp;
  let lang = null;
  let host = req.headers.host;
  //let port = (req.connection.encrypted) ? 443 : 80;
  let port = (req.connection.encrypted) ? conf.httpsPort : conf.httpPort;

  const rgxHost = /^(.+):(\d+)$/;
  const matched = rgxHost.exec(host);
  if (matched) {
    host = matched[1];
    //port = parseInt(matched[2]);
  }

  //console.log('#####################################################################');
  //console.log(req.rawHeaders);

  let path = reqUrl.pathname;

  let params = [];
  for(let key in reqUrl.query) {
    if (key === 'lang') {
      lang = reqUrl.query[key];
    } else {
      params.push(key + '=' + reqUrl.query[key]);
    }
  }
  if (params.length > 0) path += '?' + params.join('&');

  let headers = Object.assign({}, req.headers);
  headers['X-Forwarded-For'] = forwardedFor;
  headers['X-Forwarded-Proto'] = scheme;
  headers['X-Real-IP'] = remoteIp;

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

  const proxyReq = startProxy(res, proxy, opts, lang);

  req.on('data', (chunk) => {
    proxyReq.write(chunk);
  });

  req.on('end', () => {
    proxyReq.end();
  });

  req.on('error', (e) => {
    Logger.error('CLIENT REQUEST ERROR');
    serverError(e, res);
  });

  res.on('error', (e) => {
    Logger.error('SERVER RESPONSE ERROR');
    serverError(e, res);
  });
};

const startProxy = (res, proxy, opts, lang) => {
  const proxyReq = proxy.request(opts, (proxyRes) => {
    const encoding = proxyRes.headers['content-encoding'];
    const type = proxyRes.headers['content-type'];
    const transfer = proxyRes.headers['transfer-encoding'];
    const gzipped = /gzip/.test(encoding);
    const html = /text\/html/.test(type);
    const translation = !!lang;

    let body = [];

    Logger.debug('PROXY GOT RESPONSE');
    console.log('===========================================================================');
    console.log(opts);
    console.log('---------------------------------------------------------------------------');
    console.log(proxyRes.statusCode + ' ' + proxyRes.statusMessage + ' gzipped: ' + gzipped + '; html: ' + html + ', translation: ' + translation);
    console.log('CONTENT-TYPE: ' + type);
    console.log('CONTENT-ENCODING: ' + encoding);
    console.log('TRANSFER-ENCODING: ' + transfer);
    console.log(proxyRes.headers);

    let headers = Object.assign({}, proxyRes.headers);
    if (translation) {
      //headers['transfer-encoding'] = 'identity';
      delete headers['transfer-encoding'];
      headers['content-encoding'] = 'gzip';
    }

    proxyRes.on('error', (e) => {
      Logger.error('PROXY RESPONSE ERROR');
      serverError(e, res);
    });

    proxyRes.on('data', (chunk) => {
      Logger.debug('PROXY RESPONSE DATA');
      body.push(chunk);
      if (!translation) res.write(chunk);
    });

    proxyRes.on('end', () => {
      Logger.debug('PROXY RESPONSE END');
      if (body.length > 0) {
        const buffer = Buffer.concat(body);
        if (html) {
          console.log('---------------------------------------------------------------------------');
          if (gzipped) {
            //console.log(zlib.gunzipSync(buffer).toString());
          } else {
            //console.log(buffer.toString());
          }
          if (translation) {
            let doc;
            if (gzipped) {
              doc = zlib.gunzipSync(buffer).toString();
            } else {
              doc = buffer.toString();
            }

            translate(doc, lang, (err, translatedHtml) => {
              if (err) {
                Logger.error('Proxy#startProxy Translation Failed');
                Logger.error(err);
                res.end(buffer);
              } else {
                console.log(translatedHtml);
                console.log(typeof translatedHtml);
                res.end(zlib.gzipSync(translatedHtml));
              }
            });
          } else {
            res.end(buffer);
          }
        } else {
          res.end(buffer);
        }
      } else {
        res.end();
      }
      console.log('===========================================================================');
    });

    res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, headers)
    //proxyRes.setEncoding('utf8');

  });

  proxyReq.on('error', (e) => {
    Logger.error('PROXY REQUEST ERROR');
    serverError(e, res);
  });

  return proxyReq;
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

