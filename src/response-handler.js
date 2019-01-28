
import cheerio from 'cheerio';

import Logger from './logger.js';
import { compressAsync, uncompressAsync } from './compress.js';

export const TranslationNotAvailable =
`<script>
  function displayAlert() { alert('Translation service is currently not available. Please try again later.') };
  setTimeout(displayAlert, 1000);
</script>`;

export const TooLargePage =
`<script>
  function displayAlert() { alert('The requested page is too large to translate.') };
  setTimeout(displayAlert, 1000);
</script>`;

const injectAlert = (html, err) => {
  try {
    const $ = cheerio.load(html);
    if (err.error && err.error === 'Too Large Page') {
      $(TooLargePage).appendTo('body');
    } else {
      $(TranslationNotAvailable).appendTo('body');
    }
    return $.html();
  }
  catch (err) {
    Logger.error('INJECTALERT ERROR');
    Logger.error(err);
    return html;
  }
}

export const setUpResponseHandler = (translateFunc, cacheHandler) => {
  const ResponseHandler = {};

  const translator = translateFunc;
  const ResponseCache = cacheHandler;

  ResponseHandler.sendBuffer = (res, buffer, proxyResObj, logPrefix) => {
    //console.log(logPrefix + ': ' + buffer.length + ' == ' + proxyResObj.headers['content-length']);
    Logger.info(logPrefix + ': ' + buffer.length + ' == ' + proxyResObj.headers['content-length']);
    res.writeHead(proxyResObj.statusCode, proxyResObj.statusMessage, proxyResObj.headers)
    res.end(buffer);
  }

  ResponseHandler.sendTranslation = async (res, buffer, reqObj, proxyResObj, logPrefix) => {
    const doc = await uncompressAsync(buffer, proxyResObj.encoding);
    let gzipped;
    let pageType = 'TRANSLATED PAGE';

    translator.translatePage(doc, proxyResObj.lang, async (err, translatedHtml) => {
      if (err) {
        Logger.error(logPrefix + 'TRANSLATION FAILED');
        Logger.error(err);
        pageType = 'ERROR INJECTED PAGE';
        gzipped = await compressAsync(injectAlert(doc, err), proxyResObj.encoding);
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

  return ResponseHandler;
};
