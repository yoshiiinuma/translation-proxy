
import { expect } from 'chai';
import createCache from '../src/cache.js';

const expInSecs = 10;

describe('cache#flushallAsync', () => {
  const cache = createCache({ db: 9 });
  const key1 = 'TEST1';
  const key2 = 'TEST2';
  const key3 = 'TEST3';
  const val1 = 'Testing cache now 1';
  const val2 = 'Testing cache now 2';
  const val3 = 'Testing cache now 3';

  before(async () => {
    await cache.setAsync(key1, val1);
    await cache.setAsync(key2, val1);
    await cache.setAsync(key3, val1);
    await cache.flushallAsync();
  });

  it('purges all the cache', async () => {
    let r; 
    r = await cache.getAsync(key1);
    expect(r).to.be.null;
    r = await cache.getAsync(key2);
    expect(r).to.be.null;
    r = await cache.getAsync(key3);
    expect(r).to.be.null;
  });
});

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
      cache.setAsync(key, val, expInSecs)
        .then(() => done());
    });

    after((done) => {
      cache.delAsync(key)
        .then(() => done());
    });

    it('returns the value', (done) => {
      cache.getAsync(key)
        .then((r) => {
          expect(r.toString()).to.be.equal(val);
          done();
        })
        .catch((e) => console.log(e));
    });
  });

  context('using await', () => {
    before(async () => {
      await cache.delAsync(key);
    });

    it('returns null', async () => {
      let r = await cache.getAsync(key)
      expect(r).to.be.null;
    });
  });

  context('using await', () => {
    before(async () => {
      await cache.setAsync(key, val, expInSecs);
    });

    after(async () => {
      await cache.delAsync(key);
    });

    it('returns the value', async () => {
      let r = await cache.getAsync(key)
      expect(r.toString()).to.be.equal(val);
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
      cache.set(key, val, expInSecs, () => done());
    });

    after((done) => {
      cache.del(key, () => done());
    });

    it('returns the value', (done) => {
      cache.get(key, (r) => {
        expect(r.toString()).to.be.equal(val);
        done();
      });
    });
  });
});

