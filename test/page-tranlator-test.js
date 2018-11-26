
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';

import createHtmlPageTranslator from '../src/page-translator.js';
import { loadConfig } from '../src/conf.js';


const conf = loadConfig('./config/config.json');
//const conf = {};
const html1 = fs.readFileSync('./test/simple.html');
const page = createHtmlPageTranslator(html1, conf);

//const translator = () => {
//};


//describe('page-translator#showDomTree', () => {
//  it('prints out dom tree structure', (done) => {
//    page.showDomTree('body');
//    done();
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

describe('page-translator#extractTextForTranslation', () => {
  const sorted = page.sortOutBySize('body', 15);

  it('extract text for translation from components', () => {
  });
});
