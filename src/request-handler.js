
import Logger from './logger.js';
import { notImplemented, serverError } from './error-handler.js';

export const setUpRequestHandler = () => {
  const RequestHandler = {};
  const middleware = [];

  const handle = (req, res, callback) => {
    let i = 0;

    const next = (err) => {
      if (err) {
        return setImmediate(() => callback(err));
      }
      if (i >= middleware.length) {
        return setImmediate(() => callback());
      }
      const layer = middleware[i++];
      setImmediate(() => {
        try {
          layer(req, res, next);
        }
        catch (err) {
          next(err);
        }
      });
    };

    next();
  };

  RequestHandler.serve = (req, res) => {
    handle(req, res, (err) => {
      if (err) {
        serverError(err, res);
        return;
      }
      notImplemented(res);
    });
  };

  RequestHandler.use = (func) => {
    if (typeof func !== 'function') {
      throw new Error('Middleware must be a function');
    }
    middleware.push(func);
  }

  return RequestHandler;
};
