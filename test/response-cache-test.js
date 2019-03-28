
import { expect } from 'chai';

import createResponseCache from '../src/response-cache.js';
import * as TestHelper from './helper.js';

TestHelper.enableTestLog();

const conf = {
  "db": 9,
  "cacheEnabled": true,
  "cacheSkipUrls": ["not-cache"],
  "cacheSkipCookies": ["not-cache"],
  "cacheShortTTL": 10,
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

describe('ResponseCache#validate', () => {
  const ResponseCache = createResponseCache(conf);

  context('when the request has If-None-Match header', () => {
    const reqObj = { headers: { 'if-none-match': 'abcdefghi' } };

    context('and cached Etag matches it', () => {
      const resObj = {
        headers: {
          date: 'Tue, 05 Feb 2019 23:57:34 GMT',
          'last-modified': 'Wed, 25 Jul 2018 01:08:54 GMT',
          etag: 'abcdefghi',
          expires: 'Thu, 31 Dec 2037 23:55:55 GMT'
        }
      };

      it('returns true', () => {
        expect(ResponseCache.validate(reqObj, resObj)).to.be.equal(true);
      });
    });

    context('and cached Etag does not match it', () => {
      const resObj = {
        headers: {
          date: 'Tue, 05 Feb 2019 23:57:34 GMT',
          'last-modified': 'Wed, 25 Jul 2018 01:08:54 GMT',
          etag: 'xxxxxxx',
          expires: 'Thu, 31 Dec 2037 23:55:55 GMT'
        }
      };

      it('returns false', () => {
        expect(ResponseCache.validate(reqObj, resObj)).to.be.equal(false);
      });
    });

    context('and cached Etag does not exist', () => {
      const resObj = {
        headers: {
          date: 'Tue, 05 Feb 2019 23:57:34 GMT',
          'last-modified': 'Wed, 25 Jul 2018 01:08:54 GMT',
          expires: 'Thu, 31 Dec 2037 23:55:55 GMT'
        }
      };

      it('returns false', () => {
        expect(ResponseCache.validate(reqObj, resObj)).to.be.equal(false);
      });
    });
  });

  context('when the request has If-Modified-Since header', () => {
    const reqObj = { headers: { 'if-modified-since': 'Wed, 25 Jul 2018 01:08:54 GMT' } };

    context('and cached Last-Modified matches it', () => {
      const resObj = {
        headers: {
          date: 'Tue, 05 Feb 2019 23:57:34 GMT',
          'last-modified': 'Wed, 25 Jul 2018 01:08:54 GMT',
          expires: 'Thu, 31 Dec 2037 23:55:55 GMT'
        }
      };

      it('returns true', () => {
        expect(ResponseCache.validate(reqObj, resObj)).to.be.equal(true);
      });
    });

    context('and cached Last-Modified does not match it', () => {
      const resObj = {
        headers: {
          date: 'Tue, 05 Feb 2019 23:57:34 GMT',
          'last-modified': 'Tue, 25 Feb 2019 01:08:54 GMT',
          expires: 'Thu, 31 Dec 2037 23:55:55 GMT'
        }
      };

      it('returns false', () => {
        expect(ResponseCache.validate(reqObj, resObj)).to.be.equal(false);
      });
    });

    context('and cached Last-Modified does not exist', () => {
      const resObj = {
        headers: {
          date: 'Tue, 05 Feb 2019 23:57:34 GMT',
          expires: 'Thu, 31 Dec 2037 23:55:55 GMT'
        }
      };

      it('returns false', () => {
        expect(ResponseCache.validate(reqObj, resObj)).to.be.equal(false);
      });
    });
  });
});

describe('ResponseCache#isCacheable', () => {
  const ResponseCache = createResponseCache(conf);

  context('when the request method is GET', () => {
    const reqObj = { method: 'GET' };

    context('and the status code is 200', () => {
      const resObj = { statusCode: 200 };

      it('returns true', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(true);
      });
    });

    context('and the status code is 404', () => {
      const resObj = { statusCode: 404 };

      it('returns true', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(true);
      });
    });

    context('and the status code is 304', () => {
      const resObj = { statusCode: 304 };

      it('returns false', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(false);
      });
    });

    context('and the status code is 400', () => {
      const resObj = { statusCode: 400 };

      it('returns false', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(false);
      });
    });

    context('and the status code is 401', () => {
      const resObj = { statusCode: 401 };

      it('returns false', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(false);
      });
    });

    context('and the status code is 403', () => {
      const resObj = { statusCode: 403 };

      it('returns false', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(false);
      });
    });
  });

  context('when the request method is HEAD', () => {
    const reqObj = { method: 'HEAD' };

    context('and the status code is 200', () => {
      const resObj = { statusCode: 200 };

      it('returns true', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(true);
      });
    });

    context('and the status code is 404', () => {
      const resObj = { statusCode: 404 };

      it('returns true', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(true);
      });
    });

    context('and the status code is 304', () => {
      const resObj = { statusCode: 304 };

      it('returns false', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(false);
      });
    });

    context('and the status code is 401', () => {
      const resObj = { statusCode: 401 };

      it('returns false', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(false);
      });
    });

    context('and the status code is 403', () => {
      const resObj = { statusCode: 403 };

      it('returns false', () => {
        expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(false);
      });
    });
  });

  context('when the request method is POST', () => {
    const reqObj = { method: 'POST' };
    const resObj = { statusCode: 200 };

    it('returns false', () => {
      expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(false);
    });
  });

  context('when the request method is PURGE', () => {
    const reqObj = { method: 'PURGE' };
    const resObj = { statusCode: 200 };

    it('returns false', () => {
      expect(ResponseCache.isCacheable(reqObj, resObj)).to.be.equal(false);
    });
  });
});

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

