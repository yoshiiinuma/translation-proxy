
import { expect } from 'chai';

import createResponseCache from '../src/response-cache.js';

const conf = {
  "cacheEnabled": true,
  "cacheSkipUrls": ["not-cache"],
  "cacheSkipCookies": ["not-cache"],
  "cacheTTL": [
    { "type": "text/html",       "ttl": 111 },
    { "type": "application/pdf", "ttl": 222 },
    { "type": "image",           "ttl": 333 },
    { "type": "default",         "ttl": 444 }
  ],
  "reidsPort": 6379,
};

const body = 'This is the body.';
const resObj = {
  statusCode: 200,
  statusMessage: 'OK',
  lang: null,
  href: 'http://localhost/path/to',
  encoding: 'gzip',
  headers: {
    'content-type': 'text/html',
    'content-encoding': 'gzip',
    'content-length': body.length,
  }
};

describe('ResponseCache#shouldSkip', () => {
  context('when the requested URL includes a keyword defined in conf.cacheSkipUrls', () => {
    const reqObj = {
      href: 'http://localhost/path/to/not-cache',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: 7777,
      path: '/path/to',
    };
    const ResponseCache = createResponseCache(conf);

    it('returns true', () => {
      expect(ResponseCache.shouldSkip(reqObj)).to.be.equal(true);
    });
  });

  context('when the cookie in the request includes ay keyword defined in conf.cacheSkipCookies', () => {
    const reqObj = {
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: 7777,
      path: '/path/to',
      headers: {
        cookie: 'xxxx not-cache xxxxx xxxxx'
      }
    };
    const ResponseCache = createResponseCache(conf);

    it('returns true', () => {
      expect(ResponseCache.shouldSkip(reqObj)).to.be.equal(true);
    });
  });

  context('when the request dose not include any keyword defined in both conf.cacheUrls and conf.cacheSkipCookies', () => {
    const reqObj = {
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: 7777,
      path: '/path/to',
      headers: {
        cookie: ''
      }
    };
    const ResponseCache = createResponseCache(conf);

    it('returns false', () => {
      expect(ResponseCache.shouldSkip(reqObj)).to.be.equal(false);
    });
  });
});

describe('ResponseCache#save', () => {
  context('when the requested URL includes a keyword defined in conf.cacheSkipUrls', () => {
    const reqObj = {
      href: 'http://localhost/path/to/not-cache',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: 7777,
      path: '/path/to',
    };
    const ResponseCache = createResponseCache(conf);

    before((done) => {
      ResponseCache.del(reqObj, null).then(done());
    });

    it('does not cache the response and returns false', (done) => {
      ResponseCache.save(reqObj, null, resObj, body)
        .then((r) => {
          expect(r).to.be.equal(false);
          ResponseCache.get(reqObj, null)
            .then((cache) => {
              expect(cache).to.be.equal(null);
              done();
            });
        });
    });
  });

  context('when the cookie in the request includes ay keyword defined in conf.cacheSkipCookies', () => {
    const reqObj = {
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: 7777,
      path: '/path/to',
      headers: {
        cookie: 'xxxx not-cache xxxxx xxxxx'
      }
    };
    const ResponseCache = createResponseCache(conf);

    before((done) => {
      ResponseCache.del(reqObj, null).then(done());
    });

    it('does not cache the response and returns false', (done) => {
      ResponseCache.save(reqObj, null, resObj, body)
        .then((r) => {
          expect(r).to.be.equal(false);
          ResponseCache.get(reqObj, null)
            .then((cache) => {
              expect(cache).to.be.equal(null);
              done();
            });
        });
    });
  });

  context('when the request dose not include any keyword defined in both conf.cacheUrls and conf.cacheSkipCookies', () => {
    const reqObj = {
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: 7777,
      path: '/path/to',
      headers: {
        cookie: ''
      }
    };
    const ResponseCache = createResponseCache(conf);

    before((done) => {
      ResponseCache.del(reqObj, null).then(done());
    });

    it('caches the response and returns true', (done) => {
      ResponseCache.save(reqObj, null, resObj, body)
        .then((r) => {
          expect(r).to.be.equal(true);
          ResponseCache.get(reqObj, null)
            .then((cache) => {
              expect(cache.res).to.eql(resObj);
              expect(cache.buffer.toString()).to.eql(body);
              done();
            });
        });
    });
  });
});

describe('ResponseCache#getTtl', () => {
  context('given cacheTTL parameter through config', () => {
    const ResponseCache = createResponseCache(conf);

    it('returns configured ttl for each specified type', () => {
      expect(ResponseCache.getTtl('text/html; charset=utf-8')).to.be.equal(111);
      expect(ResponseCache.getTtl('text/plain; charset=utf-8')).to.be.equal(444);
      expect(ResponseCache.getTtl('image/jpeg')).to.be.equal(333);
      expect(ResponseCache.getTtl('application/pdf')).to.be.equal(222);
      expect(ResponseCache.getTtl('application/octet-stream')).to.be.equal(444);
      expect(ResponseCache.getTtl('xxxxx/xxxxxx')).to.be.equal(444);
    });
  });

  context('not given cacheTTL parameter', () => {
    const ResponseCache = createResponseCache({});

    it('returns default ttl', () => {
      expect(ResponseCache.getTtl('text/html; charset=utf-8')).to.be.equal(300);
      expect(ResponseCache.getTtl('text/plain; charset=utf-8')).to.be.equal(300);
      expect(ResponseCache.getTtl('image/jpeg')).to.be.equal(300);
      expect(ResponseCache.getTtl('application/pdf')).to.be.equal(300);
      expect(ResponseCache.getTtl('application/octet-stream')).to.be.equal(300);
      expect(ResponseCache.getTtl('xxxxx/xxxxxx')).to.be.equal(300);
    });
  });
});
