
import util from 'util';
import http from 'http';
import https from 'https';
import URL from 'url';
import requestIp from 'request-ip';
import cheerio from 'cheerio';

import Logger from './logger.js';
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
  res.writeHead(500, 'Internal Server Error', { 'content-type': 'text/plain' });
  res.end('Error 500: Internal Server Error');
};

export const serviceUnavailable = (e, res) => {
  Logger.info('503 Service Unavailable');
  Logger.info(e);
  res.writeHead(503, 'Service Unavailable', { 'content-type': 'text/plain' });
  res.end('Error 503: Service Unavailable Error');
};

export const badRequest = (e, res) => {
  Logger.info('400 Bad Request');
  Logger.info(e);
  res.writeHead(400, 'Bad Request', { 'content-type': 'text/plain' });
  res.end('Error 400: Bad Request');
};

export const clientError = (e, socket) => {
  Logger.info('CLIENT ERROR');
  if (e) {
    Logger.info(e);
    Logger.info(util.inspect(socket));
  }
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
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

/**
 * NOTE: Initialize Logger before calling this function
 */
export const setUpProxy = (conf, translator, proxyFunc, callback) => {
  let cnt = 0;
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
    const remoteIp = requestIp.getClientIp(req) || '';
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
    const startProxy = proxyFunc || startProxyRequest;
    const idOrig = cnt++;
    const id = idOrig.toString().padStart(12, ' ');
    const logPreCli = id + ' CLIENT REQUEST ';
    const logPreSer = id + ' SERVER RESPONSE ';
    const agent = (req.connection.encrypted) ? https : http;
    let error = false;

    const obj = reqToReqObj(req, id);
    Logger.access(obj);

    //console.log(logPreCli + 'START: ' + obj.href);
    Logger.info(logPreCli + 'START: ' + obj.href);
    Logger.debug(obj.rawHeaders);

    res.on('error', (e) => {
      error = true;
      Logger.error(logPreSer + 'ERROR');
      serverError(e, res);
    });

    res.on('end', () => {
      Logger.info(logPreSer + 'END');
      if (callback) callback();
    })

    req.on('error', (e) => {
      error = true;
      Logger.error(logPreCli + 'ERROR');
      serverError(e, res);
    });

    if (!conf.proxiedHosts[obj.host]) {
      error = true;
      Logger.debug(logPreCli + 'NOT PROXIED: ' + obj.href);
      badRequest('Not Proxied: ' + obj.href, res);
      return;
    }

    let proxyReq = null;

    if (obj.lang) {
      const translated = await ResponseCache.get(obj, obj.lang);
      if (translated) {
        const savedRes = translated.res
        if (!error) sendBuffer(res, translated.buffer, savedRes, logPreSer + 'END: RETURNING CACHED TRANSLATED');
        return;
      }
    }

    const original = await ResponseCache.get(obj, null);
    if (original) {
      const savedRes = original.res
      if (obj.lang) {
        savedRes.lang = obj.lang;
        savedRes.href = obj.href;
        if (!error) sendTranslation(res, original.buffer, obj, savedRes, logPreSer);
      } else {
        if (!error) sendBuffer(res, original.buffer, savedRes, logPreSer + 'END: RETURNING CACHED ORIGIANL');
      }
    } else {
      if (!error) proxyReq = startProxy(res, agent, obj);
    }

    req.on('data', (chunk) => {
      Logger.debug(logPreCli + 'DATA');
      if (proxyReq) proxyReq.write(chunk);
    });

    req.on('end', () => {
      Logger.info(logPreCli + 'END');
      if (proxyReq) proxyReq.end();
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
        serviceUnavailable(e, res);
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

    translator.translatePage(doc, proxyResObj.lang, async (err, translatedHtml) => {
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

  return {
    serve,
    startProxyRequest
  };
}

