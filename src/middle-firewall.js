
import Logger from './logger.js';
import { serverError, badRequest } from './error-handler.js';

export const setUpMiddleFirewall = (conf) => {
  const proxiedHosts = conf.proxiedHosts;

  return (req, res, next) => {
    if (!res.locals || !res.locals.reqObj) {
      serverError('REQOBJ NOT PROVIDED', res);
      return;
    }
    const reqObj = res.locals.reqObj;

    if (proxiedHosts[reqObj.host]) {
      next();
      return;
    }
    Logger.debug(reqObj.id + ' CLIENT REQUEST NOT PROXIED: ' + reqObj.href);
    badRequest('Not Proxied: ' + reqObj.href, res);
  };
};
