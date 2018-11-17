
import fs from 'fs';
import util from 'util';
import cheerio from 'cheerio';
import { expect } from 'chai';

import { loadConfig } from '../src/conf.js';
import getTranslator from '../src/translate.js';
import { createPostData, replaceTexts } from '../src/translate.js';

const conf = {
  "translationSelectors": ["#header", "#main", "#footer"],
};
const html = fs.readFileSync('./test/test.html').toString();

const lang = 'ja';
const doc = `<!DOCTYPE html>
  <html>
    <head></head>
    <body>
      <div>
        <div id="header"><p>HEADER</p></div>
      </div>
      <div>
        <div id="main"><p>MAIN</p></div>
      </div>
      <div>
        <div id="footer"><p>FOOTER</p></div>
      </div>
    </body>
  </html>`;

const replaced = `<!DOCTYPE html>
  <html>
    <head></head>
    <body>
      <div>
        <div id="header"><p>XXXX</p></div>
      </div>
      <div>
        <div id="main"><p>YYYY</p></div>
      </div>
      <div>
        <div id="footer"><p>ZZZZ</p></div>
      </div>
    </body>
  </html>`;

/*
describe('translate.js#translate', () => {
  const confJson = loadConfig('./config/config.json');
  const translate = getTranslator(confJson);

  it('tranlates a html file', (done) => {
    translate(html, 'ja', (err, translated) => {
      expect(err).to.equal(null);
      expect(translated).not.to.empty;
      done();
    })
  });
});
*/

describe('translate.js#createPostData', () => {
  it('create post data', (done) => {
    createPostData(doc, lang, conf)
      .then((data) => {
        expect(data).to.eql({
          source: 'en',
          target: lang,
          format: 'html',
          q: [
            '<p>HEADER</p>',
            '<p>MAIN</p>',
            '<p>FOOTER</p>'
          ]
        });
        done();
      })
      .catch((e) => {
        console.log(e)
        done();
      });
  });
});

describe('translate.js#replaceTexts', () => {
  const translated = ['<p>XXXX</p>', '<p>YYYY</p>', '<p>ZZZZ</p>'];
  const expected = cheerio.load(replaced).html();

  it('replaces texts with translated ones', (done) => {
    replaceTexts(doc, translated, conf)
      .then((r) => {
        expect(r).to.eql(expected);
        done();
      })
      .catch((e) => {
        console.log(e)
        done();
      });
  });
});
