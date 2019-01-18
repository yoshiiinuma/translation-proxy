
import Logger from './logger.js';
import { compressAsync, uncompressAsync } from './compress.js';

let translator = () => {
}

export setTranslator = (tranlateFunc) => {
  translator = translateFunc;
};

export const sendBuffer = (res, buffer, proxyResObj, logMsg) => {
  //console.log(logMsg + ': ' + buffer.length + ' == ' + proxyResObj.headers['content-length']);
  Logger.info(logMsg + ': ' + buffer.length + ' == ' + proxyResObj.headers['content-length']);
  res.writeHead(proxyResObj.statusCode, proxyResObj.statusMessage, proxyResObj.headers)
  res.end(buffer);
}

export const sendTranslation = async (res, buffer, reqObj, proxyResObj, logPrefix) => {
  const doc = await uncompressAsync(buffer, proxyResObj.encoding);
  let gzipped;
  let pageType = 'TRANSLATED PAGE';

  translator.translatePage(doc, proxyResObj.lang, async (err, translatedHtml) => {
    if (err) {
      Logger.error(logPrefix + 'TRANSLATION FAILED');
      Logger.error(err);
      pageType = 'ERROR INJECTED PAGE';
      gzipped = await compressAsync(injectAlert(doc), proxyResObj.encoding);
      proxyResObj.headers['content-length'] = gzipped.length;
    } else {
      gzipped = await compressAsync(translatedHtml, proxyResObj.encoding);
      proxyResObj.headers['content-length'] = gzipped.length;
      const cookies = proxyResObj.headers['set-cookie'] || [];
      cookies.push('SELECTEDLANG=' + proxyResObj.lang);
      proxyResObj.headers['set-cookie'] = cookies;
      ResponseCache.save(reqObj, proxyResObj.lang, proxyResObj, gzipped);
    }
    //console.log(logPrefix + 'END: RETURNING ' + pageType + ': ' + proxyResObj.headers['content-length']);
    Logger.info(logPrefix + 'END: RETURNING ' + pageType + ': ' + proxyResObj.headers['content-length']);
    res.writeHead(proxyResObj.statusCode, proxyResObj.statusMessage, proxyResObj.headers);
    res.end(gzipped);
  });
};

