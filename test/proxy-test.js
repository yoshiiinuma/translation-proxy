
import http from 'http';
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';
import events from 'events';
import zlib from 'zlib';

//import express from 'express';
//import { Writable } from 'stream';
//import nock from 'nock';
//import httpMocks from 'node-mocks-http';

import { loadConfig } from '../src/conf.js';
import Logger from '../src/logger.js';
import createResponseCache from '../src/response-cache.js';
import { setUpProxy, clientError } from '../src/proxy.js';

const serverHttpPort  = 9996;
const serverHttpsPort = 9997;
const targetHttpPort  = 9998;
const targetHttpsPort = 9999;

const conf = {
  "cacheEnabled": true,
  "cacheSkip": ["do-not-cache-if-url-contains"],
  "proxiedHosts": {
    "localhost": true,
    "127.0.0.1": true,
    "spo.hawaii.gov": true
  },
  "serverHttpPort": serverHttpPort,
  "serverHttpsPort": serverHttpsPort,
  "targetHttpPort": targetHttpPort,
  "targetHttpsPort": targetHttpsPort,
  "sslCert": "./certs/test.pem",
  "sslKey": "./certs/test.key",
  "reidsPort": 6379,
};

Logger.initialize({
  "enableLog": true,
  "logLevel": "debug",
  "logDir": "./logs",
  "logFile": "test.log",
  "accessLogFile": "test-access.log",
});

const ResponseCache = createResponseCache(conf);

const doc = `
  <html>
    <head>
      <title>Test</title>
    </head>
    <body>
      <div>Hello, World!</div>
    </body>
  </html>
`;

const translatedDoc = `
  <html>
    <head>
      <title>Tanslated</title>
    </head>
    <body>
      <div>Konnichiwa, Sekai!</div>
    </body>
  </html>
`;

const translator = {
  translatePage: (html, lang, callback) => {
    //console.log('TRANSLATOR CALLED');
    callback(null, translatedDoc);
  }
};

class MockIncomingMessage extends events.EventEmitter {
  constructor(statusCode, statusMessage, headers) {
    super();
    this._statusCode = (statusCode) ? statusCode : 200;
    this._statusMessage = (statusMessage) ? statusMessage : 'OK';
    this._headers = (headers) ? headers : { 'content-type': 'text/html' };
  }

  get statusCode() { return this._statusCode }
  get statusMessage() { return this._statusMessage }
  get headers() { return this._headers }
};

const rgxUrl = /(https?):\/\/([^\/]+)(\/.+)?$/;

class MockClientRequest extends events.EventEmitter {
  //constructor(url, method, headers) {
  constructor(reqObj, headers) {
    super();

    const scheme = (reqObj && reqObj.protocol)? reqObj.protocol.slice(0, -1) : 'http';
    const encrypted = (scheme === 'http')? false : true;
    this._method = (reqObj && reqObj.method) ? reqObj.method : 'GET';
    this._headers = (headers) ? headers : {};
    this._connection = { encrypted };
    this._headers.host = (reqObj && reqObj.host) ? reqObj.host : null;
    if (reqObj && reqObj.path) {
      this._url = reqObj.path;
      if (reqObj.lang) this._url += '?lang=' + reqObj.lang;
    }
  }

  get url() { return this._url; }
  get connection() { return this._connection; }
  get method() { return this._method; }
  get headers() { return this._headers; }
};

class MockResponse extends events.EventEmitter {
  constructor(callback) {
    super();
    if (callback) this.callback = callback;
    this._data = [];
    this._statusCode = null;
    this._statusMessage = null;
    this._headers = {};
  }

  get statusCode() { return this._statusCode }
  get statusMessage() { return this._statusMessage }
  get headers() { return this._headers }
  get data() { return this._data }

  writeHead(statusCode, statusMessage, headers) {
    //console.log('MOCK RESPONSE WRITEHEAD CALLED');
    //console.log(headers);
    this._statusCode = statusCode;
    this._statusMessage = statusMessage;
    this._headers = headers;
  }

  write(chunk) {
    //console.log('MOCK RESPONSE WRITE CALLED');
    this._data.push(chunk);
    this.emit('data', chunk);
  }

  end(chunk) {
    //console.log('MOCK RESPONSE END CALLED');
    if (chunk) this._data.push(chunk);
    this.emit('end');
    if (this.callback) this.callback();
  }
};

/**
 * The returned function mocks node http/https.
 * The function returns the specified response to the given response.
 */
