
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

const createNextFunc = () => {
  const r = { isCalled: false };

  r.next = () => {
    if (debug) console.log('NEXT WAS CALLED');
    r.isCalled = true;
  };

  return r;
};

const buffer = Buffer.from(TestHelper.doc);
const gzipped = zlib.gzipSync(TestHelper.doc);
const gzippedTranslatedDoc = zlib.gzipSync(TestHelper.translatedDoc);

const ResponseCache = createResponseCache(conf);

const ResponseHandler = setUpResponseHandler(TestHelper.translator);
const MiddleCache = setUpMiddleCache(ResponseHandler, ResponseCache);

describe('MiddleCache', () => {
  context('when translated cache exists and translation gets requested', () => {
    const headers = {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': gzippedTranslatedDoc.length,
    };
    const reqObj = {
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
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);

    before((done) => {
      ResponseCache.save(reqObj, 'ja', resHeader, gzippedTranslatedDoc)
        .then(ResponseCache.del(reqObj, null))
        .then(done());
    });

    it('calls ResponseHandler.sendBuffer', (done) => {
    });
  });

  context('when untranslated cache exists and translation gets requested', () => {
    const headers = {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': gzipped.length,
    };
    const reqObj = {
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
      lang: null,
      href: 'http://localhost/path/to',
      encoding: 'gzip',
      headers
    };
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);
    const expectedHeaders = {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': gzippedTranslatedDoc.length,
      'set-cookie': [ 'SELECTEDLANG=ja' ]
    };

    before((done) => {
      ResponseCache.save(reqObj, null, resHeader, gzipped)
        .then(ResponseCache.del(reqObj, 'ja'))
        .then(done());
    });

    it('calls ResponseHandler.sendTranslation', (done) => {
    });
  });

  context('when cache exists', () => {
    const headers = {
      'content-type': 'text/html',
      'content-length': buffer.length,
    };
    const reqObj = {
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
    const res = new TestHelper.MockResponse();
    const req = new TestHelper.MockClientRequest(reqObj);

    before((done) => {
      ResponseCache.save(reqObj, null, resHeader, buffer).then(done());
    });

    it('calls ResponseHandler.sendBuffer', (done) => {
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
    const res = new TestHelper.MockResponse();
    const req = new TestHelper.MockClientRequest(reqObj);

    before((done) => {
      ResponseCache.del(reqObj, null).then(done());
    });

    it('calls next', (done) => {
    });
  });
});
