
import Logger from './logger.js';
import { serverError, badRequest, forbidden } from './error-handler.js';

export const setUpMiddleFirewall = (conf) => {
  const proxiedHosts = conf.proxiedHosts;
  const purgeAllowedIps = conf.purgeAllowedIps || [];

  return (req, res, next) => {
    if (!res.locals || !res.locals.reqObj) {
      serverError('REQOBJ NOT PROVIDED', res);
      return;
    }
    const reqObj = res.locals.reqObj;

    if (reqObj.method === 'PURGE') {

      if (!purgeAllowedIps.includes(reqObj.remoteIp)) {
        forbidden('PURGE Not Allowed from: ' + reqObj.remoteIp, res);
        return;
      }
    }

    if (proxiedHosts[reqObj.host]) {
      next();
      return;
    }
    Logger.debug(reqObj.id + ' CLIENT REQUEST NOT PROXIED: ' + reqObj.href);
    badRequest('Not Proxied: ' + reqObj.href, res);
  };
};
