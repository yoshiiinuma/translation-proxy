
import cheerio from 'cheerio';

import Logger from './logger.js';
import { createConnectionOption, callTranslateApi } from './translate.js';

const DEFAULT_MAX_PAGESIZE = 50000;
const DEFAULT_LIMIT = 5000;

/**
 * NOTE: Initialize Logger before calling this function
 */
export const createHtmlPageTranslator = (conf) => {
  const selectors = conf.translationSelectors;
  const maxTextPerRequest = conf.maxTextPerRequest;
  const domBreakdownThreshold = conf.domBreakdownThreshold;

  const translatePage = (html, lang, callback) => {
    const page = loadPage(html, conf);
    page.translateAll(selectors, lang, maxTextPerRequest, domBreakdownThreshold, (err, translatedHtml) => {
      if (err) {
        callback(err);
      } else {
        callback(null, translatedHtml);
      }
    });
  };

  return { translatePage };
}

export const loadPage = (html, conf) => {
  const $ = cheerio.load(html);

  const translatePage = (lang, callback) => {
    translateAll(conf.translationSelectors, lang, conf.maxTextPerRequest, conf.domBreakdownThreshold, (err, translatedHtml) => {
      if (err) {
        callback(err);
      } else {
        callback(null, translatedHtml);
      }
    });
  };

  /**
   * limit: Max text size to send to API
   * threshold: Threshold that specifies how deep the parser goes down into the DOM tree.
   *            If the size of a component is larger than this, parse its children.
   *            Otherwise, stop parsing.
   *
   */
  const translateAll = (selectors, lang, limit, threshold, callback) => {
    const maxPageSize = conf.maxPageSize || DEFAULT_MAX_PAGESIZE;
    const all = sortOutBySize(selectors, limit, threshold);
    logSorted(all);
    const total = totalComponentSize(all);
    if (total > maxPageSize) {
      Logger.info('TRANSLATE ALL TOO LARGE PAGE: ' + total);
      callback({ error: 'Too Large Page', size: total });
      return;
    }

    Logger.info('TRANSLATE ALL BLOCK SIZE: ' + all.length + ' Lang: ' + lang);
    createConnectionOption(conf)
      .then((apiOpts) => {
        return Promise.all(all.map((components, i) => {
          return translatePortion(components, lang, apiOpts, i);
        }));
        //return all.reduce((promise, components) => {
        //  return translatePortion(components, lang, apiOpts);
        //}, Promise.resolve());
      })
      .then(() => {
        Logger.info('TRANSLATE ALL: Done!!!');
        callback(null, $.html());
      })
      //.catch((err) => callback(err));
      .catch((err) => callback({ error: 'API Error', details: err }));
  };

  const translatePortion = (components, lang, apiOpts, i) => {
    Logger.info('TRANSLATE PORTION: START #' + i + ' : LEN ' + components.length);
    const data = createPostData(components, lang);

    return callTranslateApi(apiOpts, data)
      .then((translated) => {
        Logger.info('TRANSLATE PORTION: END #' + i);
        replaceTexts(components, translated);
      });
  };

  const extractTextForTranslation = (components) => {
    const q = [];
    components.forEach((x) => q.push(x.html()));
    return q;
  };

  const replaceTexts = (components ,translated) => {
    components.forEach((x) => {
      x.html(translated.shift().translatedText);
    });
  };

  const createPostData = (components, lang) => {
    const q = extractTextForTranslation(components);
    return {
      source: 'en',
      target: lang,
      format: 'html',
      q
    }
  };

  const hasText = (x) => {
    if (!x.contents) x = $(x);
    if (x.contents().filter((i, e) => {
      if (e.type === 'text') {
        if (e.data.replace(/(?:\\[rn]|[\r\n]+)+/g, '').trim().length > 0) {
          return true;
        }
      }
    }).length > 0) {
      return true;
    } else {
      return false;
    }
  };

  const totalComponentSize = (sorted) => {
    //showSorted(sorted);
    return sorted.reduce((total, components) => {
      return total + components.reduce((subTotal, elm) => {
        
        return subTotal + elm.html().length;
      }, 0);
    }, 0);
  };

  const sortOutBySize = (selectors, limit, threshold) => {
    if (!selectors) selectors = ['body'];
    if (!Array.isArray(selectors)) selectors = [selectors];
    if (selectors.length === 0) selectors = ['body'];

    const r = [];
    let temp = [];
    let curTotal = 0;

    const dfs = (elm) => {
      const x = $(elm);
      const size = x.html().length;

      if (!hasText(x) && size > threshold) {
        x.children().each((i, e) => dfs(e));
        return;
      }
      if (curTotal + size > limit) {
        if (temp.length > 0) {
          r.push(temp);
          temp = [];
          curTotal = 0;
        }
      }
      temp.push(x);
      curTotal += size;
    };

    selectors.forEach((sel) => {
      let elms = $(sel);
      elms.each((i, elm) => {
        dfs(elm);
      });
    });

    if (temp.length > 0) {
      r.push(temp);
    }
    return r;
  };

  const showDomTreeRecursively = (e, indent = '') => {
    const x = $(e);
    if (e.type === 'text') {
      const text = e.data.replace(/\n|\r/g, '').trim();
      if (text.length > 0) {
        console.log(indent + 'text (' + e.data.length + ' => ' + text.length + ') ' + text);
      }
    } else {
      console.log(indent + e.name + ' (' + e.type + ', ' + x.html().length + ')');
    }
    x.contents().each((i, c) => {
      showDomTreeRecursively(c, indent + '  ');
    });
  };

  const showDomTree = (selector) => {
    const elms = $(selector);
    if (elms.length > 0) {
      elms.each((i, e) => {
        showDomTreeRecursively(e);
      });
    } else {
      console.log('Element Not Found: ' + selector);
    }
  };

  const logSorted = (sorted) => {
    let total = 0;
    let subTotal = 0;
    Logger.debug('===================================================');
    sorted.forEach((ary) => {
      ary.forEach((x) => {
        logElement(x);
        subTotal += x.html().length;
      });
      Logger.debug( '--- [SUBTOTAL]: ' + subTotal + ' -------------------------------');
      total += subTotal;
      subTotal = 0;
    });
    Logger.debug( '=== [TOTAL]: ' + total + ' ==================================');
  };

  const showSorted = (sorted) => {
    let total = 0;
    let subTotal = 0;
    console.log('===================================================');
    sorted.forEach((ary) => {
      ary.forEach((x) => {
        showElement(x);
        subTotal += x.html().length;
      });
      console.log( '--- [SUBTOTAL]: ' + subTotal + ' -------------------------------');
      total += subTotal;
      subTotal = 0;
    });
    console.log( '=== [TOTAL]: ' + total + ' ==================================');
  };

  const showComponents = (components) => {
    let subTotal = 0;
    console.log('---------------------------------------------------');
    components.forEach((x) => {
      showElement(x);
      subTotal += x.html().length;
    });
    console.log( '--- [SUBTOTAL]: ' + subTotal + ' -------------------------------');
  };

  const logElement = (elm) => {
    const x = $(elm);
    const e = x.get(0);
    if (e.type === 'text') {
      const text = e.data.replace(/\n|\r/g, '').trim();
      if (text.length > 0) {
        Logger.debug('text (' + e.data.length + ' => ' + text.length + ') ' + text);
      }
    } else {
      let attrs = [];
      if (x.attr('id')) attrs.push('#' + x.attr('id'));
      if (x.attr('class')) attrs.push('.' + x.attr('class'));
      let attr = ' [' + attrs.join(' ') + ']';
      Logger.debug(e.name + attr + ' (' + e.type + ' SIZE: ' + x.html().length +
           ' ELEMENTS: ' + x.children().length + ' / ' + x.contents().length + ')');
    }
  }

  const showElement = (elm) => {
    const x = $(elm);
    const e = x.get(0);
    if (e.type === 'text') {
      const text = e.data.replace(/\n|\r/g, '').trim();
      if (text.length > 0) {
        console.log('text (' + e.data.length + ' => ' + text.length + ') ' + text);
      }
    } else {
      let attrs = [];
      if (x.attr('id')) attrs.push('#' + x.attr('id'));
      if (x.attr('class')) attrs.push('.' + x.attr('class'));
      let attr = ' [' + attrs.join(' ') + ']';
      console.log(e.name + attr + ' (' + e.type + ' SIZE: ' + x.html().length +
           ' ELEMENTS: ' + x.children().length + ' / ' + x.contents().length + ')');
    }
  }

  const select = (selector) => {
    const r = selectAll(selector);
    return r && r[0] ? r[0] : null;
  };

  const selectAll = (selector) => {
    return $(selector);
  };

  return {
    translatePage,
    translateAll,
    translatePortion,
    createPostData,
    extractTextForTranslation,
    replaceTexts,
    select,
    hasText,
    totalComponentSize,
    sortOutBySize,
    showSorted,
    showDomTree
  };
};

