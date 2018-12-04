
import { expect } from 'chai';

import createCache from '../src/cache.js';

describe('cache#getAsync', () => {
  const cache = createCache({ db: 9 });
  const key = 'TEST';
  const val = 'Testing cache now';


  context('without setting a value', () => {
    before((done) => {
      cache.delAsync(key)
        .then(() => done());
    });

    it('returns null', (done) => {
      cache.getAsync(key)
        .then((r) => {
          expect(r).to.be.null;
          done();
        })
        .catch((e) => console.log(e));
    });
  });

  context('after setting a value', () => {
    before((done) => {
      cache.setAsync(key, val)
        .then(() => done());
    });

    after((done) => {
      cache.delAsync(key)
        .then(() => done());
    });

    it('returns the value', (done) => {
      cache.getAsync(key)
        .then((r) => {
          expect(r).to.be.equal(val);
          done();
        })
        .catch((e) => console.log(e));
    });
  });

  context('using await', () => {
    //before(async (done) => {
    //  await cache.setAsync(key, val);
    //  done();
    //});

    //after(async (done) => {
    //  await cache.delAsync(key);
    //  done();
    //});

    before((done) => {
      cache.setAsync(key, val)
        .then(() => done());
    });

    after((done) => {
      cache.delAsync(key)
        .then(() => done());
    });

    it('returns the value', async function(done) {
      let r = await cache.getAsync(key)
      expect(r).to.be.equal(val);
      done();
    });
  });
});

describe('cache#get', () => {
  const cache = createCache({ db: 9 });
  const key = 'TEST';
  const val = 'Testing cache now';


  context('without setting a value', () => {
    before((done) => {
      cache.del(key, () => done());
    });

    it('returns null', (done) => {
      cache.get(key, (r) => {
        expect(r).to.be.null;
        done();
      });
    });
  });

  context('after setting a value', () => {
    before((done) => {
      cache.set(key, val, () => done());
    });

    after((done) => {
      cache.del(key, () => done());
    });

    it('returns the value', (done) => {
      cache.get(key, (r) => {
        expect(r).to.be.equal(val);
        done();
      });
    });
  });
});