describe('ResponseCache#flushall', () => {
  const reqObj = {
    href: 'http://localhost/purge-cache?page=all',
    protocol: 'http:',
    method: 'GET',
    host: 'localhost',
    port: 7777,
    path: '/purge-cache?page=all',
  };
  const reqObj1 = {
    href: 'http://localhost/path/to/1',
    protocol: 'http:',
    method: 'GET',
    host: 'localhost',
    port: 7777,
    path: '/path/to/1',
  };
  const reqObj2 = {
    href: 'http://localhost/path/to/2',
    protocol: 'http:',
    method: 'GET',
    host: 'localhost',
    port: 7777,
    path: '/path/to/2',
  };
  const reqObj3 = {
    href: 'http://localhost/path/to/3',
    protocol: 'http:',
    method: 'GET',
    host: 'localhost',
    port: 7777,
    path: '/path/to/3',
  };
  const resObj1 = {
    statusCode: 200,
    statusMessage: 'OK',
    lang: null,
    href: 'http://localhost/path/to/1',
    encoding: 'gzip',
    headers: {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': body.length,
    }
  };
  const resObj2 = {
    statusCode: 200,
    statusMessage: 'OK',
    lang: null,
    href: 'http://localhost/path/to/2',
    encoding: 'gzip',
    headers: {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': body.length,
    }
  };
  const resObj3 = {
    statusCode: 200,
    statusMessage: 'OK',
    lang: null,
    href: 'http://localhost/path/to/3',
    encoding: 'gzip',
    headers: {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': body.length,
    }
  };
  const ResponseCache = createResponseCache(conf);

  before((done) => {
    ResponseCache.saveSync(reqObj1, null, resObj1, 'BODY 1')
      .then(ResponseCache.saveSync(reqObj2, null, resObj2, 'BODY 2'))
      .then(ResponseCache.saveSync(reqObj3, null, resObj3, 'BODY 3'))
      .then(done());
  });

  it('flash all the cache and return true', async () => {
    let r;
    r = await ResponseCache.purgeAll(reqObj);
    expect(r).to.be.equal(true);
    r = await ResponseCache.get(reqObj1, null);
    expect(r).to.be.null;
    r = await ResponseCache.get(reqObj2, null);
    expect(r).to.be.null;
    r = await ResponseCache.get(reqObj3, null);
    expect(r).to.be.null;
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
      ResponseCache.delSync(reqObj, null).then(done());
    });

    it('does not cache the response and returns false', (done) => {
      let r = ResponseCache.save(reqObj, null, resObj, body)
      expect(r).to.be.equal(false);
      TestHelper.wait(10);
      ResponseCache.get(reqObj, null)
        .then((cache) => {
          expect(cache).to.be.equal(null);
          done();
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
      ResponseCache.delSync(reqObj, null).then(done());
    });

    it('does not cache the response and returns false', (done) => {
      let r = ResponseCache.save(reqObj, null, resObj, body)
      expect(r).to.be.equal(false);
      TestHelper.wait(10);
      ResponseCache.get(reqObj, null)
        .then((cache) => {
          expect(cache).to.be.equal(null);
          done();
        });
    });
  });

  context('when the response code is 304', () => {
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
    const resObj = {
      statusCode: 304,
      statusMessage: 'Not Modified',
      lang: null,
      href: 'http://localhost/path/to',
      encoding: 'gzip',
      headers: {
        'content-type': 'text/html',
        'content-encoding': 'gzip',
        'content-length': body.length,
      }
    };
    const ResponseCache = createResponseCache(conf);


    before((done) => {
      ResponseCache.delSync(reqObj, null).then(done());
    });

    it('does not cache the response and returns false', (done) => {
      let r = ResponseCache.save(reqObj, null, resObj, body)
      expect(r).to.be.equal(false);
      ResponseCache.get(reqObj, null)
        .then((cache) => {
          expect(cache).to.be.equal(null);
          done();
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
      ResponseCache.delSync(reqObj, null).then(done());
    });

    it('caches the response and returns true', (done) => {
      let r = ResponseCache.save(reqObj, null, resObj, body)
      expect(r).to.be.equal(true);
      TestHelper.wait(10);
      ResponseCache.get(reqObj, null)
        .then((cache) => {
          expect(cache.res).to.eql(resObj);
          expect(cache.buffer.toString()).to.eql(body);
          done();
        });
    });
  });
});

describe('ResponseCache#getTtl', () => {
  context('given cacheTTL parameter through config', () => {
    const ResponseCache = createResponseCache(conf);

    context('when spcific content type gets requested', () => {
      it('returns configured ttl for each specified type', () => {
        expect(ResponseCache.getTtl({headers: {'content-type': 'text/html; charset=utf-8'}})).to.be.equal(111);
        expect(ResponseCache.getTtl({headers: {'content-type': 'text/plain; charset=utf-8'}})).to.be.equal(444);
        expect(ResponseCache.getTtl({headers: {'content-type': 'image/jpeg'}})).to.be.equal(333);
        expect(ResponseCache.getTtl({headers: {'content-type': 'application/pdf'}})).to.be.equal(222);
        expect(ResponseCache.getTtl({headers: {'content-type': 'application/octet-stream'}})).to.be.equal(444);
        expect(ResponseCache.getTtl({headers: {'content-type': 'xxxxx/xxxxxx'}})).to.be.equal(444);
      });
    });

    context('when a spcific response code gets returned', () => {
      it('returns configured short term ttl', () => {
        expect(ResponseCache.getTtl({ statusCode: 200, headers: {'content-type': 'image/jpeg'}})).to.be.equal(333);
        expect(ResponseCache.getTtl({ statusCode: 302, headers: {'content-type': 'image/jpeg'}})).to.be.equal(10);
        expect(ResponseCache.getTtl({ statusCode: 307, headers: {'content-type': 'image/jpeg'}})).to.be.equal(10);
        expect(ResponseCache.getTtl({ statusCode: 500, headers: {'content-type': 'image/jpeg'}})).to.be.equal(10);
        expect(ResponseCache.getTtl({ statusCode: 503, headers: {'content-type': 'image/jpeg'}})).to.be.equal(10);
      });
    });
  });

  context('not given cacheTTL parameter', () => {
    const ResponseCache = createResponseCache({});

    context('when spcific content type gets requested', () => {
      it('returns default ttl', () => {
        expect(ResponseCache.getTtl({headers: {'content-type':'text/html; charset=utf-8'}})).to.be.equal(300);
        expect(ResponseCache.getTtl({headers: {'content-type':'text/plain; charset=utf-8'}})).to.be.equal(300);
        expect(ResponseCache.getTtl({headers: {'content-type':'image/jpeg'}})).to.be.equal(300);
        expect(ResponseCache.getTtl({headers: {'content-type':'application/pdf'}})).to.be.equal(300);
        expect(ResponseCache.getTtl({headers: {'content-type':'application/octet-stream'}})).to.be.equal(300);
        expect(ResponseCache.getTtl({headers: {'content-type':'xxxxx/xxxxxx'}})).to.be.equal(300);
      });
    });

    context('when a spcific response code gets returned', () => {
      it('returns default ttl', () => {
        expect(ResponseCache.getTtl({ statusCode: 200, headers: {'content-type': 'image/jpeg'}})).to.be.equal(300);
        expect(ResponseCache.getTtl({ statusCode: 302, headers: {'content-type': 'image/jpeg'}})).to.be.equal(60);
        expect(ResponseCache.getTtl({ statusCode: 307, headers: {'content-type': 'image/jpeg'}})).to.be.equal(60);
        expect(ResponseCache.getTtl({ statusCode: 500, headers: {'content-type': 'image/jpeg'}})).to.be.equal(60);
        expect(ResponseCache.getTtl({ statusCode: 503, headers: {'content-type': 'image/jpeg'}})).to.be.equal(60);
      });
    });
  });
});
