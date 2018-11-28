
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';

import createHtmlPageTranslator from '../src/page-translator.js';
import { loadConfig } from '../src/conf.js';
import { createConnectionOption, callTranslateApi } from '../src/translate.js';

const conf = loadConfig('./config/config.json');
const html1 = fs.readFileSync('./test/simple.html');
const page = createHtmlPageTranslator(html1, conf);

//describe('page-translator#showDomTree', () => {
//  it('prints out dom tree structure', (done) => {
//    page.showDomTree('body');
//    done();
//  });
//});

//describe('page-translator#translateAll', () => {
//  const html = fs.readFileSync('./test/test.html').toString();
//  const page = createHtmlPageTranslator(html, conf);
//  const sorted = page.sortOutBySize(['#header', '#main', '#footer'], 3000);
//
//  it('translate html page by using API', () => {
//    page.showSorted(sorted);
//    page.translateAll(['#header', '#main', '#footer'], 'ja', 3000, (err, rslt) => {
//      if (err) {
//        console.log(err);
//      } else {
//        console.log(rslt);
//      }
//    });
//  });
//});

//describe('page-translator#translatePortion', () => {
//  const html = fs.readFileSync('./test/test.html').toString();
//  const page = createHtmlPageTranslator(html, conf);
//  const sorted = page.sortOutBySize('#main', 1000);
//  const components = sorted[3];
//
//  it('translate components by using API', () => {
//    createConnectionOption(conf)
//      .then((opts) => {
//        return page.translatePortion(components, 'ja', opts);
//      })
//      .then(() => {
//        components.forEach((x) => console.log(x.html()));
//      })
//      .catch((e) => console.log(e));
//  });
//});

const htmlWithoutText =
   `<div id="top">
      <div id="header"><p>HEADER</p></div>
      <div id="main"><p>MAIN</p></div>
      <div id="footer"><p>FOOTER</p></div>
  </div>`;

const htmlWithText =
   `<div id="top">
      <div id="header"><p>HEADER</p></div>
      <div id="main"><p>MAIN</p></div>
      Text1
      <div id="footer"><p>FOOTER</p></div>
  </div>`;

describe('page-translator#hasText', () => {
  context('when element has a direct text', () => {
    const page = createHtmlPageTranslator(htmlWithText, conf);
    const div = page.select('#top');

    it('returns true', () => {
      expect(page.hasText(div)).to.be.true;
    })
  });

  context('when element has no direect text', () => {
    const page = createHtmlPageTranslator(htmlWithoutText, conf);
    const div = page.select('#top');

    it('returns false', () => {
      expect(page.hasText(div)).to.be.false;
    })
  });
});

describe('page-translator#replaceTexts', () => {
  const page = createHtmlPageTranslator(html1, conf);
  const sorted = page.sortOutBySize('body', 15);
  const components = sorted[6];
  const translated = [
     { translatedText: 'XXXX' },
     { translatedText: 'YYYY' },
     { translatedText: 'ZZZZ' }
  ];

  before(() => {
    page.replaceTexts(components, translated);
  });

  it('replaces texts with translated ones', () => {
    const rslts = components.map((x) => x.html());
    expect(rslts).to.eql(['XXXX', 'YYYY', 'ZZZZ']);
  });
});

describe('page-translator#createPostData', () => {
  const sorted = page.sortOutBySize('body', 15);

  it('returns Google Cloud Translation API post data', () => {
    expect(page.createPostData(sorted[6], 'ja')).to.eql({
        source: 'en',
        target: 'ja',
        format: 'html',
        q: ['FFFFF', 'GGGGG', 'HHHHH']
      });
  });
});

describe('page-translator#extractTextForTranslation', () => {
  const sorted = page.sortOutBySize('body', 15);

  it('extract text for translation from components', () => {
    expect(page.extractTextForTranslation(sorted[0])).to.eql(['menu 1', 'menu 2']);
    expect(page.extractTextForTranslation(sorted[1])).to.eql(['menu 3', 'menu 4']);
    expect(page.extractTextForTranslation(sorted[2])).to.eql(['\n      ', 'AAAAA']);
    expect(page.extractTextForTranslation(sorted[3])).to.eql(['BBBBB', 'CCCCC']);
    expect(page.extractTextForTranslation(sorted[6])).to.eql(['FFFFF', 'GGGGG', 'HHHHH']);
  });
});

describe('page-translator#sortOutBySize', () => {
  context('when given 400 as limit size', () => {
    const sorted = page.sortOutBySize('body', 400);

    it('returns components sorted out by size', () => {
      expect(sorted.length).to.be.equal(3);
      expect(sorted[0].length).to.be.equal(2);
      expect(sorted[1].length).to.be.equal(2);
      expect(sorted[2].length).to.be.equal(3);
    });
  });

  context('when given 200 as limit size', () => {
    const sorted = page.sortOutBySize('body', 200);

    it('returns components sorted out by size', () => {
      expect(sorted.length).to.be.equal(6);
      expect(sorted[0].length).to.be.equal(2);
      expect(sorted[1].length).to.be.equal(1);
      expect(sorted[2].length).to.be.equal(1);
      expect(sorted[3].length).to.be.equal(1);
      expect(sorted[4].length).to.be.equal(1);
      expect(sorted[5].length).to.be.equal(2);
    });
  });

  context('when given 100 as limit size', () => {
    const sorted = page.sortOutBySize('body', 100);

    it('returns components sorted out by size', () => {
      expect(sorted.length).to.be.equal(6);
      expect(sorted[0].length).to.be.equal(5);
      expect(sorted[1].length).to.be.equal(1);
      expect(sorted[2].length).to.be.equal(5);
      expect(sorted[3].length).to.be.equal(1);
      expect(sorted[4].length).to.be.equal(1);
      expect(sorted[5].length).to.be.equal(2);
    });
  });

  context('when given 20 as limit size', () => {
    const sorted = page.sortOutBySize('body', 20);

    it('returns components sorted out by size', () => {
      expect(sorted.length).to.be.equal(9);
      expect(sorted[0].length).to.be.equal(3);
      expect(sorted[1].length).to.be.equal(3);
      expect(sorted[2].length).to.be.equal(2);
      expect(sorted[3].length).to.be.equal(1);
      expect(sorted[4].length).to.be.equal(1);
      expect(sorted[5].length).to.be.equal(3);
      expect(sorted[6].length).to.be.equal(1);
      expect(sorted[7].length).to.be.equal(1);
      expect(sorted[8].length).to.be.equal(2);
    });
  });

  context('when given 15 as limit size', () => {
    const sorted = page.sortOutBySize('body', 15);

    it('returns components sorted out by size', () => {
      expect(sorted.length).to.be.equal(10);
      expect(sorted[0].length).to.be.equal(2);
      expect(sorted[1].length).to.be.equal(2);
      expect(sorted[2].length).to.be.equal(2);
      expect(sorted[3].length).to.be.equal(2);
      expect(sorted[4].length).to.be.equal(1);
      expect(sorted[5].length).to.be.equal(1);
      expect(sorted[6].length).to.be.equal(3);
      expect(sorted[7].length).to.be.equal(1);
      expect(sorted[8].length).to.be.equal(1);
      expect(sorted[9].length).to.be.equal(2);
    });
  });
});

