
import fs from 'fs';
import util from 'util';
import http from 'http';
import https from 'https';
import url from 'url';
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

var cnt = 0;

const serve = async (req, res) => {
  const reqUrl = url.parse(req.url, true);
  const agent = (req.connection.encrypted) ? https : http;
  const scheme = (req.connection.encrypted) ? 'https' : 'http';
  const remoteIp = requestIp.getClientIp(req);
  const forwardedFor = req.headers['x-forwarded-for'] || req.headers['forwarded'] || remoteIp;
  let lang = null;
  let host = req.headers.host;
  let port = (req.connection.encrypted) ? conf.httpsPort : conf.httpPort;

  const idOrig = cnt++;
  const id = idOrig.toString().padStart(12, ' ');
  const logPreCli = id + ' CLIENT REQUEST ';
  const logPreSer = id + ' SERVER RESPONSE ';

  const rgxHost = /^(.+):(\d+)$/;
  const matched = rgxHost.exec(host);
  if (matched) {
    host = matched[1];
    //port = parseInt(matched[2]);
  }

  Logger.debug('#####################################################################');
  console.log(logPreCli + 'START: ' + scheme + '://' + host + reqUrl.path);
  Logger.info(logPreCli + 'START: ' + scheme + '://' + host + reqUrl.path);
  Logger.debug(req.rawHeaders);

  if (!conf.proxiedHosts[host]) {
    Logger.debug(logPreCli + 'NOT PROXIED: ' + scheme + '://' + host + reqUrl.path);
    clientError(null, res);
    return;
  }
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
    headers,
    id
  };
  if (scheme === 'https') {
    opts.rejectUnauthorized = false;
    opts.requestCert = true;
    opts.agent = false;
  }

  let proxyReq = null;

  if (lang) {
    const translated = await ResponseCache.get(opts, lang);
    if (translated) {
      const savedRes = translated.res
      sendBuffer(res, translated.buffer, savedRes, logPreSer + 'END: RETURNING CACHED TRANSLATED');
      return;
    }
  }

  const original = await ResponseCache.get(opts);
  if (original) {
    const savedRes = original.res
    if (!lang) {
      sendBuffer(res, original.buffer, savedRes, logPreSer + 'END: RETURNING CACHED ORIGIANL');
      return;
    }
    savedRes.lang = lang;
    sendTranslation(res, original.buffer, savedRes, logPreSer);
  } else {
    Logger.info(logPreSer + '!!! Start Proxy Request !!!');
    proxyReq = startProxyRequest(res, agent, opts, lang);
  }

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
  const url = opts.protocol + '//' + opts.host + opts.path;
  const msg = url + ' ' + res.statusCode + ' ' + res.statusMessage + ' LEN: ' + len + ' CONTENT-TYPE: ' +
    type + ' CONTENT-ENCODING: ' + encoding + ' TRANSFER-ENCODING: ' + transfer;
  console.log(opts.id.toString().padStart(12, ' ') + ' PROXY RESPONSE RCEIV: ' + msg);

  Logger.debug(opts.id.toString().padStart(12, ' ') + ' PROXY RESPONSE RCEIV: ' + msg);
  Logger.debug('---------------------------------------------------------------------------');
  Logger.debug(res.headers);
};

const startProxyRequest = (res, agent, opts, lang) => {
  logProxyRequest(opts);

  const proxyReq = agent.request(opts, (proxyRes) => {
    const encoding = proxyRes.headers['content-encoding'];
    const isHtml = /text\/html/.test(proxyRes.headers['content-type']);
    const logPrefix = opts.id + ' ' + 'PROXY RESPONSE ';
    const needTranslation = isHtml && lang;

    let body = [];

    logProxyResponse(proxyRes, opts);

    let headers = Object.assign({}, proxyRes.headers);
    if (needTranslation) {
      headers['access-control-allow-origin'] = opts.host;
      //headers['transfer-encoding'] = 'identity';
      delete headers['transfer-encoding'];
      //headers['content-encoding'] = 'gzip';
    }
    const savedRes = {
      statusCode: proxyRes.statusCode,
      statusMessage: proxyRes.statusMessage,
      reqOpts: opts,
      lang,
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
      ResponseCache.save(opts, null, savedRes, buffer, () => {});
      if (needTranslation) {
        sendTranslation(res, buffer, savedRes, logPrefix);
        Logger.debug('===========================================================================');
      }
    });

  });

  proxyReq.on('error', (e) => {
    Logger.error(opts.id + ' PROXY REQUEST ERROR');
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

