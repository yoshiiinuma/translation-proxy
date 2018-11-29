
import redis from 'redis';

export default (opt) => {

  const expire = opt.cacheExpire || 300;

  const client = redis.createClient({
    host: opt.host || '127.0.0.1',
    port: opt.port || 6379,
    db: opt.db || 0
  });
  
  const get = (key, callback) => {
    client.get(key, (err, val) => {
      if (err) {
        Logger.debug('CACHE GET ERROR');
        Logger.debug(err);
        callback(null);
      } else {
        callback(val);
      }
    });
  };

  const set = (key, val, callback) => {
    client.set(key, val, 'EX', expire, (err) => {
      if (err) {
        Logger.debug('CACHE SET ERROR');
        Logger.debug(err);
        callback(err);
      } else {
        callback(null);
      }
    });
  };

  const del = (key, callback) => {
    client.del(key, (err) => {
      if (err) {
        Logger.debug('CACHE DEL ERROR');
        Logger.debug(err);
        callback(err);
      } else {
        callback(null);
      }
    });
  };

  return {
    get,
    set,
    del
  };
};
