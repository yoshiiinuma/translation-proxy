
import cheerio from 'cheerio';

const DEFAULT_LIMIT = 5000;

export default (translator, html) => {
  const $ = cheerio.load(html);
  let components;

  const extractComponentsForTranslation = (rootSel) => {
    components = [];
    let e = $(rootSel);
  };

  const hasText = (x) => {
    if (x.contents().filter((i, e) => {
      if (x.type === 'text') {
        if (x.data.replace(/\n|\r/g, '').trim() > 0) {
          return true;
        }
      }
      return false;
    }).length > 0) {
      return ture;
    } else {
      return false;
    }
  };

  /**
   * need two arrays for temp and final
   * total size of temp array
   */
  const sortOutBySizeRecursively = (elm, size, r) => {
    const x = $(elm);
    if (hasText(x)) {
      r.push(x);
    }

    /**
     * if elm has text, push it
     * if elm size is smaller than limit, push it
     * if elm size is larger than limit, push it
     * if elm has a single component that is not text, go next
     * if elm has multiple components, check one by one
     */
    x.contents().each((i, c) => {
      sortOutBySizeRecursively(c, size, r);
    });
  };

  const sortOutBySize = (selector, size) => {
    const elms = $(selector);
    let r = [];
    if (elms.length === 0) {
      return r;
    }
    elms.each((i, e) => {
      sortOutBySizeRecursively(e, size, r);
    });
  };

  const translate = () => {
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

  return {
    extractComponentsForTranslation,
    sortOutBySize,
    translate,
    showDomTree
  };
};

