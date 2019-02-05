
import Logger from './logger.js';
import { serverError } from './error-handler.js';

export const setUpMiddleCachePurger = (cacheHandler) => {
  const ResponseCache = cacheHandler;

  return async (req, res, next) => {
    if (!res.locals || !res.locals.reqObj) {
      serverError('REQOBJ NOT PROVIDED', res);
      return;
    }
    const obj = res.locals.reqObj;
    const logPrefix = obj.id + ' SERVER RESPONSE ';

    if (obj.method === 'PURGE') {
      Logger.debug('PURGE CACHE: ' + obj.href);
      ResponseCache.purge(obj, obj.lang);

      res.writeHead(200, 'OK', { 'content-type': 'text/plain' });
      res.end('Cache was successfully deleted');
      return;
    }

    next();
  };
};
