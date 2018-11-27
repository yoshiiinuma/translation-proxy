
import cheerio from 'cheerio';

import { createConnectionOption, callTranslateApi } from './translate.js';

const DEFAULT_LIMIT = 5000;

//export default (translator, html) => {
export default (html, conf) => {
  const $ = cheerio.load(html);

  const translateAll = (lang, callback) => {
    const all = sortOutBySize('body', limit);

    createConnectionOption(conf)
      .then((apiOpts) => {
        return Promise.all(all.map((components) => {
          return translatePortion(components, lang, apiOpts);
        }));
        //return all.reduce((promise, components) => {
        //  return translatePortion(components, lang, apiOpts);
        //}, Promise.resolve());
      })
      .then(() => callback(null, $.html()))
      .catch((err) => callback(err));
  };

  const translatePortion = (components, lang, apiOpts) => {
    Logger.debug('Translate to LANG: ' + lang);
    let data;
    return createConnectionOption(conf)
      .then((_opts) => opts = _opts)
      .then(() => createPostData(components, lang))
      .then((_data) => data = _data)
      .then(() => callTranslateApi(apiOpts, data))
      .then((rslt) => replaceTexts(components, rslt))
  };

  const extractTextForTranslation = (components) => {
    const q = [];
    components.forEach((x) => q.push(x.html()));
    return q;
  };

  const replaceTexts = (components ,translted) => {
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

  const sortOutBySize = (selector, limit) => {
    const elms = $(selector);
    const r = [];
    let temp = [];
    let curTotal = 0;

    const dfs = (elm) => {
      const x = $(elm);
      const size = x.html().length;

      if (hasText(x)) {
        if (curTotal + size > limit) {
          if (temp.length > 0) {
            r.push(temp);
            temp = [];
            curTotal = 0;
          }
        }
        temp.push(x);
        curTotal += size;
        return;
      }
      if (curTotal + size > limit) {
        if (size > limit) {
          x.children().each((i, e) => dfs(e));
        } else {
          if (temp.length > 0) {
            r.push(temp);
            temp = [];
            curTotal = 0;
          }
          temp.push(x);
          curTotal += size;
          return;
        }
      } else {
        temp.push(x);
        curTotal += size;
        return;
      }
    };

    if (elms.length === 0) {
      return r;
    }
    elms.each((i, elm) => {
      dfs(elm);
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

  //const cheerioObject = (e) => {
  //  return $(e);
  //};

  return {
    //cheerioObject,
    translateAll,
    translatePortion,
    createPostData,
    extractTextForTranslation,
    select,
    hasText,
    sortOutBySize,
    showSorted,
    showDomTree
  };
};

