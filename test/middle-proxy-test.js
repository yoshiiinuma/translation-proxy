
import { expect } from 'chai';

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

const conf = {
  "cacheEnabled": true,
  "cacheSkip": ["do-not-cache-if-url-contains"],
  "targetHttpPort": port,
  "reidsPort": 6379,
};

const Translator = TestHelper.translator;

const setUpAgentSelector = (resObj, data) => {
  return {
    select: (req) => {
      return TestHelper.createFakeAgent(resObj, data);
    }
  };
};

const ResponseCache = createResponseCache(conf);
//const ResponseHandler = setUpResponseHandler(Translator, ResponseCache);

describe('MiddleProxy', () => {
  context('when untranslated html page gets requested and the response is not gzipped', () => {
    const reqObj = {
      id: 2,
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
    const expected = {
      res: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: { 'content-type': 'text/html' }
      },
      body: TestHelper.doc
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
    const AgentSelector = setUpAgentSelector(proxyRes, TestHelper.doc);
    const MiddleProxy = setUpMiddleProxy(ResponseHandler, AgentSelector, ResponseCache);
    const res = new TestHelper.MockResponse();
    const req = new TestHelper.MockClientRequest(reqObj);
    const next = TestHelper.createNextFunc();

    it('returns the response received from a web server', (done) => {
      res.on('end', (chunk) => {
        expect(res.statusCode).to.be.equal(expected.res.statusCode);
        expect(res.statusMessage).to.be.equal(expected.res.statusMessage);
        expect(res.headers).to.eql(expected.res.headers);
        expect(res.data.toString()).to.be.equal(doc);
        const expected2 = { ...expected };
        expected2.res.headers['content-length'] = doc.length;
        checkCache(reqObj, null, expected2, done);
      });

      MiddleProxy(req, res, next);
    });
  });

});

