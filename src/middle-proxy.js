
import Logger from './logger.js';
import { serverError, serviceUnavailable } from './error-handler.js';

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

export const setUpMiddleProxy = (responseHandler, agentSelector, cacheHandler) => {
  const ResponseHandler = responseHandler;
  const AgentSelector = agentSelector;
  const ResponseCache = cacheHandler;

  return (req, res, next) => {
    const reqObj = res.locals.reqObj;
    const reqOpts = genReqOpts(reqObj);
    const agent = AgentSelector.select(req);
    logProxyRequest(reqObj);

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
          ResponseHandler.sendTranslation(res, buffer, reqObj, savedRes, logPrefix);
        }
      });
    });

    proxyReq.on('error', (e) => {
      Logger.error(reqObj.id + ' PROXY REQUEST ERROR');
      serverError(e, res);
    });

    req.on('data', (chunk) => {
      Logger.debug(logPreCli + 'DATA');
      proxyReq.write(chunk);
    });

    req.on('end', () => {
      Logger.info(logPreCli + 'END');
      proxyReq.end();
    });
  };
};
