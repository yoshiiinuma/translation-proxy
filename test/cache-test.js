
import { expect } from 'chai';

import createCache from '../src/cache.js';

describe('cache##get', () => {
  const cache = createCache({ db: 9 });
  const key = 'TEST';
  const val = 'Testing cache now';


  context('without setting value', () => {
    before((done) => {
      cache.del(key, () => done());
    });

    it('returnss a value', (done) => {
      cache.get(key, (r) => {
        expect(r).to.be.null;
        done();
      });
    });
  });

  context('after setting value', () => {
    before((done) => {
      cache.set(key, val, () => done());
    });

    after((done) => {
      cache.del(key, () => done());
    });

    it('sets and gets a value', (done) => {
      cache.get(key, (r) => {
        expect(r).to.be.equal(val);
        done();
      });
    });
  });
});

