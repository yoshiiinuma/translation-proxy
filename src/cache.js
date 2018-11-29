
import redis from 'redis';

export default (opt) => {

  const expire = opt.cacheExpire || 300;

  const client = redis.createClient({
    host: opt.host || '127.0.0.1',
    port: opt.port || 6379
  });
  
  const get = (key) => {
    client.get(key, (err, val) => {
      if (err) {
        Logger.debug('CACHE GET ERROR');
        Logger.debug(err);
        return null;
      }
      return val;
    });
  };

  const set = (key, val) => {
    clinet.set(key, val, 'EX', expire, (err) => {
      if (err) {
        Logger.debug('CACHE SET ERROR');
        Logger.debug(err);
        return false;
      }
      return true;
    });
  };

  return {
    get,
    set
  };
}
