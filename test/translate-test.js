
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';

import { loadConfig } from '../src/conf.js';
import getTranslator from '../src/translate.js';

const conf = loadConfig('./config/config.json');
const translate = getTranslator(conf);

const html = fs.readFileSync('./test/test.html').toString();

describe('translate.js#translate', () => {
  it('tranlates a html file', (done) => {
    translate(html, 'ja', (err, translated) => {
      expect(err).to.equal(null);
      expect(translated).not.to.empty;
      done();
    })
  });
});

