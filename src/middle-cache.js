
import createResponseCache from './response-cache.js';

export setUpMiddleCache = (responseHandler, cacheHandler) => {
  const ResponseHandler = responseHandler;
  const ResponseCache = cacheHandler;

  return (req, res, next) => {
    //const ResponseCache = createResponseCache(res.locals.conf);
    const obj = res.locals.reqObj;
    const logPrefix = obj.id + ' SERVER RESPONSE ';

    if (obj.lang) {
      const translated = await ResponseCache.get(obj, obj.lang);
      if (translated) {
        const savedRes = translated.res
        ResponseHandler.sendBuffer(res, translated.buffer, savedRes, logPrefix + 'END: RETURNING CACHED TRANSLATED');
        return;
      }
    }

    const original = await ResponseCache.get(obj, null);
    if (original) {
      const savedRes = original.res
      if (obj.lang) {
        savedRes.lang = obj.lang;
        savedRes.href = obj.href;
        ResponseHandler.sendTranslation(res, original.buffer, obj, savedRes, logPrefix);
      } else {
        ResponseHandler.sendBuffer(res, original.buffer, savedRes, logPrefix + 'END: RETURNING CACHED ORIGIANL');
      }
    } else {
      next();
    }
  };

};
