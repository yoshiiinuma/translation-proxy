
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';

import { loadPage } from '../src/page-translator.js';
import { loadConfig } from '../src/conf.js';
import { createConnectionOption, callTranslateApi } from '../src/translate.js';
import Logger from '../src/logger.js';

const conf = loadConfig('./config/config.json');
const html1 = fs.readFileSync('./test/simple.html');
const page = loadPage(html1, conf);

Logger.initialize({
  "enableLog": true,
  "logLevel": "debug",
  "logDir": "./logs",
  "logFile": "test.log",
  "accessLogFile": "test-access.log",
});

//describe('page-translator#totalComponetSize', () => {
//  context('given spo-faqs.html', () => {
//    const html = fs.readFileSync('./test/spo-faqs.html');
//    const page = loadPage(html, conf);
//
//    it('show the total size of components extracted from spo-faqs.html', (done) => {
//      const sorted1 = page.sortOutBySize(['#header', '#main', '#footer'], 12000, 250);
//      const sorted2 = page.sortOutBySize(['#header', '#main', '#footer'], 12000, 300);
//      const sorted3 = page.sortOutBySize(['#header', '#main', '#footer'], 12000, 500);
//      const sorted4 = page.sortOutBySize(['#header', '#main', '#footer'],  8000, 250);
//      const sorted5 = page.sortOutBySize(['#header', '#main', '#footer'], 10000, 250);
//      const sorted6 = page.sortOutBySize(['#header', '#main', '#footer'], 14000, 250);
//      console.log('FAQ: 12000 250 => ' + page.totalComponentSize(sorted1));
//      console.log('FAQ: 12000 300 => ' + page.totalComponentSize(sorted1));
//      console.log('FAQ: 12000 500 => ' + page.totalComponentSize(sorted1));
//      console.log('FAQ:  8000 250 => ' + page.totalComponentSize(sorted4));
//      console.log('FAQ: 10000 250 => ' + page.totalComponentSize(sorted5));
//      console.log('FAQ: 14000 250 => ' + page.totalComponentSize(sorted6));
//      done();
//    });
//  });
//
//  context('given spo-news.html', () => {
//    const html = fs.readFileSync('./test/spo-news.html');
//    const page = loadPage(html, conf);
//
//    it('show the total size of components extracted from spo-news.html', (done) => {
//      const sorted1 = page.sortOutBySize(['#header', '#main', '#footer'], 12000, 250);
//      const sorted2 = page.sortOutBySize(['#header', '#main', '#footer'], 12000, 300);
//      const sorted3 = page.sortOutBySize(['#header', '#main', '#footer'], 12000, 500);
//      const sorted4 = page.sortOutBySize(['#header', '#main', '#footer'],  8000, 250);
//      const sorted5 = page.sortOutBySize(['#header', '#main', '#footer'], 10000, 250);
//      const sorted6 = page.sortOutBySize(['#header', '#main', '#footer'], 14000, 250);
//      console.log('NEWS: 12000 250 => ' + page.totalComponentSize(sorted1));
//      console.log('NEWS: 12000 300 => ' + page.totalComponentSize(sorted2));
//      console.log('NEWS: 12000 500 => ' + page.totalComponentSize(sorted3));
//      console.log('NEWS:  8000 250 => ' + page.totalComponentSize(sorted4));
//      console.log('NEWS: 10000 250 => ' + page.totalComponentSize(sorted5));
//      console.log('NEWS: 14000 250 => ' + page.totalComponentSize(sorted6));
//      done();
//    });
//  });
//});

//describe('page-translator#showDomTree', () => {
//  it('prints out dom tree structure', (done) => {
//    page.showDomTree('body');
//    done();
//  });
//});

