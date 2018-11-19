
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
    console.log(indent + e.name + ' (' + e.type + ', ' + x.html().length + ')'); 
    x.children().each((i, c) => {
      showDomTreeRecursively(c, indent + '  ');
    });
  };

  const showDomTree = (selector) => {
    const e = $(selector);
    if (e && e.first()) {
      showDomTreeRecursively(e[0]);
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

