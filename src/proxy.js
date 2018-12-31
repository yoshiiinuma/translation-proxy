
import fs from 'fs';
import util from 'util';
import http from 'http';
import https from 'https';
import url from 'url';
import requestIp from 'request-ip';
import cheerio from 'cheerio';
import crypto from 'crypto';

import Logger from './logger.js';
import { loadConfig } from './conf.js';
import createHtmlPageTranslator from './page-translator.js';
import createCache from './cache.js';
import { compress, uncompress } from './compress.js';

const conf = loadConfig('./config/config.json');

const cache = createCache(conf);

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

const getFullUrl = (opts, lang) => {
  let url = opts.protocol + '//' + opts.host;
  if (opts.port) url += ':' + opts.port;
  url += opts.path;
  if (lang) {
    if (url.includes('?')) {
      url += '&lang=' + lang;
    } else {
      url += '?lang=' + lang;
    }
  }
  return url;
};

const getKey = (prefix, opts, lang) => {
  const reqStr = opts.method + '+' + getFullUrl(opts, lang);
  let key = prefix + crypto.createHash('md5').update(reqStr).digest('hex');
  return key;
};

const getCache = async (opts, lang) => {
  return await cache.getAsync(getKey('PAGE-', opts, lang));
}

const setCache = async (opts, lang, val) => {
  return await cache.setAsync(getKey('PAGE-', opts, lang), val);
}

const getSavedResponse = async (opts, lang) => {
  const headKey = getKey('HEAD-', opts, lang)
  const pageKey = getKey('PAGE-', opts, lang)
  Logger.info(opts.id + ' CACHE GET: ' + headKey);
  Logger.info(opts.id + ' CACHE GET: ' + pageKey);
  const head = await cache.getAsync(getKey('HEAD-', opts, lang));
  const body = await cache.getAsync(getKey('PAGE-', opts, lang));
  if (!head || !body) return null;
  return {
    res: JSON.parse(head.toString()),
    buffer: body
  };
}

const saveResponse = async (opts, lang, header, body) => {
  const headKey = getKey('HEAD-', opts, lang)
  const pageKey = getKey('PAGE-', opts, lang)
  Logger.info(opts.id + ' CACHE SAVE: ' + headKey);
  Logger.info(opts.id + ' CACHE SAVE: ' + pageKey);
  await cache.setAsync(headKey, JSON.stringify(header));
  await cache.setAsync(pageKey, body);
  return true;
}

var cnt = 0;

const serve = async (req, res) => {
  const reqUrl = url.parse(req.url, true);
  const proxy = (req.connection.encrypted) ? https : http;
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

  let done = false;
  let proxyReq = null;

  if (lang) {
    const translated = await getSavedResponse(opts, lang);
    if (translated) {
      done = true;
      const savedRes = translated.res
      console.log(logPreSer + 'END: RETURNING CACHED TRANSLATED: ' + translated.buffer.length + ' == ' + savedRes.headers['content-length']);
      Logger.info(logPreSer + 'END: RETURNING CACHED TRANSLATED: ' + translated.buffer.length + ' == ' + savedRes.headers['content-length']);
      res.writeHead(savedRes.statusCode, savedRes.statusMessage, savedRes.headers)
      res.end(translated.buffer);
      return;
    }
  }

  const original = await getSavedResponse(opts);
  if (original) {
    done = true;
    const savedRes = original.res
    if (!lang) {
      console.log(logPreSer + 'END: RETURNING CACHED ORIGINAL: ' + original.buffer.length + ' == ' + savedRes.headers['content-length']);
      Logger.info(logPreSer + 'END: RETURNING CACHED ORIGINAL: ' + original.buffer.length + ' == ' + savedRes.headers['content-length']);
      res.writeHead(savedRes.statusCode, savedRes.statusMessage, savedRes.headers)
      res.end(original.buffer);
      return;
    }
    savedRes.lang = lang;
    sendTranslation(res, original.buffer, savedRes, logPreSer);
  }

  if (!done) {
    Logger.info(logPreSer + '!!! Start Proxy Request !!!');
    proxyReq = startProxyRequest(res, proxy, opts, lang);
  }

  req.on('data', (chunk) => {
    Logger.info(logPreCli + 'DATA');
    if (proxyReq) proxyReq.write(chunk);
  });

  req.on('end', () => {
    Logger.info(logPreCli + 'END');
    Logger.debug('#####################################################################');
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

const startProxyRequest = (res, proxy, opts, lang) => {
  logProxyRequest(opts);

  const proxyReq = proxy.request(opts, (proxyRes) => {
    const encoding = proxyRes.headers['content-encoding'];
    const isHtml = /text\/html/.test(proxyRes.headers['content-type']);
    const logPrefix = opts.id + ' ' + 'PROXY RESPONSE ';

    let body = [];

    logProxyResponse(proxyRes, opts);

    let headers = Object.assign({}, proxyRes.headers);
    if (isHtml || lang) {
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
    if (!(isHtml || lang)) {
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
      if (!(isHtml || lang)) res.write(chunk);
    });

    proxyRes.on('end', () => {
      if (!(isHtml || lang) || body.length === 0) {
        Logger.info(logPrefix + 'END WITHOUT PROCESSING');
        res.end();
        return;
      }
      const buffer = Buffer.concat(body);
      savedRes.headers['content-length'] = buffer.length;
      saveResponse(opts, null, savedRes, buffer, () => {});
      if (lang) {
        sendTranslation(res, buffer, savedRes, logPrefix);
      } else {
        console.log(logPrefix + 'BUFFERED PAGE: ' + buffer.length + ' == ' + savedRes.headers['content-length']);
        res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, savedRes.headers)
        res.end(buffer);
      }

      Logger.info(logPrefix + 'END WITH PROCESSING');
      Logger.debug('===========================================================================');
    });

  });

  proxyReq.on('error', (e) => {
    Logger.error(opts.id + ' PROXY REQUEST ERROR');
    Logger.debug('===========================================================================');
    serverError(e, res);
  });

  return proxyReq;
};

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
      saveResponse(meta.reqOpts, meta.lang, meta, gzipped, () => {});
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

