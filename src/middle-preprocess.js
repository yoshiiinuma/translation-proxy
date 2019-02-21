
import requestIp from 'request-ip';
import URL from 'url';
import Logger from './logger.js';

const rgxHost = /^(.+):(\d+)$/;
const rgxQuery = /\?(.+)$/;
const rgxLang = /&?(lang=([a-z][a-zA-Z-]+)&?)/;

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

    let path = reqUrl.path;
    let query = null;
    if (rgxQuery.test(path)) {
      const queryMatched = rgxQuery.exec(path);
      query = queryMatched[1];
      if (rgxLang.test(query)) {
        const langMatched = rgxLang.exec(query);
        lang = langMatched[2];
        path = path.replace(langMatched[1], '');
      }
    }
    if (path.endsWith('&')) path = path.slice(0, -1);
    if (path.endsWith('?')) path = path.slice(0, -1);

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
