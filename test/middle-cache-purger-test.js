
import { expect } from 'chai';

import * as TestHelper from './helper.js';
import createResponseCache from '../src/response-cache.js';
import { setUpMiddleCachePurger } from '../src/middle-cache-purger.js';

const port = 8888;
const conf = {
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
        expect(res.data.toString()).to.be.equal('Cache was successfully deleted');
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
        expect(res.data.toString()).to.be.equal('Cache was successfully deleted');
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

