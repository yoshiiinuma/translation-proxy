
import redis from 'redis';
import { promisify } from 'util';

export default (opt) => {

  const expire = opt.cacheExpire || 300;

  const client = redis.createClient({
    host: opt.host || '127.0.0.1',
    port: opt.port || 6379,
    db: opt.db || 0
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

  const setAsync = (key, val) => {
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

  const set = (key, val, callback) => {
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
