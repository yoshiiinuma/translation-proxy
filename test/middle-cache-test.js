
import { expect } from 'chai';
import zlib from 'zlib';
import * as TestHelper from './helper.js';

import createResponseCache from '../src/response-cache.js';
import { setUpMiddleCache } from '../src/middle-cache.js';

const port = 7777;

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

const buffer = Buffer.from(TestHelper.doc);
const gzipped = zlib.gzipSync(TestHelper.doc);
const gzippedTranslatedDoc = zlib.gzipSync(TestHelper.translatedDoc);

const ResponseCache = createResponseCache(conf);

describe('MiddleCache', () => {
  context('reqObj is not provided', () => {
    const reqObj = {
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };

    it('returns 500', (done) => {
      const sendBuffer = TestHelper.createMockSendBuffer();
      const sendTranslation = TestHelper.createMockSendTranslation();
      const ResponseHandler = {
        sendBuffer: sendBuffer.func,
        sendTranslation: sendTranslation.func
      };
      const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);
      const req = new TestHelper.MockClientRequest(reqObj);
      const res = new TestHelper.MockResponse();
      const next = TestHelper.createNextFunc();
      res.on('end', () => {
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(next.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(500);
        expect(res.statusMessage).to.be.equal('Internal Server Error');
        expect(res.data.toString()).to.be.equal('Error 500: Internal Server Error');
        done();
      });
      MiddleCache(req, res, next.func);
    });
  });

  context('when translated cache exists and translation gets requested', () => {
    const reqObj = {
      id: '    12345',
      href: 'http://localhost/path/to?lang=ja',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
      lang: 'ja'
    };
    const resObj = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: 'ja',
      href: 'http://localhost/path/to?lang=ja',
      encoding: 'gzip',
      headers: {
        'content-type': 'text/html',
        'content-encoding': 'gzip',
        'content-length': gzippedTranslatedDoc.length,
      }
    };

    before((done) => {
      ResponseCache.saveSync(reqObj, 'ja', resObj, gzippedTranslatedDoc)
        .then(ResponseCache.delSync(reqObj, null))
        .then(done());
    });

    it('calls ResponseHandler.sendBuffer with the cache', (done) => {
      const next = TestHelper.createNextFunc();
      const sendBuffer = TestHelper.createMockSendBuffer();
      const sendTranslation = TestHelper.createMockSendTranslation();
      const ResponseHandler = {
        sendBuffer: sendBuffer.func,
        sendTranslation: sendTranslation.func
      };
      const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);
      const req = new TestHelper.MockClientRequest(reqObj);
      const res = new TestHelper.MockResponse(reqObj);
      res.on('end', () => {
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(true);
        expect(sendBuffer.res).to.eql(res);
        expect(sendBuffer.buffer).to.eql(gzippedTranslatedDoc);
        expect(sendBuffer.headers).to.eql(resObj);
        expect(sendBuffer.msg).to.eql('    12345 SERVER RESPONSE END: RETURNING CACHED TRANSLATED');
        done();
      });
      MiddleCache(req, res, next.func);
    });
  });

  context('when untranslated cache exists and translation gets requested', () => {
    const headers = {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': gzipped.length,
    };
    const reqObj = {
      id: '    12345',
      href: 'http://localhost/path/to?lang=ja',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
      lang: 'ja'
    };
    const resObj = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: null,
      href: 'http://localhost/path/to',
      encoding: 'gzip',
      headers
    };
    const expHeader = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: 'ja',
      href: 'http://localhost/path/to?lang=ja',
      encoding: 'gzip',
      headers
    };

    before((done) => {
      ResponseCache.saveSync(reqObj, null, resObj, gzipped)
        .then(ResponseCache.delSync(reqObj, 'ja'))
        .then(done());
    });

    it('calls ResponseHandler.sendTranslation with the cache', (done) => {
      const next = TestHelper.createNextFunc();
      const sendBuffer = TestHelper.createMockSendBuffer();
      const sendTranslation = TestHelper.createMockSendTranslation();
      const ResponseHandler = {
        sendBuffer: sendBuffer.func,
        sendTranslation: sendTranslation.func
      };
      const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);
      const req = new TestHelper.MockClientRequest(reqObj);
      const res = new TestHelper.MockResponse(reqObj);
      res.on('end', () => {
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(next.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(true);
        expect(sendTranslation.res).to.eql(res);
        expect(sendTranslation.buffer).to.eql(gzipped);
        expect(sendTranslation.reqObj).to.eql(reqObj);
        expect(sendTranslation.headers).to.eql(expHeader);
        expect(sendTranslation.msg).to.eql('    12345 SERVER RESPONSE ');
        done();
      });
      MiddleCache(req, res, next.func);
    });
  });

  context('when cache exists', () => {
    const reqObj = {
      id: '    12345',
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
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

    before((done) => {
      ResponseCache.saveSync(reqObj, null, resObj, buffer).then(done());
    });

    it('calls ResponseHandler.sendBuffer with the cache', (done) => {
      const next = TestHelper.createNextFunc();
      const sendBuffer = TestHelper.createMockSendBuffer();
      const sendTranslation = TestHelper.createMockSendTranslation();
      const ResponseHandler = {
        sendBuffer: sendBuffer.func,
        sendTranslation: sendTranslation.func
      };
      const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);
      const req = new TestHelper.MockClientRequest(reqObj);
      const res = new TestHelper.MockResponse(reqObj);
      res.on('end', () => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(true);
        expect(sendBuffer.res).to.eql(res);
        expect(sendBuffer.buffer.toString()).to.eql(buffer.toString());
        expect(sendBuffer.headers).to.eql(resObj);
        expect(sendBuffer.msg).to.be.equal('    12345 SERVER RESPONSE END: RETURNING CACHED ORIGINAL');
        done();
      });
      MiddleCache(req, res, next.func);
    });
  });

  context('when cache does not exist', () => {
    const reqObj = {
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };

    before((done) => {
      ResponseCache.delSync(reqObj, null).then(done());
    });

    it('calls next', (done) => {
      const sendBuffer = TestHelper.createMockSendBuffer();
      const sendTranslation = TestHelper.createMockSendTranslation();
      const ResponseHandler = {
        sendBuffer: sendBuffer.func,
        sendTranslation: sendTranslation.func
      };
      const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);
      const req = new TestHelper.MockClientRequest(reqObj);
      const res = new TestHelper.MockResponse(reqObj);
      const next = TestHelper.createNextFunc(() => {
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(next.isCalled).to.be.equal(true);
        done();
      });
      MiddleCache(req, res, next.func);
    });
  });
});
