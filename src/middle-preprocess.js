
import requestIp from 'request-ip';
import URL from 'url';
import Logger from './logger.js';

const rgxHost = /^(.+):(\d+)$/;

export const setUpPreprocessor = (conf) => {
  let cnt = 0;
  const targetHttpPort = conf.targetHttpPort || 80;
  const targetHttpsPort = conf.targetHttpsPort || 443;

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

    console.log('===================================================================================');
    console.log('==> ' + method + ' ' + scheme + '://' + host + reqUrl.path);
    console.log('===================================================================================');
    console.log(headers);

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
  };

  const preprocessor = (req, res, next) => {
    const idOrig = cnt++;
    const id = idOrig.toString().padStart(12, ' ');
    if (!res.locals) res.locals = {};
    res.locals.reqObj = reqToReqObj(req, id);
    res.locals.conf = conf;
    Logger.access(res.locals.reqObj);
    next(); 
  };

  return preprocessor;
};
