
import { expect } from 'chai';
import zlib from 'zlib';
import * as TestHelper from './helper.js';

import createResponseCache from '../src/response-cache.js';
import { setUpResponseHandler } from '../src/response-handler.js';
import { setUpMiddleCache } from '../src/middle-cache.js';

const port = 7777;
//
//const conf = {
//  targetHttpPort: 8888,
//  targetHttpsPort: 9999
//}

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

const createMockSendBuffer = () => {
  const r = { isCalled: false };

  r.func = (res, buffer, headers, msg) => {
    r.isCalled = true;
    r.res = res;
    r.buffer = buffer;
    r.headers = headers;
    r.msg = msg;
    res.end();
  };

  return r;
};

const createMockSendTranslation = () => {
  const r = { isCalled: false };

  r.func = (res, buffer, reqObj, headers, msg) => {
    r.isCalled = true;
    r.res = res;
    r.buffer = buffer;
    r.reqObj = reqObj;
    r.headers = headers;
    r.msg = msg;
    res.end();
  };

  return r;
};

const createNextFunc = (callback) => {
  const r = { isCalled: false };

  r.func = () => {
    r.isCalled = true;
    callback();
  };

  return r;
};

const buffer = Buffer.from(TestHelper.doc);
const gzipped = zlib.gzipSync(TestHelper.doc);
const gzippedTranslatedDoc = zlib.gzipSync(TestHelper.translatedDoc);

const ResponseCache = createResponseCache(conf);


describe('MiddleCache', () => {
  context('when translated cache exists and translation gets requested', () => {
    const headers = {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': gzippedTranslatedDoc.length,
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
    const resHeader = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: 'ja',
      href: 'http://localhost/path/to',
      encoding: 'gzip',
      headers
    };
    const sendBuffer = createMockSendBuffer();
    const sendTranslation = createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);

    before((done) => {
      ResponseCache.save(reqObj, 'ja', resHeader, gzippedTranslatedDoc)
        .then(ResponseCache.del(reqObj, null))
        .then(done());
    });

    it('calls ResponseHandler.sendBuffer', (done) => {
      const next = createNextFunc();
      const req = new TestHelper.MockClientRequest(reqObj);
      const res = new TestHelper.MockResponse(reqObj, () => {
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(true);
        expect(sendBuffer.res).to.eql(res);
        expect(sendBuffer.buffer).to.eql(gzippedTranslatedDoc);
        expect(sendBuffer.headers).to.eql(resHeader);
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
    const resHeader = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: 'ja',
      href: 'http://localhost/path/to?lang=ja',
      encoding: 'gzip',
      headers
    };
    const sendBuffer = createMockSendBuffer();
    const sendTranslation = createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);

    before((done) => {
      ResponseCache.save(reqObj, null, resHeader, gzipped)
        .then(ResponseCache.del(reqObj, 'ja'))
        .then(done());
    });

    it('calls ResponseHandler.sendTranslation', (done) => {
      const next = createNextFunc();
      const req = new TestHelper.MockClientRequest(reqObj);
      const res = new TestHelper.MockResponse(reqObj, () => {
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(next.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(true);
        expect(sendTranslation.res).to.eql(res);
        expect(sendTranslation.buffer).to.eql(gzipped);
        expect(sendTranslation.reqObj).to.eql(reqObj);
        expect(sendTranslation.headers).to.eql(resHeader);
        expect(sendTranslation.msg).to.eql('    12345 SERVER RESPONSE ');
        done();
      });
      MiddleCache(req, res, next.func);
    });
  });

  context('when cache exists', () => {
    const headers = {
      'content-type': 'text/html',
      'content-length': buffer.length,
    };
    const reqObj = {
      id: '    12345',
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
    const resHeader = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: null,
      href: 'http://localhost/path/to',
      encoding: null,
      headers
    };
    const sendBuffer = createMockSendBuffer();
    const sendTranslation = createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);

    before((done) => {
      ResponseCache.save(reqObj, null, resHeader, buffer).then(done());
    });

    it('calls ResponseHandler.sendBuffer', (done) => {
      const next = createNextFunc();
      const req = new TestHelper.MockClientRequest(reqObj);
      const res = new TestHelper.MockResponse(reqObj, () => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(true);
        expect(sendBuffer.res).to.eql(res);
        expect(sendBuffer.buffer.toString()).to.eql(buffer.toString());
        expect(sendBuffer.headers).to.eql(resHeader);
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
    const headers = { 'content-type': 'text/html' };
    const sendBuffer = createMockSendBuffer();
    const sendTranslation = createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);

    before((done) => {
      ResponseCache.del(reqObj, null).then(done());
    });

    it('calls next', (done) => {
      const req = new TestHelper.MockClientRequest(reqObj);
      const res = new TestHelper.MockResponse(reqObj);
      const next = createNextFunc(() => {
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(next.isCalled).to.be.equal(true);
        done();
      });
      MiddleCache(req, res, next.func);
    });
  });
});
