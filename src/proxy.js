
import fs from 'fs';
import util from 'util';
import http from 'http';
import https from 'https';
import URL from 'url';
import requestIp from 'request-ip';
import cheerio from 'cheerio';

import Logger from './logger.js';
import { loadConfig } from './conf.js';
import createHtmlPageTranslator from './page-translator.js';
import createCache from './cache.js';
import { compress, uncompress } from './compress.js';
import createResponseCache from './response-cache.js';

const conf = loadConfig('./config/config.json');

const ResponseCache = createResponseCache(conf);

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
  if (e) {
    Logger.info(e);
    Logger.info(util.inspect(socket));
  }
  socket.end('Error 400: Bad Request');
};

const alertJs =
`<script>
  function displayAlert() { alert('Translation service is currently not available. Please try again later.') };
  setTimeout(displayAlert, 1000);
</script>`;

const injectAlert = (html) => {
  try {
    const $ = cheerio.load(html);
    $(alertJs).appendTo('body');
    return $.html();
  }
  catch (err) {
    Logger.error('INJECTALERT ERROR');
    Logger.error(err);
    return html;
  }
}

const rgxHost = /^(.+):(\d+)$/;

const reqToReqObj = (req, id) => {
  const reqUrl = URL.parse(req.url, true);
  const scheme = (req.connection.encrypted) ? 'https' : 'http';
  const method = req.method;

  let host = req.headers.host;
  let port = (req.connection.encrypted) ? conf.httpsPort : conf.httpPort;
  let lang = null;
  const matched = rgxHost.exec(host);
  if (matched) {
    host = matched[1];
    //port = parseInt(matched[2]);
  }

  const params = [];
  for(let key in reqUrl.query) {
    if (key === 'lang') {
      lang = reqUrl.query[key];
    } else {
      params.push(key + '=' + reqUrl.query[key]);
    }
  }

  let path = reqUrl.pathname;
  if (params.length > 0) path += '?' + params.join('&');

  const headers = Object.assign({}, req.headers);
  const remoteIp = requestIp.getClientIp(req);
  const forwardedFor = req.headers['x-forwarded-for'] || req.headers['forwarded'] || remoteIp;
  headers['X-Forwarded-For'] = forwardedFor;
  headers['X-Forwarded-Proto'] = scheme;
  headers['X-Real-IP'] = remoteIp;

  return {
    id,
    href: scheme + '://' + host + reqUrl.path,
    lang,
    scheme,
    protocal: scheme + ':',
    method,
    host,
    port,
    path,
    headers,
    rawHeaders: req.rawHeaders
  }
}

const genReqOpts = (reqObj) => {
  const {id,  href, lang, scheme, rawHeaders, ...opts } = reqObj;

  if (reqObj.scheme === 'https') {
    opts.rejectUnauthorized = false;
    opts.requestCert = true;
    opts.agent = false;
  }

  return opts;
};

var cnt = 0;

const serve = async (req, res) => {
  const idOrig = cnt++;
  const id = idOrig.toString().padStart(12, ' ');
  const logPreCli = id + ' CLIENT REQUEST ';
  const logPreSer = id + ' SERVER RESPONSE ';
  const agent = (req.connection.encrypted) ? https : http;

  const obj = reqToReqObj(req, id);

  Logger.debug('#####################################################################');
  console.log(logPreCli + 'START: ' + obj.href);
  Logger.info(logPreCli + 'START: ' + obj.href);
  Logger.debug(obj.rawHeaders);

  if (!conf.proxiedHosts[obj.host]) {
    Logger.debug(logPreCli + 'NOT PROXIED: ' + obj.href);
    clientError(null, res);
    return;
  }

  let proxyReq = null;

  req.on('data', (chunk) => {
    Logger.info(logPreCli + 'DATA');
    if (proxyReq) proxyReq.write(chunk);
  });

  req.on('end', () => {
    Logger.info(logPreCli + 'END');
    Logger.debug('####################################################################');
    if (proxyReq) proxyReq.end();
  });

  req.on('error', (e) => {
    Logger.error(logPreCli + 'ERROR');
    Logger.debug('####################################################################');
    serverError(e, res);
  });

  res.on('error', (e) => {
    Logger.error(logPreSer + 'ERROR');
    serverError(e, res);
  });

  if (obj.lang) {
    const translated = await ResponseCache.get(obj, obj.lang);
    if (translated) {
      const savedRes = translated.res
      sendBuffer(res, translated.buffer, savedRes, logPreSer + 'END: RETURNING CACHED TRANSLATED');
      return;
    }
  }

  const original = await ResponseCache.get(obj);
  if (original) {
    const savedRes = original.res
    if (obj.lang) {
      savedRes.lang = obj.lang;
      sendTranslation(res, original.buffer, savedRes, logPreSer);
    } else {
      sendBuffer(res, original.buffer, savedRes, logPreSer + 'END: RETURNING CACHED ORIGIANL');
    }
  } else {
    Logger.info(logPreSer + '!!! Start Proxy Request !!!');
    proxyReq = startProxyRequest(res, agent, obj);
  }
};

