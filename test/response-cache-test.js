
import { expect } from 'chai';

import createResponseCache from '../src/response-cache.js';

const conf = {
  "cacheEnabled": true,
  "cacheSkip": ["do-not-cache-if-url-contains"],
  "cacheTTL": [
    { "type": "text/html",       "ttl": 111 },
    { "type": "application/pdf", "ttl": 222 },
    { "type": "image",           "ttl": 333 },
    { "type": "default",         "ttl": 444 }
  ],
  "reidsPort": 6379,
};

describe('response-cache#getTtl', () => {
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
