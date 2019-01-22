
import Logger from './logger.js';
import { badRequest } from './error-handler.js';

export setUpMiddleFirewall = (conf) => {
  const proxiedHosts = conf.proxiedHosts;

  return (req, res, next) => {
    const reqObj = res.locals.reqObj;

    if (proxiedHosts[reqObj.host]) {
      next();
      return;
    }
    Logger.debug(reqObj.id + ' CLIENT REQUEST NOT PROXIED: ' + reqObj.href);
    badRequest('Not Proxied: ' + reqObj.href, res);
  };
};
