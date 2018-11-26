
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';

import createHtmlPageTranslator from '../src/page-translator.js';


const html1 = fs.readFileSync('./test/simple.html');
const page = createHtmlPageTranslator(translator, html1);

const translator = () => {
};


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
    const page = createHtmlPageTranslator(translator, htmlWithText);
    const div = page.select('#top');

    it('returns true', () => {
      expect(page.hasText(div)).to.be.true;
    })
  });

  context('when element has no direect text', () => {
    const page = createHtmlPageTranslator(translator, htmlWithoutText);
    const div = page.select('#top');

    it('returns false', () => {
      expect(page.hasText(div)).to.be.false;
    })
  });
});

describe('page-translator#sortOutBySize', () => {
  it('returns array of components that have text', () => {
    let array = page.sortOutBySize('body', 70);
    page.showSorted(array);
  });
});

