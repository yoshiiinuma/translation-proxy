
import cheerio from 'cheerio';

const DEFAULT_LIMIT = 5000;

export default (translator, html) => {
  const $ = cheerio.load(html);
  let components;

  const extractComponentsForTranslation = (rootSel) => {
    components = [];
    let e = $(rootSel);
  };

  const sortOutBySize = (root, size) => {
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

