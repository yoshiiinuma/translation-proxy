
import crypto from 'crypto';

import Logger from './logger.js';
import createCache from './cache.js';

/**
 * reqObj: options for http request
 * lang: google cloud translate language code
 */
const getFullUrl = (reqObj, lang) => {
  let url = reqObj.protocol + '//' + reqObj.host;
  if (reqObj.port) url += ':' + reqObj.port;
  url += reqObj.path;
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
 * reqObj: options for http request
 * lang: google cloud translate language code
 */
const getKey = (prefix, reqObj, lang) => {
  const reqStr = reqObj.method + '+' + getFullUrl(reqObj, lang);
  let key = prefix + crypto.createHash('md5').update(reqStr).digest('hex');
  return key;
};

const getCache = async (reqObj, lang) => {
  return await cache.getAsync(getKey('PAGE-', reqObj, lang));
}

const setCache = async (reqObj, lang, val) => {
  return await cache.setAsync(getKey('PAGE-', reqObj, lang), val);
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

/**
 * 302, 307, 500, 503: only for short term
 */
const CACHEABLE_RESPONSES = {
  200: true,  // OK
  203: true,  // Non Authoritative Information
  204: true,  // No Content
  206: true,  // Partial Content
  300: true,  // Multiple Choices
  301: true,  // Moved Permanently
  302: true,  // Found (Moved Temporarily)
  307: true,  // Temporary Redirect
  308: true,  // Permanent Redirect
  404: true,  // Not Found
  405: true,  // Method Not Allowed
  410: true,  // Gone
  414: true,  // URL Too Long
  500: true,  // Internal Server Error
  501: true,  // Not Implemented
  503: true,  // Service Not Available
};

const SHORTTERM_CACHE = {
  302: true,  // Found (Moved Temporarily)
  307: true,  // Temporary Redirect
  500: true,  // Internal Server Error
  503: true,  // Service Not Available
};

const createResponseCache = (conf) => {
  const cache = createCache(conf);
  const ttlRules = createTtlRules(conf);
  const shortTtl = conf.cacheShortTTL || DEFAULT_EXPIRE_IN_SECS;

  const getTtl = (resObj) => {
    const type = resObj.headers['content-type'];
    if (SHORTTERM_CACHE[resObj.statusCode]) {
      return shortTtl;
    }
    for (let { regex, ttl } of ttlRules.rules) {
      if (regex.test(type)) {
        return ttl;
      }
    }
    return ttlRules.defaultTtl;
  };

  const shouldSkip = (reqObj) => {
    if (conf.cacheSkipUrls) {
      if (conf.cacheSkipUrls.some((keyword) => { return reqObj.href.includes(keyword) })) {
        return true;
      }
    }
    if (conf.cacheSkipCookies) {
      if (conf.cacheSkipCookies.some((keyword) => {
          if (!reqObj.headers || !reqObj.headers.cookie) return false;
          return reqObj.headers.cookie.includes(keyword);
        })) {
        return true;
      }
    }
    return false;
  };

  const isCacheable = (reqObj, resObj) => {
    if (reqObj.method !== 'GET' && reqObj.method !== 'HEAD') return false;
    if (CACHEABLE_RESPONSES[resObj.statusCode]) {
      return true;
    }
    return false
  };

  const RGX_NOCACHE = new RegExp('no-cache');

  /**
   * Validates the cache if and only if either if-none-match or if-modified-since is provided.
   * Returns false otherwise.
   */
  const validate = (reqObj, cachedRes) => {
    const req = reqObj.headers;
    const res = cachedRes.headers;

    if (!req) {
      Logger.debug(reqObj.id + ' CACHE VALIDATION: NO REQUEST HEADERS');
      return false;
    }
    if (!res) {
      Logger.debug(reqObj.id + ' CACHE VALIDATION: NO RESPONSE HEADERS');
      return false;
    }

    if (req['cache-control']) {
      if (RGX_NOCACHE.test(req['cache-control'])) {
        Logger.debug(reqObj.id + ' CACHE VALIDATION: NO-CACHE');
        return false;
      }
    }

    if (req['if-none-match']) {
      if (res['etag']) {
        if (req['if-none-match'] === res.etag) {
          Logger.debug(reqObj.id + ' CACHE VALIDATION: ETAG MATCHED')
          return true;
        }
      }
    }

    if (req['if-modified-since']) {
      if (res['last-modified']) {
        if (req['if-modified-since'] === res['last-modified']) {
          Logger.debug(reqObj.id + ' CACHE VALIDATION: LAST-MODIFIED MATCHED');
          return true;
        }
      }
    }

    Logger.debug(reqObj.id + ' CACHE VALIDATION: FAILED');
    return false;
  };

  const get = async (reqObj, lang) => {
    if (!conf.cacheEnabled) return null;
    if (shouldSkip(reqObj)) return null;
    const headKey = getKey('HEAD-', reqObj, lang)
    const pageKey = getKey('PAGE-', reqObj, lang)
    Logger.debug(reqObj.id + ' CACHE GET: ' + getFullUrl(reqObj, lang));
    Logger.debug(reqObj.id + ' CACHE GET: ' + headKey);
    Logger.debug(reqObj.id + ' CACHE GET: ' + pageKey);
    const head = await cache.getAsync(getKey('HEAD-', reqObj, lang));
    const body = await cache.getAsync(getKey('PAGE-', reqObj, lang));
    if (!head || !body) return null;
    return {
      res: JSON.parse(head.toString()),
      buffer: body
    };
  };

  const save = async (reqObj, lang, resObj, body) => {
    if (!conf.cacheEnabled) return false;
    //if (!(reqObj.method === 'GET' || reqObj.method === 'HEAD')) return false;
    if (!isCacheable(reqObj, resObj)) return false;
    if (shouldSkip(reqObj)) return false;
    const expInSecs = getTtl(resObj);
    const hrefKey = getKey('HREF-', reqObj, lang)
    const headKey = getKey('HEAD-', reqObj, lang)
    const pageKey = getKey('PAGE-', reqObj, lang)
    Logger.debug(reqObj.id + ' CACHE SAVE: ' + getFullUrl(reqObj, lang));
    Logger.debug(reqObj.id + ' CACHE SAVE: ' + hrefKey);
    Logger.debug(reqObj.id + ' CACHE SAVE: ' + headKey);
    Logger.debug(reqObj.id + ' CACHE SAVE: ' + pageKey);
    await cache.setAsync(hrefKey, resObj.href, expInSecs);
    await cache.setAsync(headKey, JSON.stringify(resObj), expInSecs);
    await cache.setAsync(pageKey, body, expInSecs);
    return true;
  };

  const del = async (reqObj, lang) => {
    if (!conf.cacheEnabled) return false;
    const headKey = getKey('HEAD-', reqObj, lang)
    const pageKey = getKey('PAGE-', reqObj, lang)
    Logger.debug(reqObj.id + ' CACHE DEL: ' + getFullUrl(reqObj, lang));
    Logger.debug(reqObj.id + ' CACHE DEL: ' + headKey);
    Logger.debug(reqObj.id + ' CACHE DEL: ' + pageKey);
    cache.delAsync(getKey('HEAD-', reqObj, lang));
    cache.delAsync(getKey('PAGE-', reqObj, lang));
    return true;
  };

  const ResponseCache = {
    ttlRules: ttlRules,
    getTtl: getTtl,
    shouldSkip: shouldSkip,
    isCacheable: isCacheable,
    validate: validate,
    get: get,
    save: save,
    del: del,
    purge: async (reqObj, lang) => {
      if (!conf.cacheEnabled) return false;
      del({ ...reqObj, ...{ method: 'GET' } }, lang);
      del({ ...reqObj, ...{ method: 'HEAD' } }, lang);
      return true;
    }
  };

  return ResponseCache;
};

export default createResponseCache;
