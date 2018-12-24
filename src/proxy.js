
import fs from 'fs';
import util from 'util';
import http from 'http';
import https from 'https';
import url from 'url';
import zlib from 'zlib';
import requestIp from 'request-ip';
import cheerio from 'cheerio';
import crypto from 'crypto';

import Logger from './logger.js';
import { loadConfig } from './conf.js';
//import getTranslator from './translate.js';
import createHtmlPageTranslator from './page-translator.js';
import createCache from './cache.js';

const conf = loadConfig('./config/config.json');

//const translate = getTranslator(conf);
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
  if (lang) url += '?lang=' + lang;
  return url;
};

const getKey = (prefix, opts, lang) => {
  const reqStr = opts.method + '+' + getFullUrl(opts, lang);
  let key = prefix + crypto.createHash('md5').update(reqStr).digest('hex');
  Logger.info('CACHE KEY: ' + key);
  return key;
};

const getCache = async (opts, lang) => {
  return await cache.getAsync(getKey('PAGE-', opts, lang));
}

const setCache = async (opts, lang, val) => {
  return await cache.setAsync(getKey('PAGE-', opts, lang), val);
}

const getSavedResponse = async (opts, lang) => {
  const head = await cache.getAsync(getKey('HEAD-', opts, lang));
  const body = await cache.getAsync(getKey('PAGE-', opts, lang));
  if (!head || !body) return null;
  return {
    res: JSON.parse(head.toString()),
    buffer: body
  };
}

const saveResponse = async (opts, lang, header, body) => {
  await cache.setAsync(getKey('HEAD-', opts, lang), JSON.stringify(header));
  await cache.setAsync(getKey('PAGE-', opts, lang), body);
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

  cnt++;
  let id = cnt.toString().padStart(12, ' ');
  console.log(id + ' CLIENT REQUEST START: ' + scheme + '://' + host + reqUrl.path);
  const rgxHost = /^(.+):(\d+)$/;
  const matched = rgxHost.exec(host);
  if (matched) {
    host = matched[1];
    port = parseInt(matched[2]);
  }

  Logger.debug('#####################################################################');
  Logger.info(id + ' CLIENT REQUEST START: ' + scheme + '://' + host + reqUrl.path);
  Logger.debug(req.rawHeaders);

  if (!conf.proxiedHosts[host]) {
    Logger.debug(id + ' NOT PROXIED: ' + scheme + '://' + host + reqUrl.path);
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
      console.log(id + ' SERVER RESPONSE END: RETURNING CACHED TRANSLATED: ' + translated.buffer.length + ' == ' + savedRes.headers['content-length']);
      Logger.info(id + ' SERVER RESPONSE END: RETURNING CACHED TRANSLATED: ' + translated.buffer.length + ' == ' + savedRes.headers['content-length']);
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
      console.log(id + ' SERVER RESPONSE END: RETURNING CACHED ORIGINAL: ' + original.buffer.length + ' == ' + savedRes.headers['content-length']);
      Logger.info(id + ' SERVER RESPONSE END: RETURNING CACHED ORIGINAL: ' + original.buffer.length + ' == ' + savedRes.headers['content-length']);
      res.writeHead(savedRes.statusCode, savedRes.statusMessage, savedRes.headers)
      res.end(original.buffer);
      return;
    }
    const doc = uncompress(original.buffer, savedRes.encoding);
    translatePage(doc, lang, (err, translatedHtml) => {
      if (err) {
        consoleo.log(id + ' SERVER RESPONSE END: RETURNING CACHED ORIGINAL < TRASLATION ERROR: ' + original.buffer.length + ' == ' + savedRes.headers['content-length']);
        Logger.info(id + ' SERVER RESPONSE END: RETURNING CACHED ORIGINAL < TRASLATION ERROR: ' + original.buffer.length + ' == ' + savedRes.headers['content-length']);
        Logger.error(id + ' Proxy#serve Translation Failed');
        Logger.error(err);
        res.writeHead(savedRes.statusCode, savedRes.statusMessage, savedRes.headers)
        //res.end(zlib.gzipSync(injectAlert(doc)));
        res.end(compress(injectAlert(doc), savedRes.encoding));
        return;
      }
      //const gzipped = zlib.gzipSync(translatedHtml);
      const gzipped = compress(translatedHtml, savedRes.encoding);
      savedRes.headers['content-length'] = gzipped.length;
      console.log(id + ' SERVER RESPONSE END: RETURNING TRASLATED PAGE FROM CACHED: ' + original.buffer.length + ' => ' + gzipped.length + ' == ' + savedRes.headers['content-length']);
      Logger.info(id + ' SERVER RESPONSE END: RETURNING TRASLATED PAGE FROM CACHED: ' + original.buffer.length + ' => ' + gzipped.length + ' == ' + savedRes.headers['content-length']);
      Logger.debug(savedRes.headers);
      res.writeHead(savedRes.statusCode, savedRes.statusMessage, savedRes.headers)
      res.end(gzipped);
      saveResponse(opts, lang, savedRes, gzipped, () => {});
      return;
    });
  }

  if (!done) {
    Logger.info(id + ' SERVER !!! Start Proxy Request !!!');
    proxyReq = startProxyRequest(res, proxy, opts, lang);
  }

  req.on('data', (chunk) => {
    Logger.info(id + ' CLIENT REQUEST DATA');
    if (proxyReq) proxyReq.write(chunk);
  });

  req.on('end', () => {
    Logger.info(id + ' CLIENT REQUEST END');
    Logger.debug('#####################################################################');
    if (proxyReq) proxyReq.end();
  });

  req.on('error', (e) => {
    Logger.error(id + ' CLIENT REQUEST ERROR');
    Logger.debug('####################################################################');
    serverError(e, res);
  });

  res.on('error', (e) => {
    Logger.error(id + ' SERVER RESPONSE ERROR');
    serverError(e, res);
  });
};