const createFakeAgent = (res, data) => {
  return {
    request: (opts, callback) => {
      //console.log('FAKE AGENT REQUEST CALLED');
      //console.log(opts);
      setTimeout(() => {
        //console.log('FAKE RESPONSE RETURNED');
        callback(res);
      }, 5);
      setTimeout(() => {
        //console.log('FAKE RESPONSE DATA STARTED');
        res.emit('data', data);
        res.emit('end');
      }, 10);
      return new MockClientRequest();
    }
  }
};

/**
 * The returned function mocks startProxy function.
 * The function returns the specified response to the given response.
 */
const createProxyFunc = (statusCode, statusMsg, headers, data) => {
  const r = { isCalled: false };

  r.func = (res, agent, reqObj) => {
    console.log('FAKE PROXY WAS CALLED');
    r.isCalled = true;

    setTimeout(() => {
      console.log('FAKE PROXY RESPONSE DATA STARTED');
      res.writeHead(statusCode, statusMsg, headers);
      res.write(data);
      res.end();
    }, 5);
    return new MockClientRequest(reqObj);
  };

  return r;
};

const checkCache = (reqObj, lang, expected, callback) => {
  setTimeout(() => {
    ResponseCache.get(reqObj, lang)
      .then((cache) => {
        //console.log('------------------------------------');
        //console.log(cache.res.headers);
        //console.log(expected.res.headers);
        //console.log('------------------------------------');
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


describe('proxy#serve', () => {
  //const url = 'http://localhost:' + port + '/path/to';
  const buffer = Buffer.from(doc);
  const gzipped = zlib.gzipSync(doc);
  const gzippedTranslatedDoc = zlib.gzipSync(translatedDoc);

  context('when translation requested and untranslated cache exists', () => {
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
      port: targetHttpPort,
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
    const res = new MockResponse();
    const req = new MockClientRequest(reqObj);
    const proxyFunc = createProxyFunc(200, 'OK', headers, buffer);
    const expected = {
      res: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {
          'content-type': 'text/html',
          'content-encoding': 'gzip',
          'content-length': gzippedTranslatedDoc.length,
          'set-cookie': [ 'SELECTEDLANG=ja' ]
        }
      },
      body: doc
    };

    before((done) => {
      ResponseCache.save(reqObj, null, resHeader, gzipped)
        .then(ResponseCache.del(reqObj, 'ja'))
        .then(done());
    });

    it('returns the translated html', (done) => {
      const proxy = setUpProxy(conf, translator, proxyFunc.func, () => {
        console.log('PROXY CALLBACK CALLED');
        expect(proxyFunc.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.headers).to.eql(expected.res.headers);
        expect(zlib.gunzipSync(Buffer.concat(res.data)).toString()).to.be.equal(translatedDoc);
        done();
      });
      proxy.serve(req, res);
    });
  });

  //context('when cache exists and it is gzipped', () => {
  //  const headers = {
  //    'content-type': 'text/html',
  //    'content-encoding': 'gzip',
  //    'content-length': gzipped.length,
  //  };
  //  const reqObj = {
  //    href: 'http://localhost/path/to',
  //    protocol: 'http:',
  //    method: 'GET',
  //    host: 'localhost',
  //    port: targetHttpPort,
  //    path: '/path/to',
  //  };
  //  const resHeader = {
  //    statusCode: 200,
  //    statusMessage: 'OK',
  //    lang: null,
  //    href: 'http://localhost/path/to',
  //    encoding: 'gzip',
  //    headers
  //  };
  //  const res = new MockResponse();
  //  const req = new MockClientRequest(reqObj);
  //  const proxyFunc = createProxyFunc(200, 'OK', headers, buffer);
  //  const expected = {
  //    res: {
  //      statusCode: 200,
  //      statusMessage: 'OK',
  //      headers
  //    },
  //    body: doc
  //  };

  //  before((done) => {
  //    ResponseCache.save(reqObj, null, resHeader, gzipped).then(done());
  //    //ResponseCache.del(reqObj, null).then(done());
  //  });

  //  it('returns the cached response', (done) => {
  //    const proxy = setUpProxy(conf, translator, proxyFunc.func, () => {
  //      console.log('PROXY CALLBACK CALLED');
  //      expect(proxyFunc.isCalled).to.be.equal(false);
  //      expect(res.statusCode).to.be.equal(200);
  //      expect(res.statusMessage).to.be.equal('OK');
  //      expect(res.headers).to.eql(headers);
  //      expect(zlib.gunzipSync(Buffer.concat(res.data)).toString()).to.be.equal(doc);
  //      done();
  //    });
  //    proxy.serve(req, res);
  //  });
  //});

  //context('when cache exists', () => {
  //  const headers = {
  //    'content-type': 'text/html',
  //    'content-length': buffer.length,
  //  };
  //  const reqObj = {
  //    href: 'http://localhost/path/to',
  //    protocol: 'http:',
  //    method: 'GET',
  //    host: 'localhost',
  //    port: targetHttpPort,
  //    path: '/path/to',
  //  };
  //  const resHeader = {
  //    statusCode: 200,
  //    statusMessage: 'OK',
  //    lang: null,
  //    href: 'http://localhost/path/to',
  //    encoding: null,
  //    headers
  //  };
  //  const res = new MockResponse();
  //  const req = new MockClientRequest(reqObj);
  //  const proxyFunc = createProxyFunc(200, 'OK', headers, buffer);

  //  before((done) => {
  //    ResponseCache.save(reqObj, null, resHeader, buffer).then(done());
  //    //ResponseCache.del(reqObj, null).then(done());
  //  });

  //  it('returns the cached response', (done) => {
  //    const proxy = setUpProxy(conf, translator, proxyFunc.func, () => {
  //      console.log('PROXY CALLBACK CALLED');
  //      expect(proxyFunc.isCalled).to.be.equal(false);
  //      expect(res.statusCode).to.be.equal(200);
  //      expect(res.statusMessage).to.be.equal('OK');
  //      expect(res.headers).to.eql(headers);
  //      expect(res.data.toString()).to.be.equal(doc);
  //      done();
  //    });
  //    proxy.serve(req, res);
  //  });
  //});

  //context('when cache does not exist', () => {
  //  const reqObj = {
  //    href: 'http://localhost/path/to',
  //    protocol: 'http:',
  //    method: 'GET',
  //    host: 'localhost',
  //    port: targetHttpPort,
  //    path: '/path/to',
  //  };
  //  const headers = { 'content-type': 'text/html' };
  //  const res = new MockResponse();
  //  const req = new MockClientRequest(reqObj);
  //  const proxyFunc = createProxyFunc(200, 'OK', headers, buffer);

  //  before((done) => {
  //    //ResponseCache.save(reqObj, null, resHeader, buffer).then(done());
  //    ResponseCache.del(reqObj, null).then(done());
  //  });

  //  after((done) => {
  //    ResponseCache.del(reqObj, null).then(done());
  //  });

  //  it('returns the response received from a web server', (done) => {
  //    const proxy = setUpProxy(conf, translator, proxyFunc.func, () => {
  //      expect(proxyFunc.isCalled).to.be.equal(true);
  //      expect(res.statusCode).to.be.equal(200);
  //      expect(res.statusMessage).to.be.equal('OK');
  //      expect(res.headers).to.eql(headers);
  //      expect(res.data.toString()).to.be.equal(doc);
  //      done();
  //    });
  //    proxy.serve(req, res);
  //  });
  //});
});

//describe('proxy#startProxyRequest', () => {
//  const proxy = setUpProxy(conf, translator);
//  const buffer = Buffer.from(doc);
//  const gzipped = zlib.gzipSync(doc);
//  const gzippedTranslatedDoc = zlib.gzipSync(translatedDoc);
//
//  context('given html response without lang param', () => {
//    const reqObj = {
//      id: 2,
//      href: 'http://localhost/path/to',
//      protocol: 'http:',
//      method: 'GET',
//      host: 'localhost',
//      port: targetHttpPort,
//      path: '/path/to',
//    };
//    const expected = {
//      res: {
//        statusCode: 200,
//        statusMessage: 'OK',
//        headers: { 'content-type': 'text/html' }
//      },
//      body: doc
//    };
//    const res = new MockResponse();
//    const proxyRes = new MockIncomingMessage();
//    const agent = createFakeAgent(proxyRes, buffer);
//
//    before((done) => {
//      ResponseCache.del(reqObj, null).then(done());
//    });
//
//    it('returns the response received from a web server', (done) => {
//      res.on('end', (chunk) => {
//        expect(res.statusCode).to.be.equal(expected.res.statusCode);
//        expect(res.statusMessage).to.be.equal(expected.res.statusMessage);
//        expect(res.headers).to.eql(expected.res.headers);
//        expect(res.data.toString()).to.be.equal(doc);
//        const expected2 = { ...expected };
//        expected2.res.headers['content-length'] = doc.length;
//        checkCache(reqObj, null, expected2, done);
//      });
//
//      proxy.startProxyRequest(res, agent, reqObj);
//    });
//  });
//
//  context('given html response with lang param', () => {
//    const reqObj = {
//      id: 3,
//      lang: 'ja',
//      href: 'http://localhost/path/to?lang=ja',
//      protocol: 'http:',
//      method: 'GET',
//      host: 'localhost',
//      port: targetHttpPort,
//      path: '/path/to?lang=ja',
//    };
//    const expected = {
//      res: {
//        statusCode: 200,
//        statusMessage: 'OK',
//        headers: {
//          'content-type': 'text/html',
//          'content-length': translatedDoc.length,
//          'access-control-allow-origin': 'localhost',
//          'set-cookie': [ 'SELECTEDLANG=ja' ]
//        }
//      },
//      body: translatedDoc
//    };
//    const res = new MockResponse();
//    const proxyRes = new MockIncomingMessage();
//    const agent = createFakeAgent(proxyRes, buffer);
//
//    before((done) => {
//      ResponseCache.del(reqObj, 'ja').then(done());
//    });
//
//    it('returns the response received from a web server', (done) => {
//      res.on('end', (chunk) => {
//        expect(res.statusCode).to.be.equal(expected.res.statusCode);
//        expect(res.statusMessage).to.be.equal(expected.res.statusMessage);
//        expect(res.headers).to.eql(expected.res.headers);
//        expect(res.data.toString()).to.be.equal(expected.body);
//        checkCache(reqObj, 'ja', expected, done);
//      });
//
//      proxy.startProxyRequest(res, agent, reqObj);
//    });
//  });
//
//  context('given gzipped html response without lang param', () => {
//    const reqObj = {
//      id: 4,
//      href: 'http://localhost/path/to',
//      protocol: 'http:',
//      method: 'GET',
//      host: 'localhost',
//      port: targetHttpPort,
//      path: '/path/to',
//    };
//    const expected = {
//      res: {
//        statusCode: 200,
//        statusMessage: 'OK',
//        headers: {
//          'content-type': 'text/html',
//          'content-encoding': 'gzip',
//        }
//      },
//      body: doc
//    };
//    const res = new MockResponse();
//    const proxyRes = new MockIncomingMessage(200, 'OK', {
//      'content-type': 'text/html',
//      'content-encoding': 'gzip',
//    });
//    const agent = createFakeAgent(proxyRes, gzipped);
//
//    before((done) => {
//      ResponseCache.del(reqObj, null).then(done());
//    });
//
//    it('returns the response received from a web server', (done) => {
//      res.on('end', (chunk) => {
//        expect(res.statusCode).to.be.equal(expected.res.statusCode);
//        expect(res.statusMessage).to.be.equal(expected.res.statusMessage);
//        expect(res.headers).to.eql(expected.res.headers);
//        expect(zlib.gunzipSync(Buffer.concat(res.data)).toString()).to.be.equal(doc);
//        const expected2 = { ...expected };
//        expected2.res.headers['content-length'] = gzipped.length;
//        checkCache(reqObj, null, expected2, done);
//      });
//
//      proxy.startProxyRequest(res, agent, reqObj);
//    });
//  });
//
//  context('given gzipped html response with lang param', () => {
//    const reqObj = {
//      id: 5,
//      lang: 'ja',
//      href: 'http://localhost/path/to?lang=ja',
//      protocol: 'http:',
//      method: 'GET',
//      host: 'localhost',
//      port: targetHttpPort,
//      path: '/path/to?lang=ja',
//    };
//    const expected = {
//      res: {
//        statusCode: 200,
//        statusMessage: 'OK',
//        headers: {
//          'content-type': 'text/html',
//          'content-encoding': 'gzip',
//          'content-length': gzippedTranslatedDoc.length,
//          'access-control-allow-origin': 'localhost',
//          'set-cookie': [ 'SELECTEDLANG=ja' ]
//        }
//      },
//      body: translatedDoc
//    };
//    const res = new MockResponse();
//    const proxyRes = new MockIncomingMessage(200, 'OK', {
//      'content-type': 'text/html',
//      'content-encoding': 'gzip',
//    });
//    const agent = createFakeAgent(proxyRes, gzipped);
//
//    before((done) => {
//      ResponseCache.del(reqObj, 'ja').then(done());
//    });
//
//    it('returns the response received from a web server', (done) => {
//      res.on('end', (chunk) => {
//        expect(res.statusCode).to.be.equal(expected.res.statusCode);
//        expect(res.statusMessage).to.be.equal(expected.res.statusMessage);
//        expect(res.headers).to.eql(expected.res.headers);
//        expect(zlib.gunzipSync(Buffer.concat(res.data)).toString()).to.be.equal(translatedDoc);
//        checkCache(reqObj, 'ja', expected, done);
//      });
//
//      proxy.startProxyRequest(res, agent, reqObj);
//    });
//  });
//});

