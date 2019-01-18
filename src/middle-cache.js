
import createResponseCache from './response-cache.js';

export default (req, res, next) => {
  const ResponseCache = createResponseCache(res.locals.conf);
  const obj = res.locals.reqObj;
  const logPreSer = obj.id + ' SERVER RESPONSE ';

  if (obj.lang) {
    const translated = await ResponseCache.get(obj, obj.lang);
    if (translated) {
      const savedRes = translated.res
      sendBuffer(res, translated.buffer, savedRes, logPreSer + 'END: RETURNING CACHED TRANSLATED');
      return;
    }
  }

  const original = await ResponseCache.get(obj, null);
  if (original) {
    const savedRes = original.res
    if (obj.lang) {
      savedRes.lang = obj.lang;
      savedRes.href = obj.href;
      sendTranslation(res, original.buffer, obj, savedRes, logPreSer);
    } else {
      sendBuffer(res, original.buffer, savedRes, logPreSer + 'END: RETURNING CACHED ORIGIANL');
    }
  } else {
    next();
  }
};

