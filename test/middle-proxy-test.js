
import { expect } from 'chai';
import zlib from 'zlib';

import * as TestHelper from './helper.js';
import Logger from '../src/logger.js';
import createResponseCache from '../src/response-cache.js';
import { setUpResponseHandler } from '../src/response-handler.js';
import { setUpMiddleProxy } from '../src/middle-proxy.js';

Logger.initialize({
  "enableLog": true,
  "logLevel": "debug",
  "logDir": "./logs",
  "logFile": "test.log",
  "accessLogFile": "test-access.log",
});

const port = 8888;

const doc = TestHelper.doc;
const translatedDoc = TestHelper.translatedDoc;
const buffer = Buffer.from(doc);
const gzipped = zlib.gzipSync(doc);
const gzippedTranslatedDoc = zlib.gzipSync(translatedDoc);

const conf = {
  "cacheEnabled": true,
  "cacheSkip": ["do-not-cache-if-url-contains"],
  "targetHttpPort": port,
  "reidsPort": 6379,
};

const Translator = TestHelper.translator;
//const ResponseHandler = setUpResponseHandler(Translator, ResponseCache);
const ResponseCache = createResponseCache(conf);

const setUpAgentSelector = (resObj, data, reqObj) => {
  return {
    select: (req) => {
      return TestHelper.createFakeAgent(resObj, data, reqObj);
    }
  };
};

const setUpCallbackAgentSelector = (resObj, data, callback) => {
  return {
    select: (req) => {
      return TestHelper.createCallbackFakeAgent(resObj, data, callback);
    }
  };
};

const setUpResponseErrorAgentSelector = (resObj, data) => {
  return {
    select: (req) => {
      return TestHelper.createFakeAgentEmitResponseError(resObj, data);
    }
  };
};

const setUpRequestErrorAgentSelector = (resObj, data) => {
  return {
    select: (req) => {
      return TestHelper.createFakeAgentEmitRequestError(resObj, data);
    }
  };
};

const checkCache = (reqObj, lang, expected, callback) => {
  setTimeout(() => {
    ResponseCache.get(reqObj, lang)
      .then((cache) => {
        expect(cache.res.statusCode).to.be.equal(expected.res.statusCode);
        expect(cache.res.statusMessage).to.be.equal(expected.res.statusMessage);
        expect(cache.res.headers).to.eql(expected.res.headers);
        let buffer = cache.buffer;
        if (cache.res.headers['content-encoding'] && cache.res.headers['content-encoding'] === 'gzip') {
          buffer = zlib.gunzipSync(cache.buffer);
        }
        expect(buffer.toString()).to.be.equal(expected.body);
      })
      .then(callback());
  }, 5);
};