describe('page-translator#translateAll', () => {
  context('given a large html', () => {
    const conf = {
      'maxPageSize': 500,
    };
    const page = loadPage(html1, conf);

    it('returns an error', (done) => {
      page.translateAll(['body'], 'ja', 400, 400, (err, rslt) => {
        expect(err).to.eql({ error: 'Too Large Page' });
        done();
      });
    });
  }); 

  //context('given a large html', () => {
  //  const conf2 = {
  //    'translationSelectors': ['#header', '#main', '#footer'],
  //    'maxPageSize': 50000,
  //    'maxTextPerRequest': 12000,
  //    'domBreakdownThreshold': 250,
  //  };
  //  const html2 = fs.readFileSync('./test/spo-faqs.html').toString();
  //  const page2 = loadPage(html2, conf2);

  //  it('returns an error', (done) => {
  //    page.translateAll(['#header', '#main', '#footer'], 'ja', 8000, 500, (err, rslt) => {
  //      expect(err).to.eql({ error: 'Too Large Page' });
  //      done();
  //    });
  //  });
  //}); 

  //context('given a html that is smaller than the maxPageSize limit', () => {
  //  const conf = {
  //    'proxiedHosts': ['your.domain.com'],
  //    'translationSelectors': ['#header', '#main', '#footer'],
  //    'maxPageSize': 80000,
  //    'maxTextPerRequest': 12000,
  //    'domBreakdownThreshold': 250,
  //  }
  //  //const html = fs.readFileSync('./test/test.html').toString();
  //  const html = fs.readFileSync('./test/spo-news.html').toString();
  //  const page = loadPage(html, conf);
  //  const sorted = page.sortOutBySize(['#header', '#main', '#footer'], 8000, 500);

  //  it('translate html page by using API', () => {
  //    page.showSorted(sorted);
  //    page.translateAll(['#header', '#main', '#footer'], 'ja', 8000, 500, (err, rslt) => {
  //      if (err) {
  //        console.log(err);
  //      } else {
  //        console.log(rslt);
  //      }
  //    });
  //  });
  //});
});

describe('page-translator#translatePortion', () => {
  const html = fs.readFileSync('./test/test.html').toString();
  const page = loadPage(html, conf);
  const sorted = page.sortOutBySize('#main', 1000, 300);
  const components = sorted[3];

  it('translate components by using API', () => {
    createConnectionOption(conf)
      .then((opts) => {
        return page.translatePortion(components, 'ja', opts);
      })
      .then(() => {
        components.forEach((x) => console.log(x.html()));
      })
      .catch((e) => console.log(e));
  });
});

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
    const page = loadPage(htmlWithText, conf);
    const div = page.select('#top');

    it('returns true', () => {
      expect(page.hasText(div)).to.be.true;
    })
  });

  context('when element has no direect text', () => {
    const page = loadPage(htmlWithoutText, conf);
    const div = page.select('#top');

    it('returns false', () => {
      expect(page.hasText(div)).to.be.false;
    })
  });
});

describe('page-translator#replaceTexts', () => {
  const page = loadPage(html1, conf);
  const sorted = page.sortOutBySize('body', 15, 15);
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
  const sorted = page.sortOutBySize('body', 15, 15);

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
  const sorted = page.sortOutBySize('body', 15, 15);

  it('extract text for translation from components', () => {
    expect(page.extractTextForTranslation(sorted[0])).to.eql(['menu 1', 'menu 2']);
    expect(page.extractTextForTranslation(sorted[1])).to.eql(['menu 3', 'menu 4']);
    expect(page.extractTextForTranslation(sorted[2])).to.eql(['\n      ', 'AAAAA']);
    expect(page.extractTextForTranslation(sorted[3])).to.eql(['BBBBB', 'CCCCC']);
    expect(page.extractTextForTranslation(sorted[6])).to.eql(['FFFFF', 'GGGGG', 'HHHHH']);
  });
});

describe('page-translator#totalComponentSize', () => {
  const sorted1 = page.sortOutBySize('body', 15, 15);
  const sorted2 = page.sortOutBySize('body', 100, 100);
  const sorted3 = page.sortOutBySize('body', 200, 200);
  const sorted4 = page.sortOutBySize('body', 400, 400);

  it('returns the total size of components retuned from soteOutBySize', () => {
    expect(page.totalComponentSize(sorted1)).to.be.equal(429);
    expect(page.totalComponentSize(sorted2)).to.be.equal(538);
    expect(page.totalComponentSize(sorted3)).to.be.equal(841);
    expect(page.totalComponentSize(sorted4)).to.be.equal(961);
  });
});

describe('page-translator#sortOutBySize', () => {
  context('when given 400 as limit size', () => {
    const sorted = page.sortOutBySize('body', 400, 400);

    it('returns components sorted out by size', () => {
      expect(sorted.length).to.be.equal(3);
      expect(sorted[0].length).to.be.equal(2);
      expect(sorted[1].length).to.be.equal(2);
      expect(sorted[2].length).to.be.equal(3);
    });
  });

  context('when given 200 as limit size', () => {
    const sorted = page.sortOutBySize('body', 200, 200);

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
    const sorted = page.sortOutBySize('body', 100, 100);

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
    const sorted = page.sortOutBySize('body', 20, 20);

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
    const sorted = page.sortOutBySize('body', 15, 15);

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