const logProxyRequest = (opts) => {
  let uri = opts.method + ' ' + opts.protocol + '://' + opts.host;
  if (opts.port) uri += ':' + opts.port;
  uri += opts.path;
  Logger.debug('===========================================================================');
  Logger.info(opts.id + ' PROXY REQUEST SEND: ' + uri);
  Logger.debug(opts);
};

const logProxyResponse = (res, opts) => {
  const encoding = res.headers['content-encoding'] || '';
  const type = res.headers['content-type'] || '';
  const transfer = res.headers['transfer-encoding'] || '';
  const len = res.headers['content-length'] || '';
  const msg = opts.href + ' ' + res.statusCode + ' ' + res.statusMessage + ' LEN: ' + len + ' CONTENT-TYPE: ' +
    type + ' CONTENT-ENCODING: ' + encoding + ' TRANSFER-ENCODING: ' + transfer;
  console.log(opts.id + ' PROXY RESPONSE RCEIV: ' + msg);

  Logger.debug(opts.id + ' PROXY RESPONSE RCEIV: ' + msg);
  Logger.debug('---------------------------------------------------------------------------');
  Logger.debug(res.headers);
};

const startProxyRequest = (res, agent, reqObj) => {
  const reqOpts = genReqOpts(reqObj);
  logProxyRequest(reqObj);

  const proxyReq = agent.request(reqOpts, (proxyRes) => {
    const encoding = proxyRes.headers['content-encoding'];
    const isHtml = /text\/html/.test(proxyRes.headers['content-type']);
    const logPrefix = reqObj.id + ' ' + 'PROXY RESPONSE ';
    const needTranslation = isHtml && reqObj.lang;

    let body = [];

    logProxyResponse(proxyRes, reqObj);

    let headers = Object.assign({}, proxyRes.headers);
    if (needTranslation) {
      headers['access-control-allow-origin'] = reqOpts.host;
      //headers['transfer-encoding'] = 'identity';
      delete headers['transfer-encoding'];
      //headers['content-encoding'] = 'gzip';
    }
    const savedRes = {
      statusCode: proxyRes.statusCode,
      statusMessage: proxyRes.statusMessage,
      reqOpts,
      lang: reqObj.lang,
      encoding,
      headers
    };
    if (!(needTranslation)) {
      res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, headers)
    }
    //proxyRes.setEncoding('utf8');

    proxyRes.on('error', (e) => {
      Logger.error(logPrefix + 'ERROR');
      serverError(e, res);
    });

    proxyRes.on('data', (chunk) => {
      Logger.info(logPrefix + 'DATA');
      body.push(chunk);
      if (!needTranslation) res.write(chunk);
    });

    proxyRes.on('end', () => {
      if (!needTranslation) {
        Logger.info(logPrefix + 'END WITHOUT PROCESSING');
        res.end();
        Logger.debug('===========================================================================');
      }
      const buffer = Buffer.concat(body);
      savedRes.headers['content-length'] = buffer.length;
      ResponseCache.save(reqObj, null, savedRes, buffer, () => {});
      if (needTranslation) {
        sendTranslation(res, buffer, savedRes, logPrefix);
        Logger.debug('===========================================================================');
      }
    });

  });

  proxyReq.on('error', (e) => {
    Logger.error(reqObj.id + ' PROXY REQUEST ERROR');
    Logger.debug('===========================================================================');
    serverError(e, res);
  });

  return proxyReq;
};

const sendBuffer = (res, buffer, meta, logMsg) => {
  console.log(logMsg + ': ' + buffer.length + ' == ' + meta.headers['content-length']);
  Logger.debug(logMsg + ': ' + buffer.length + ' == ' + meta.headers['content-length']);
  res.writeHead(meta.statusCode, meta.statusMessage, meta.headers)
  res.end(buffer);
}

const sendTranslation = (res, buffer, meta, logPrefix) => {
  const doc = uncompress(buffer, meta.encoding);
  let gzipped;
  let pageType = 'TRANSLATED PAGE';

  translatePage(doc, meta.lang, (err, translatedHtml) => {
    if (err) {
      Logger.error(logPrefix + 'TRANSLATION FAILED');
      Logger.error(err);
      pageType = 'ERROR INJECTED PAGE';
      gzipped = compress(injectAlert(doc), meta.encoding);
      meta.headers['content-length'] = gzipped.length;
    } else {
      gzipped = compress(translatedHtml, meta.encoding);
      meta.headers['content-length'] = gzipped.length;
      ResponseCache.save(meta.reqOpts, meta.lang, meta, gzipped, () => {});
    }
    console.log(logPrefix + 'END: RETURNING ' + pageType + ': ' + meta.headers['content-length']);
    Logger.info(logPrefix + 'END: RETURNING ' + pageType + ': ' + meta.headers['content-length']);
    res.writeHead(meta.statusCode, meta.statusMessage, meta.headers);
    res.end(gzipped);
  });
};

const translatePage = (doc, lang, callback) => {
  const page = createHtmlPageTranslator(doc, conf);
  page.translateAll(conf.translationSelectors, lang, conf.maxTextPerRequest, conf.domBreakdownThreshold, (err, translatedHtml) => {
    if (err) {
      callback(err);
    } else {
      callback(null, translatedHtml);
    }
  });
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

