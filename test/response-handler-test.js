
import { expect } from 'chai';
import zlib from 'zlib';
import * as TestHelper from './helper.js';
import createResponseCache from '../src/response-cache.js';
import { setUpResponseHandler, TranslationNotAvailable } from '../src/response-handler.js';

const conf = {
  "cacheEnabled": true,
  "cacheSkip": ["do-not-cache-if-url-contains"],
  "reidsPort": 6379,
};

const buffer = Buffer.from(TestHelper.doc);
const translatedBuffer = Buffer.from(TestHelper.translatedDoc);
const gzipped = zlib.gzipSync(TestHelper.doc);
const gzippedTranslatedDoc = zlib.gzipSync(TestHelper.translatedDoc);

const ResponseCache = createResponseCache(conf);
const ResponseHandler = setUpResponseHandler(TestHelper.translator, ResponseCache);

describe('ResponseHandler.sendNotModified', () => {
  const  headers = {
    'content-type': 'text/html',
    'content-length': buffer.length,
  };
  const reqObj = {
    href: 'http://localhost/path/to',
    protocol: 'http:',
    method: 'GET',
    host: 'localhost',
    port: 8888,
    path: '/path/to',
  };
  const resObj = {
    statusCode: 200,
    statusMessage: 'OK',
    lang: null,
    href: 'http://localhost/path/to',
    encoding: null,
    headers
  };
  const req = new TestHelper.MockClientRequest(reqObj);
  const res = new TestHelper.MockResponse();

  it('returns given headers and body', (done) => {
    res.on('end', () => {
      expect(res.statusCode).to.be.equal(304);
      expect(res.statusMessage).to.be.equal('Not Modified');
      expect(res.headers).to.eql(headers);
      expect(res.data.toString()).to.be.equal('');
      done();
    });

    ResponseHandler.sendNotModified(res, resObj, 'TESTLOG');
  });
});

describe('ResponseHandler.sendBuffer', () => {
  const  headers = {
    'content-type': 'text/html',
    'content-length': buffer.length,
  };
  const reqObj = {
    href: 'http://localhost/path/to',
    protocol: 'http:',
    method: 'GET',
    host: 'localhost',
    port: 8888,
    path: '/path/to',
  };
  const resObj = {
    statusCode: 200,
    statusMessage: 'OK',
    lang: null,
    href: 'http://localhost/path/to',
    encoding: null,
    headers
  };
  const req = new TestHelper.MockClientRequest(reqObj);
  const res = new TestHelper.MockResponse();

  it('returns given headers and body', (done) => {
    res.on('end', () => {
      expect(res.statusCode).to.be.equal(200);
      expect(res.statusMessage).to.be.equal('OK');
      expect(res.headers).to.eql(headers);
      expect(res.data.toString()).to.be.equal(TestHelper.doc);
      done();
    });

    ResponseHandler.sendBuffer(res, buffer, resObj, 'TESTLOG');
  });
});

describe('ResponseHandler.sendTranslation', () => {
  const reqObj = {
    href: 'http://localhost/path/to?lang=ja',
    protocol: 'http:',
    method: 'GET',
    host: 'localhost',
    port: 8888,
    path: '/path/to',
    lang: 'ja'
  };

  context('when translation API returns an error', () => {
    const headers = {
      'content-type': 'text/html',
      'content-length': buffer.length + TranslationNotAvailable.length,
    };
    const expHeaders = {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': gzippedTranslatedDoc.length,
    };
    const resObj = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: 'ja',
      href: 'http://localhost/path/to?lang=ja',
      headers
    };
    const req = new TestHelper.MockClientRequest(reqObj);
    const res = new TestHelper.MockResponse();
    const ResponseHandler = setUpResponseHandler(TestHelper.errTranslator, ResponseCache);

    it('returns the error injected page', (done) => {
      res.on('end', () => {
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.headers).to.eql(headers);
        expect(res.data.toString()).to.be.include('Translation service is currently not available');
        done();
      });

      ResponseHandler.sendTranslation(res, gzipped, reqObj, resObj, 'TESTLOG');
    });
  });

  context('when the requested page is gzipped', () => {
    const headers = {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': gzipped.length,
    };
    const expHeaders = {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'content-length': gzippedTranslatedDoc.length,
      'set-cookie': [ 'SELECTEDLANG=ja' ]
    };
    const resObj = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: 'ja',
      href: 'http://localhost/path/to?lang=ja',
      encoding: 'gzip',
      headers
    };
    const req = new TestHelper.MockClientRequest(reqObj);
    const res = new TestHelper.MockResponse();

    it('returns the gzipped translated page', (done) => {
      res.on('end', () => {
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.headers).to.eql(expHeaders);
        expect(zlib.gunzipSync(Buffer.concat(res.data)).toString()).to.be.equal(TestHelper.translatedDoc);
        done();
      });

      ResponseHandler.sendTranslation(res, gzipped, reqObj, resObj, 'TESTLOG');
    });
  });

  context('when the requested page is plain html', () => {
    const headers = {
      'content-type': 'text/html',
      'content-length': buffer.length,
    };
    const expHeaders = {
      'content-type': 'text/html',
      'content-length': translatedBuffer.length,
      'set-cookie': [ 'SELECTEDLANG=ja' ]
    };
    const resObj = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: 'ja',
      href: 'http://localhost/path/to?lang=ja',
      headers
    };
    const req = new TestHelper.MockClientRequest(reqObj);
    const res = new TestHelper.MockResponse();

    it('returns the plain translated page', (done) => {
      res.on('end', () => {
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.headers).to.eql(expHeaders);
        expect(res.data.toString()).to.be.equal(TestHelper.translatedDoc);
        done();
      });

      ResponseHandler.sendTranslation(res, buffer, reqObj, resObj, 'TESTLOG');
    });
  });
});