const uncompress = (text, encoding) => {
  if (encoding === 'gzip') {
    return zlib.gunzipSync(text).toString();
  } else if (encoding === 'deflate') {
    return zlib.inflateRawSync(text).toString();
  }
  return text;
}

const compress = (text, encoding) => {
  Logger.debug('COMPRESS with: ' + encoding);
  if (encoding === 'gzip') {
    return zlib.gzipSync(text);
  } else if (encoding === 'deflate') {
    //return zlib.deflateRawSync(text).toString();
    return zlib.deflateSync(text);
  }
  return text;
}

const logProxyRequest = (opts) => {
  let uri = opts.method + ' ' + opts.protocol + '://' + opts.host;
  if (opts.port) uri += ':' + opts.port;
  uri += opts.path;
  Logger.debug('===========================================================================');
  Logger.info(opts.id + ' PROXY REQUEST SENT: ' + uri);
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
  console.log(cnt.toString().padStart(12, ' ') + ' PROXY RESPONSE RECEIVED: ' + msg);

  Logger.debug(opts.id + ' PROXY RESPONSE RECEIVED: ' + msg);
  Logger.debug('---------------------------------------------------------------------------');
  Logger.debug(res.headers);
};

const startProxyRequest = (res, proxy, opts, lang) => {
  logProxyRequest(opts);

  const proxyReq = proxy.request(opts, (proxyRes) => {
    const encoding = proxyRes.headers['content-encoding'];
    const isHtml = /text\/html/.test(proxyRes.headers['content-type']);

    let body = [];

    logProxyResponse(proxyRes, opts);

    let headers = Object.assign({}, proxyRes.headers);
    if (isHtml || lang) {
      headers['access-control-allow-origin'] = opts.host;
      //headers['transfer-encoding'] = 'identity';
      delete headers['transfer-encoding'];
      //headers['content-encoding'] = 'gzip';
    }
    const savedHeader = {
      statusCode: proxyRes.statusCode,
      statusMessage: proxyRes.statusMessage,
      encoding,
      headers
    };
    if (!(isHtml || lang)) {
      res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, headers)
    }
    //proxyRes.setEncoding('utf8');

    proxyRes.on('error', (e) => {
      Logger.error(opts.id + ' PROXY RESPONSE ERROR');
      serverError(e, res);
    });

    proxyRes.on('data', (chunk) => {
      Logger.info(opts.id + ' PROXY RESPONSE DATA');
      body.push(chunk);
      if (!(isHtml || lang)) res.write(chunk);
    });

    proxyRes.on('end', () => {
      if (!(isHtml || lang) || body.length === 0) {
	Logger.info(opts.id + ' PROXY RESPONSE END');
        res.end();
        return;
      }
      const buffer = Buffer.concat(body);
      saveResponse(opts, null, savedHeader, buffer, () => {});
      if (lang) {
        const doc = uncompress(buffer, encoding);
        translatePage(doc, lang, (err, translatedHtml) => {
          if (err) {
            Logger.error(opts.id + 'Proxy#startProxyRequest Translation Failed');
            Logger.error(err);
            //res.end(zlib.gzipSync(injectAlert(doc)));
            const gzipped = compress(injectAlert(doc), encoding);
            headers['content-length'] = gzipped.length
	    console.log(opts.id + ' PROXY RESPONSE END: RETURNING ERROR INJECTED PAGE: ' + gzipped.length + ' == ' + headers['content-length']);
	    Logger.info(opts.id + ' PROXY RESPONSE END: RETURNING ERROR INJECTED PAGE: ' + gzipped.length + ' == ' + headers['content-length']);
	    res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, headers)
            res.end(gzipped);
          } else {
            //const gzipped = zlib.gzipSync(translatedHtml);
            const gzipped = compress(translatedHtml, encoding);
            savedHeader.headers['content-length'] = gzipped.length;
	    console.log(opts.id + ' PROXY RESPONSE END: RETURNING TRANSLATED PAGE: ' + gzipped.length + ' == ' + savedHeader.headers['content-length']);
	    Logger.info(opts.id + ' PROXY RESPONSE END: RETURNING TRANSLATED PAGE: ' + gzipped.length + ' == ' + savedHeader.headers['content-length']);
	    res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, savedHeader.headers)
            res.end(gzipped);
            saveResponse(opts, lang, savedHeader, gzipped, () => {});
          }
        });
      } else {
        console.log(opts.id + ' PROXY RESPONSE END: BUFFERED PAGE: ' + buffer.length + ' == ' + savedHeader.headers['content-length']);
        res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, savedHeader.headers)
        res.end(buffer);
      }

      Logger.info(opts.id + ' PROXY REQUEST END');
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

const translatePage = (doc, lang, callback) => {
  //Logger.debug('---------------------------------------------------------------------------');
  //Logger.debug(doc);

  //translate(doc, lang, (err, translatedHtml) => {
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

