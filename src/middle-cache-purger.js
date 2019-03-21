
import Logger from './logger.js';
import { serverError } from './error-handler.js';

export const setUpMiddleCachePurger = (cacheHandler) => {
  const ResponseCache = cacheHandler;

  const purgeAllPath = '/purge-proxy-cache?page=all';

  return async (req, res, next) => {
    if (!res.locals || !res.locals.reqObj) {
      serverError('REQOBJ NOT PROVIDED', res);
      return;
    }
    const obj = res.locals.reqObj;
    const logPrefix = obj.id + ' SERVER RESPONSE ';

    if (obj.method === 'PURGE') {
      if (obj.path === purgeAllPath) {
        Logger.debug('PURGE ALL CACHE: ' + obj.href);
        ResponseCache.purgeAll(obj);

        res.writeHead(200, 'OK', { 'content-type': 'text/plain' });
        res.end('FLUSHALL request was successfully submitted');
        return;
      } else {
        Logger.debug('PURGE CACHE: ' + obj.href);
        ResponseCache.purge(obj, obj.lang);

        res.writeHead(200, 'OK', { 'content-type': 'text/plain' });
        res.end('PURGE request was successfully submitted');
        return;
      }
    }

    next();
  };
};
