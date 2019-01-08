
import util from 'util';
import http from 'http';
import https from 'https';
import URL from 'url';
import requestIp from 'request-ip';
import cheerio from 'cheerio';

import Logger from './logger.js';
import createHtmlPageTranslator from './page-translator.js';
import { compress, uncompress, compressAsync, uncompressAsync } from './compress.js';
import createResponseCache from './response-cache.js';

export const notFound = (res) => {
  Logger.info('404 Not Found');
  res.writeHead(404, 'text/plain');
  res.end('Error 404: File Not Found');
};

export const serverError = (e, res) => {
  Logger.info('500 Server Error');
  Logger.info(e);
  res.writeHead(500, 'text/plain');
  res.end('Error 500: Internal Server Error');
};

export const clientError = (e, socket) => {
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

export const setUpProxy = (config) => {
  let cnt = 0;
  const conf = config;
  const ResponseCache = createResponseCache(conf);
  const targetHttpPort = conf.targetHttpPort || 80;
  const targetHttpsPort = conf.targetHttpsPort || 443;
  const rgxHost = /^(.+):(\d+)$/;

  const reqToReqObj = (req, id) => {
    const reqUrl = URL.parse(req.url, true);
    const scheme = (req.connection.encrypted) ? 'https' : 'http';
    const method = req.method;

    let host = req.headers.host;
    let port = (req.connection.encrypted) ? targetHttpsPort : targetHttpPort;
    let requestedHost = host;
    let requestedPort = port;
    let lang = null;
    const matched = rgxHost.exec(host);
    if (matched) {
      host = matched[1];
      requestedPort = parseInt(matched[2]);
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
      remoteIp,
      lang,
      scheme,
      protocol: scheme + ':',
      method,
      host,
      port,
      requestedHost,
      requestedPort,
      path,
      headers,
      rawHeaders: req.rawHeaders
    }
  }

  const genReqOpts = (reqObj) => {
    const {id,  href, requestedHost, requestedPort, remoteIp, lang, scheme, rawHeaders, ...opts } = reqObj;

    if (reqObj.scheme === 'https') {
      opts.rejectUnauthorized = false;
      opts.requestCert = true;
      opts.agent = false;
    }

    return opts;
  };

  const logProxyRequest = (opts) => {
    let uri = opts.method + ' ' + opts.protocol + '://' + opts.host;
    if (opts.port) uri += ':' + opts.port;
    uri += opts.path;
    Logger.info(opts.id + ' PROXY REQUEST SEND: ' + uri);
    Logger.debug(opts);
  };

  const logProxyResponse = (res, opts) => {
    const encoding = res.headers['content-encoding'];
    const type = res.headers['content-type'];
    const transfer = res.headers['transfer-encoding'];
    const len = res.headers['content-length'] || '';

    let msg = opts.href + ' ' + res.statusCode + ' ' + res.statusMessage + ' LEN: ' + len;
    if (type) msg += ' CONTENT TYPE: "' + type + '"';
    if (encoding) msg += ' ENCODING: "' + encoding + '"';
    if (transfer) msg += ' TRANSFER: "' + transfer + '"';

    //console.log(opts.id + ' PROXY RESPONSE RCEIV: ' + msg);
    Logger.info(opts.id + ' PROXY RESPONSE RCEIV: ' + msg);
    Logger.debug(res.headers);
  };

  const serve = async (req, res) => {
    const idOrig = cnt++;
    const id = idOrig.toString().padStart(12, ' ');
    const logPreCli = id + ' CLIENT REQUEST ';
    const logPreSer = id + ' SERVER RESPONSE ';
    const agent = (req.connection.encrypted) ? https : http;

    const obj = reqToReqObj(req, id);
    Logger.access(obj);

    //console.log(logPreCli + 'START: ' + obj.href);
    Logger.info(logPreCli + 'START: ' + obj.href);
    Logger.debug(obj.rawHeaders);

    if (!conf.proxiedHosts[obj.host]) {
      Logger.debug(logPreCli + 'NOT PROXIED: ' + obj.href);
      clientError(null, res);
      return;
    }

    let proxyReq = null;

    if (obj.lang) {
      const translated = await ResponseCache.get(obj, obj.lang);
      if (translated) {
        const savedRes = translated.res
        sendBuffer(res, translated.buffer, savedRes, logPreSer + 'END: RETURNING CACHED TRANSLATED');
        return;
      }
    }

    const original = await ResponseCache.get(obj, null);
    if (original) {
      const savedRes = original.res
      if (obj.lang) {
        savedRes.lang = obj.lang;
        savedRes.href = obj.href;
        sendTranslation(res, original.buffer, obj, savedRes, logPreSer);
      } else {
        sendBuffer(res, original.buffer, savedRes, logPreSer + 'END: RETURNING CACHED ORIGIANL');
      }
    } else {
      proxyReq = startProxyRequest(res, agent, obj);
    }

    req.on('data', (chunk) => {
      Logger.debug(logPreCli + 'DATA');
      if (proxyReq) proxyReq.write(chunk);
    });

    req.on('end', () => {
      Logger.info(logPreCli + 'END');
      if (proxyReq) proxyReq.end();
    });

    req.on('error', (e) => {
      Logger.error(logPreCli + 'ERROR');
      serverError(e, res);
    });

    res.on('error', (e) => {
      Logger.error(logPreSer + 'ERROR');
      serverError(e, res);
    });
  };

  const startProxyRequest = (res, agent, reqObj) => {
    const reqOpts = genReqOpts(reqObj);
    logProxyRequest(reqObj);

    const proxyReq = agent.request(reqOpts, (proxyRes) => {
      const encoding = proxyRes.headers['content-encoding'];
      const isHtml = /text\/html/.test(proxyRes.headers['content-type']);
      const needTranslation = isHtml && reqObj.lang;
      const logPrefix = reqObj.id + ' ' + 'PROXY RESPONSE ';

      let body = [];

      logProxyResponse(proxyRes, reqObj);

      let headers = Object.assign({}, proxyRes.headers);
      if (needTranslation) {
        headers['access-control-allow-origin'] = reqObj.host;
        delete headers['transfer-encoding'];
      }
      const savedRes = {
        statusCode: proxyRes.statusCode,
        statusMessage: proxyRes.statusMessage,
        lang: reqObj.lang,
        href: reqObj.href,
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
        Logger.debug(logPrefix + 'DATA');
        body.push(chunk);
        if (!needTranslation) res.write(chunk);
      });

      proxyRes.on('end', () => {
        if (!needTranslation) {
          Logger.info(logPrefix + 'END WITHOUT PROCESSING');
          res.end();
        }
        const buffer = Buffer.concat(body);
        savedRes.headers['content-length'] = buffer.length;
        ResponseCache.save(reqObj, null, savedRes, buffer);
        if (needTranslation) {
          sendTranslation(res, buffer, reqObj, savedRes, logPrefix);
        }
      });

    });

    proxyReq.on('error', (e) => {
      Logger.error(reqObj.id + ' PROXY REQUEST ERROR');
      serverError(e, res);
    });

    return proxyReq;
  };

  const sendBuffer = (res, buffer, proxyResObj, logMsg) => {
    //console.log(logMsg + ': ' + buffer.length + ' == ' + proxyResObj.headers['content-length']);
    Logger.info(logMsg + ': ' + buffer.length + ' == ' + proxyResObj.headers['content-length']);
    res.writeHead(proxyResObj.statusCode, proxyResObj.statusMessage, proxyResObj.headers)
    res.end(buffer);
  }

  const sendTranslation = async (res, buffer, reqObj, proxyResObj, logPrefix) => {
    const doc = await uncompressAsync(buffer, proxyResObj.encoding);
    let gzipped;
    let pageType = 'TRANSLATED PAGE';

    translatePage(doc, proxyResObj.lang, async (err, translatedHtml) => {
      if (err) {
        Logger.error(logPrefix + 'TRANSLATION FAILED');
        Logger.error(err);
        pageType = 'ERROR INJECTED PAGE';
        gzipped = await compressAsync(injectAlert(doc), proxyResObj.encoding);
        proxyResObj.headers['content-length'] = gzipped.length;
      } else {
        gzipped = await compressAsync(translatedHtml, proxyResObj.encoding);
        proxyResObj.headers['content-length'] = gzipped.length;
        const cookies = proxyResObj.headers['set-cookie'] || [];
        cookies.push('SELECTEDLANG=' + proxyResObj.lang);
        proxyResObj.headers['set-cookie'] = cookies;
        ResponseCache.save(reqObj, proxyResObj.lang, proxyResObj, gzipped);
      }
      //console.log(logPrefix + 'END: RETURNING ' + pageType + ': ' + proxyResObj.headers['content-length']);
      Logger.info(logPrefix + 'END: RETURNING ' + pageType + ': ' + proxyResObj.headers['content-length']);
      res.writeHead(proxyResObj.statusCode, proxyResObj.statusMessage, proxyResObj.headers);
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

  return serve;
}

