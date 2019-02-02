
import crypto from 'crypto';

import Logger from './logger.js';
import createCache from './cache.js';

/**
 * opts: options for http request
 * lang: google cloud translate language code
 */
const getFullUrl = (opts, lang) => {
  let url = opts.protocol + '//' + opts.host;
  if (opts.port) url += ':' + opts.port;
  url += opts.path;
  if (lang && !url.includes('lang=')) {
    if (url.includes('?')) {
      url += '&lang=' + lang;
    } else {
      url += '?lang=' + lang;
    }
  }
  return url;
};

/**
 * opts: options for http request
 * lang: google cloud translate language code
 */
const getKey = (prefix, opts, lang) => {
  const reqStr = opts.method + '+' + getFullUrl(opts, lang);
  let key = prefix + crypto.createHash('md5').update(reqStr).digest('hex');
  return key;
};

const getCache = async (opts, lang) => {
  return await cache.getAsync(getKey('PAGE-', opts, lang));
}

const setCache = async (opts, lang, val) => {
  return await cache.setAsync(getKey('PAGE-', opts, lang), val);
}

const DEFAULT_EXPIRE_IN_SECS = 300;

const createTtlRules = (conf) => {
  let r = { rules: [], defaultTtl: DEFAULT_EXPIRE_IN_SECS };

  if (conf.cacheTTL) {
    for (let { type, ttl } of conf.cacheTTL) {
      if (type === 'default') {
        r.defaultTtl = ttl;
      } else {
        r.rules.push({ regex: new RegExp(type), ttl });
      }
    }
  }

  return r;
}

const createResponseCache = (conf) => {
  const cache = createCache(conf);
  const ttlRules = createTtlRules(conf);
  const getTtl = (type) => {
      for (let { regex, ttl } of ttlRules.rules) {
        if (regex.test(type)) {
          return ttl;
        }
      }
      return ttlRules.defaultTtl;
  };

  const shouldSkip = (opts) => {
    if (conf.cacheSkipUrls) {
      if (conf.cacheSkipUrls.some((keyword) => { return opts.href.includes(keyword) })) {
        return true;
      }
    }
    if (conf.cacheSkipCookies) {
      if (conf.cacheSkipCookies.some((keyword) => {
          if (!opts.headers || !opts.headers.cookie) return false;
          return opts.headers.cookie.includes(keyword);
        })) {
        return true;
      }
    }
    return false;
  };

  const get = async (opts, lang) => {
    if (!conf.cacheEnabled) return null;
    if (shouldSkip(opts)) return null;
    const headKey = getKey('HEAD-', opts, lang)
    const pageKey = getKey('PAGE-', opts, lang)
    Logger.debug(opts.id + ' CACHE GET: ' + getFullUrl(opts, lang));
    Logger.debug(opts.id + ' CACHE GET: ' + headKey);
    Logger.debug(opts.id + ' CACHE GET: ' + pageKey);
    const head = await cache.getAsync(getKey('HEAD-', opts, lang));
    const body = await cache.getAsync(getKey('PAGE-', opts, lang));
    if (!head || !body) return null;
    return {
      res: JSON.parse(head.toString()),
      buffer: body
    };
  };

  const save = async (opts, lang, resObj, body) => {
    if (!conf.cacheEnabled) return false;
    if (!(opts.method === 'GET' || opts.method === 'HEAD')) return false;
    if (shouldSkip(opts)) return false;
    const expInSecs = getTtl(resObj.headers['content-type']);
    const hrefKey = getKey('HREF-', opts, lang)
    const headKey = getKey('HEAD-', opts, lang)
    const pageKey = getKey('PAGE-', opts, lang)
    Logger.debug(opts.id + ' CACHE SAVE: ' + getFullUrl(opts, lang));
    Logger.debug(opts.id + ' CACHE SAVE: ' + hrefKey);
    Logger.debug(opts.id + ' CACHE SAVE: ' + headKey);
    Logger.debug(opts.id + ' CACHE SAVE: ' + pageKey);
    await cache.setAsync(hrefKey, resObj.href, expInSecs);
    await cache.setAsync(headKey, JSON.stringify(resObj), expInSecs);
    await cache.setAsync(pageKey, body, expInSecs);
    return true;
  };

  const del = async (opts, lang) => {
    if (!conf.cacheEnabled) return false;
    const headKey = getKey('HEAD-', opts, lang)
    const pageKey = getKey('PAGE-', opts, lang)
    Logger.debug(opts.id + ' CACHE DEL: ' + getFullUrl(opts, lang));
    Logger.debug(opts.id + ' CACHE DEL: ' + headKey);
    Logger.debug(opts.id + ' CACHE DEL: ' + pageKey);
    cache.delAsync(getKey('HEAD-', opts, lang));
    cache.delAsync(getKey('PAGE-', opts, lang));
    return true;
  };

  const ResponseCache = {
    ttlRules: ttlRules,
    getTtl: getTtl,
    shouldSkip: shouldSkip,
    get: get,
    save: save,
    del: del,
    purge: async (opts, lang) => {
      if (!conf.cacheEnabled) return false;
      del({ ...opts, ...{ method: 'GET' } }, lang);
      del({ ...opts, ...{ method: 'HEAD' } }, lang);
      return true;
    }
  };

  return ResponseCache;
};

export default createResponseCache;