describe('MiddleProxy', () => {
  context('when a ClientRequest has a problem', () => {
    const reqObj = {
      id: 7777,
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
    const expectedHeaders = { 'content-type': 'text/plain' };
    const sendBuffer = TestHelper.createMockSendBuffer();
    const sendTranslation = TestHelper.createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const proxyRes = new TestHelper.MockIncomingMessage(200, 'OK', {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'transfer-encoding': 'chunked',
    });
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);
    const next = TestHelper.createNextFunc();

    it('returns 500', (done) => {
      const AgentSelector = setUpCallbackAgentSelector(proxyRes, gzipped, () => {
        req.emit('error', 'CLIENTREQUEST ERROR TEST');
      });
      const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);
      res.on('end', (chunk) => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(500);
        expect(res.statusMessage).to.be.equal('Internal Server Error');
        expect(res.headers).to.eql(expectedHeaders);
        expect(res.data.toString()).to.be.equal('Error 500: Internal Server Error');
        done();
      });

      MiddleProxy(req, res, next);
    });
  });

  context('when a ServerResponse has a problem', () => {
    const reqObj = {
      id: 6666,
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
    const expectedHeaders = { 'content-type': 'text/plain' };
    const sendBuffer = TestHelper.createMockSendBuffer();
    const sendTranslation = TestHelper.createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const proxyRes = new TestHelper.MockIncomingMessage(200, 'OK', {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'transfer-encoding': 'chunked',
    });
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);
    const next = TestHelper.createNextFunc();

    it('returns 500', (done) => {
      const AgentSelector = setUpCallbackAgentSelector(proxyRes, gzipped, () => {
        res.emit('error', 'SERVERRESPONSE ERROR TEST');
      });
      const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);
      res.on('end', (chunk) => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(500);
        expect(res.statusMessage).to.be.equal('Internal Server Error');
        expect(res.headers).to.eql(expectedHeaders);
        expect(res.data.toString()).to.be.equal('Error 500: Internal Server Error');
        done();
      });

      MiddleProxy(req, res, next);
    });
  });

  context('when a request to a web server has a problem', () => {
    const reqObj = {
      id: 8888,
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
    const expectedHeaders = { 'content-type': 'text/plain' };
    const sendBuffer = TestHelper.createMockSendBuffer();
    const sendTranslation = TestHelper.createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const proxyRes = new TestHelper.MockIncomingMessage(200, 'OK', {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'transfer-encoding': 'chunked',
    });
    const AgentSelector = setUpRequestErrorAgentSelector(proxyRes, gzipped);
    const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);
    const next = TestHelper.createNextFunc();

    it('returns 500', (done) => {
      res.on('end', (chunk) => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(500);
        expect(res.statusMessage).to.be.equal('Internal Server Error');
        expect(res.headers).to.eql(expectedHeaders);
        expect(res.data.toString()).to.be.equal('Error 500: Internal Server Error');
        done();
      });

      MiddleProxy(req, res, next);
    });
  });

  context('when a response from a web server has a problem', () => {
    const reqObj = {
      id: 5555,
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
    const expectedHeaders = { 'content-type': 'text/plain' };
    const sendBuffer = TestHelper.createMockSendBuffer();
    const sendTranslation = TestHelper.createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const proxyRes = new TestHelper.MockIncomingMessage(200, 'OK', {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'transfer-encoding': 'chunked',
    });
    const AgentSelector = setUpResponseErrorAgentSelector(proxyRes, gzipped);
    const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);
    const next = TestHelper.createNextFunc();

    it('returns 503', (done) => {
      res.on('end', (chunk) => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(503);
        expect(res.statusMessage).to.be.equal('Service Unavailable');
        expect(res.headers).to.eql(expectedHeaders);
        expect(res.data.toString()).to.be.equal('Error 503: Service Unavailable');
        done();
      });

      MiddleProxy(req, res, next);
    });
  });

  context('when translated html page gets requested and the response is gzipped', () => {
    const reqObj = {
      id: 4444,
      href: 'http://localhost/path/to?lang=ja',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to?lang=ja',
      lang: 'ja'
    };
    const expHeaders = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: 'ja',
      encoding: 'gzip',
      href: 'http://localhost/path/to?lang=ja',
      headers: {
        'content-type': 'text/html',
        'content-encoding': 'gzip',
        'content-length': gzipped.length,
        'access-control-allow-origin': 'localhost',
      }
    };
    const expected = {
      res: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {
          'content-type': 'text/html',
          'content-encoding': 'gzip',
          'content-length': gzipped.length,
          'access-control-allow-origin': 'localhost',
        }
      },
      body: doc
    };
    const sendBuffer = TestHelper.createMockSendBuffer();
    const sendTranslation = TestHelper.createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const proxyRes = new TestHelper.MockIncomingMessage(200, 'OK', {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
      'transfer-encoding': 'chunked',
    });
    const AgentSelector = setUpAgentSelector(proxyRes, gzipped, reqObj);
    const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);
    const next = TestHelper.createNextFunc();

    before((done) => {
      ResponseCache.del(reqObj, null).then(done());
    });

    it('calles sendTranslation and caches the response received from a web server', (done) => {
      res.on('end', (chunk) => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(true);
        expect(sendTranslation.res).to.eql(res);
        expect(sendTranslation.buffer).to.eql(gzipped);
        expect(sendTranslation.reqObj).to.eql(reqObj);
        expect(sendTranslation.headers).to.eql(expHeaders);
        expect(sendTranslation.msg).to.eql('4444 PROXY RESPONSE ');
        checkCache(reqObj, null, expected, done);
      });

      MiddleProxy(req, res, next);
    });
  });

  context('when translated html page gets requested and the response is not gzipped', () => {
    const reqObj = {
      id: 3333,
      href: 'http://localhost/path/to?lang=ja',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to?lang=ja',
      lang: 'ja'
    };
    const expHeaders = {
      statusCode: 200,
      statusMessage: 'OK',
      lang: 'ja',
      href: 'http://localhost/path/to?lang=ja',
      encoding: undefined,
      headers: {
        'content-type': 'text/html',
        'access-control-allow-origin': 'localhost',
        'content-length': doc.length,
      }
    };
    const expected = {
      res: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {
          'content-type': 'text/html',
          'content-length': doc.length,
          'access-control-allow-origin': 'localhost',
        }
      },
      body: doc
    };
    const sendBuffer = TestHelper.createMockSendBuffer();
    const sendTranslation = TestHelper.createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const proxyRes = new TestHelper.MockIncomingMessage(200, 'OK', {
      'content-type': 'text/html',
      'transfer-encoding': 'chunked',
    });
    const AgentSelector = setUpAgentSelector(proxyRes, buffer, reqObj);
    const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);
    const next = TestHelper.createNextFunc();

    before((done) => {
      ResponseCache.del(reqObj, null).then(done());
    });

    it('calles sendTranslation and caches the response received from a web server', (done) => {
      res.on('end', (chunk) => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(true);
        expect(sendTranslation.res).to.eql(res);
        expect(sendTranslation.buffer).to.eql(buffer);
        expect(sendTranslation.reqObj).to.eql(reqObj);
        expect(sendTranslation.headers).to.eql(expHeaders);
        expect(sendTranslation.msg).to.eql('3333 PROXY RESPONSE ');
        checkCache(reqObj, null, expected, done);
      });

      MiddleProxy(req, res, next);
    });
  });

  context('when untranslated html page gets requested and the response is gzipped', () => {
    const reqObj = {
      id: 2222,
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
    const expHeaders = {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
    };
    const expected = {
      res: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: { 
          'content-type': 'text/html',
          'content-encoding': 'gzip',
          'content-length': gzipped.length
        }
      },
      body: doc
    };
    const sendBuffer = TestHelper.createMockSendBuffer();
    const sendTranslation = TestHelper.createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const proxyRes = new TestHelper.MockIncomingMessage(200, 'OK', {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
    });
    const AgentSelector = setUpAgentSelector(proxyRes, gzipped);
    const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);
    const next = TestHelper.createNextFunc();

    before((done) => {
      ResponseCache.del(reqObj, null).then(done());
    });

    it('returns the response received from a web server and caches it', (done) => {
      res.on('end', (chunk) => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.headers).to.eql(expHeaders);
        expect(zlib.gunzipSync(Buffer.concat(res.data)).toString()).to.be.equal(doc);
        checkCache(reqObj, null, expected, done);
      });

      MiddleProxy(req, res, next);
    });
  });

  context('when untranslated html page gets requested and the response is not gzipped', () => {
    const reqObj = {
      id: 1111,
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
    const expHeaders = {
      'content-type': 'text/html'
    };
    const expected = {
      res: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: { 'content-type': 'text/html', 'content-length': doc.length }
      },
      body: doc
    };
    const sendBuffer = TestHelper.createMockSendBuffer();
    const sendTranslation = TestHelper.createMockSendTranslation();
    const ResponseHandler = {
      sendBuffer: sendBuffer.func,
      sendTranslation: sendTranslation.func
    };
    const proxyRes = new TestHelper.MockIncomingMessage(200, 'OK', {
      'content-type': 'text/html',
    });
    const AgentSelector = setUpAgentSelector(proxyRes, buffer);
    const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);
    const res = new TestHelper.MockResponse(reqObj);
    const req = new TestHelper.MockClientRequest(reqObj);
    const next = TestHelper.createNextFunc();

    before((done) => {
      ResponseCache.del(reqObj, null).then(done());
    });

    it('returns the response received from a web server and caches it', (done) => {
      res.on('end', (chunk) => {
        expect(next.isCalled).to.be.equal(false);
        expect(sendBuffer.isCalled).to.be.equal(false);
        expect(sendTranslation.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.headers).to.eql(expHeaders);
        expect(res.data.toString()).to.be.equal(doc);
        checkCache(reqObj, null, expected, done);
      });

      MiddleProxy(req, res, next);
    });
  });

});

