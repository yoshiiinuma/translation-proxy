
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';

import createHtmlPageTranslator from '../src/page-translator.js';


const html1 = fs.readFileSync('./test/simple.html');

const translator = () => {
};


describe('page-translator#showDomTree', () => {
  const page = createHtmlPageTranslator(translator, html1);

  it('prints out dom tree structure', (done) => {
    page.showDomTree('body');
    done();
  });
});
