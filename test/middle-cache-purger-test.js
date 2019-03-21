
import { expect } from 'chai';

import createResponseCache from '../src/response-cache.js';
import { setUpMiddleCachePurger } from '../src/middle-cache-purger.js';
import * as TestHelper from './helper.js';

TestHelper.enableTestLog();

const port = 8888;
const conf = {
  "db": 9,
  "cacheEnabled": true,
  "cacheSkip": ["do-not-cache-if-url-contains"],
  "proxiedHosts": {
    "localhost": true,
    "127.0.0.1": true,
    "spo.hawaii.gov": true
  },
  "targetHttpPort": port,
  "sslCert": "./certs/test.pem",
  "sslKey": "./certs/test.key",
  "reidsPort": 6379,
};

const ResponseCache = createResponseCache(conf);
const buffer = Buffer.from(TestHelper.doc);

const reqObj = {
  id: '    12345',
  href: 'http://localhost/path/to',
  protocol: 'http:',
  method: 'GET',
  host: 'localhost',
  port: port,
  path: '/path/to',
};
const reqObjHead = { ...reqObj, ...{ method: 'HEAD' } };
const reqObjPurge = { ...reqObj, ...{ method: 'PURGE' } };


const resObj = {
  statusCode: 200,
  statusMessage: 'OK',
  lang: null,
  href: 'http://localhost/path/to',
  encoding: null,
  headers: {
    'content-type': 'text/html',
    'content-length': buffer.length,
  }
};

describe('MiddleCachePurger', () => {
  context('when purgeAll gets requested and cache exists', () => {
    const reqObj1 = { ...reqObj, ...{ href: 'http://localhost/path/to/1', path: '/path/to/1' } };
    const reqObj2 = { ...reqObj, ...{ href: 'http://localhost/path/to/2', path: '/path/to/2' } };
    const reqObj3 = { ...reqObj, ...{ href: 'http://localhost/path/to/3', path: '/path/to/3' } };
    const resObj1 = { ...resObj, ...{ href: 'http://localhost/path/to/1' } };
    const resObj2 = { ...resObj, ...{ href: 'http://localhost/path/to/2' } };
    const resObj3 = { ...resObj, ...{ href: 'http://localhost/path/to/3' } };
    const reqObj = {
      id: '    55555',
      href: 'http://localhost/purge-proxy-cache?page=all',
      protocol: 'http:',
      method: 'PURGE',
      host: 'localhost',
      port: port,
      path: '/purge-proxy-cache?page=all',
    };
    const MiddleCachePurger = setUpMiddleCachePurger(ResponseCache);
    const req = new TestHelper.MockClientRequest(reqObj);
    const res = new TestHelper.MockResponse(reqObj);
    const next = TestHelper.createNextFunc();

    before((done) => {
      ResponseCache.save(reqObj1, null, resObj1, 'BODY 1')
        .then(ResponseCache.save(reqObj2, null, resObj2, 'BODY 2'))
        .then(ResponseCache.save(reqObj3, null, resObj3, 'BODY 3'))
        .then(done());
    });

    it('purges all the cache and returns 200', (done) => {
      res.on('end', async () => {
        let r;
        expect(next.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.data.toString()).to.be.equal('FLUSHALL request was successfully submitted');
        r = await ResponseCache.get(reqObj1, null);
        expect(r).to.be.null;
        r = await ResponseCache.get(reqObj2, null);
        expect(r).to.be.null;
        r = await ResponseCache.get(reqObj3, null);
        expect(r).to.be.null;
        done();
      });

      MiddleCachePurger(req, res, next.func);
    });
  });

  context('when purge gets requested and cache exists', () => {
    const MiddleCachePurger = setUpMiddleCachePurger(ResponseCache);
    const req = new TestHelper.MockClientRequest(reqObjPurge);
    const res = new TestHelper.MockResponse(reqObjPurge);
    const next = TestHelper.createNextFunc();

    before((done) => {
      ResponseCache.save(reqObj, null, resObj, buffer)
        .then(ResponseCache.save(reqObjHead, null, resObj, ''))
        .then(done());
    });

    it('deletes cache and returns 200', (done) => {
      res.on('end', async () => {
        expect(next.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.data.toString()).to.be.equal('PURGE request was successfully submitted');
        const cache1 = await ResponseCache.get(reqObj, null);
        expect(cache1).to.be.equal(null);
        const cache2 = await ResponseCache.get(reqObjHead, null);
        expect(cache2).to.be.equal(null);
        done();
      });

      MiddleCachePurger(req, res, next.func);
    });
  });

  context('when purge gets requested and cache does not exist', () => {
    const MiddleCachePurger = setUpMiddleCachePurger(ResponseCache);
    const req = new TestHelper.MockClientRequest(reqObjPurge);
    const res = new TestHelper.MockResponse(reqObjPurge);
    const next = TestHelper.createNextFunc();

    before((done) => {
      ResponseCache.del(reqObj, null)
        .then(ResponseCache.del(reqObjHead, null))
        .then(done());
    });

    it('deletes cache and returns 200', (done) => {
      res.on('end', async () => {
        expect(next.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.data.toString()).to.be.equal('PURGE request was successfully submitted');
        const cache = await ResponseCache.get(reqObj, null);
        expect(cache).to.be.equal(null);
        done();
      });

      MiddleCachePurger(req, res, next.func);
    });
  });

  context('when reqObj is not provided', () => {
    const MiddleCachePurger = setUpMiddleCachePurger(ResponseCache);
    const req = new TestHelper.MockClientRequest(reqObj);
    const res = new TestHelper.MockResponse();
    const next = TestHelper.createNextFunc();

    it('returns 500', (done) => {
      res.on('end', () => {
        expect(next.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(500);
        expect(res.statusMessage).to.be.equal('Internal Server Error');
        expect(res.data.toString()).to.be.equal('Error 500: Internal Server Error');
        done();
      });

      MiddleCachePurger(req, res, next.func);
    });
  });

  context('when purge dees not get requested', () => {
    const MiddleCachePurger = setUpMiddleCachePurger(ResponseCache);
    const req = new TestHelper.MockClientRequest(reqObj);
    const res = new TestHelper.MockResponse(reqObj);

    it('calls next', (done) => {
      MiddleCachePurger(req, res, () => {
        done();
      });
    });
  });
});

