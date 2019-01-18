
import redis from 'redis';

import Logger from './logger.js';

export default (opt) => {

  const DEFAULT_EXPIRE_IN_SECS = 300;

  const client = redis.createClient({
    host: opt.redisHost || '127.0.0.1',
    port: opt.redisPort || 6379,
    return_buffers: true,
    //db: opt.redisDb || 0,
    //no_ready_check: true
  });

  const getAsync = (key) => {
    return new Promise((resolve, reject) => {
      client.get(key, (err, val) => {
        if (err) {
          Logger.debug('CACHE GET ERROR');
          Logger.debug(err);
          return reject(err);
        }
        resolve(val);
      });
    });
  };

  const setAsync = (key, val, expInSecs) => {
    const expire = expInSecs || DEFAULT_EXPIRE_IN_SECS;
    return new Promise((resolve, reject) => {
      client.set(key, val, 'EX', expire, (err) => {
        if (err) {
          Logger.debug('CACHE SET ERROR');
          Logger.debug(err);
          return reject(err);
        }
        resolve();
      });
    });
  };

  const delAsync = (key) => {
    return new Promise((resolve, reject) => {
      client.del(key, (err) => {
        if (err) {
          Logger.debug('CACHE DEL ERROR');
          Logger.debug(err);
          return resolve(err);
        }
        resolve();
      });
    });
  };

  const get = (key, callback) => {
    client.get(key, (err, val) => {
      if (err) {
        Logger.debug('CACHE GET ERROR');
        Logger.debug(err);
        return callback(null);
      }
      callback(val);
    });
  };

  const set = (key, val, expInSecs, callback) => {
    const expire = expInSecs || DEFAULT_EXPIRE_IN_SECS;
    client.set(key, val, 'EX', expire, (err) => {
      if (err) {
        Logger.debug('CACHE SET ERROR');
        Logger.debug(err);
        return callback(err);
      }
      callback(null);
    });
  };

  const del = (key, callback) => {
    client.del(key, (err) => {
      if (err) {
        Logger.debug('CACHE DEL ERROR');
        Logger.debug(err);
        return callback(err);
      }
      callback(null);
    });
  };

  return {
    getAsync,
    setAsync,
    delAsync,
    get,
    set,
    del
  };
};
