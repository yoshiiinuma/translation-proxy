
import http from 'http';
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';
import events from 'events';

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

let conf = loadConfig('./config/config.json', {
  "cacheEnabled": true,
  "cacheSkip": ["do-not-cache-if-url-contains"],
  "proxiedHosts": {
    "localhost": true,
    "127.0.0.1": true,
    "spo.hawaii.gov": true
  },
  "translationSelectors": ["#header", "#main", "#footer"],
  "maxTextPerRequest": 12000,
  "domBreakdownThreshold": 250,
  "keyPath": "/path/to/key.json",
  "gcloudPath": "/path/to/google-cloud-sdk/bin/gcloud",
  "serverHttpPort": serverHttpPort,
  "serverHttpsPort": serverHttpsPort,
  "targetHttpPort": targetHttpPort,
  "targetHttpsPort": targetHttpsPort,
  "sslCert": "./certs/test.pem",
  "sslKey": "./certs/test.key",
  "reidsPort": 6379,
  "enableLog": true,
  "logLevel": "debug",
  "logDir": "./logs"
});

//const conf = {
//  "cacheEnabled": true,
//  "cacheSkip": ["do-not-cache-if-url-contains"],
//  "proxiedHosts": ["loccalhost"],
//  "translationSelectors": ["#header", "#main", "#footer"],
//  "maxTextPerRequest": 12000,
//  "domBreakdownThreshold": 250,
//  "keyPath": "/path/to/key.json",
//  "gcloudPath": "/path/to/google-cloud-sdk/bin/gcloud",
//  "serverHttpPort": serverHttpPort,
//  "serverHttpsPort": serverHttpsPort,
//  "targetHttpPort": targetHttpPort,
//  "targetHttpsPort": targetHttpsPort,
//  "sslCert": "./certs/test.pem",
//  "sslKey": "./certs/test.key",
//  "reidsPort": 6379,
//  "enableLog": true,
//  "logLevel": "debug",
//  "logDir": "./logs"
//};
//Logger.initialize(conf);

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

const resHeader = {
  statusCode: 200,
  statusMessage: 'OK',
  lang: null,
  href: 'http://localhost/path/to',
  encoding: 'gzip',
  headers: {
    'content-encoding': 'gzip',
    'content-type': 'text/thml'
  }
};
const reqObj1 = {
  id: 1,
  href: 'http://localhost/path/to',
  protocol: 'http:',
  method: 'GET',
  //host: 'localhost',
  hostname: 'localhost',
  port: serverHttpPort,
  path: '/path/to',
};

const reqObj2 = {
  id: 2,
  href: 'http://localhost/path/to',
  protocol: 'http:',
  method: 'GET',
  host: 'localhost',
  //port: serverHttpPort,
  port: targetHttpPort,
  path: '/path/to',
};

const reqObj3 = {
  id: 3,
  href: 'http://localhost',
  protocol: 'http:',
  method: 'GET',
  //host: 'localhost',
  hostname: 'localhost',
  port: serverHttpPort,
  path: '/',
};

const translator = {
  translatePage: (html, lang, callback) => {
    console.log('TRANSLATOR CALLED');
    callback(null, translatedDoc);
  }
};

const proxyFunc = (res, agent, reqObj) => {
  console.log('FAKE PROXY WAS CALLED');
  res.writeHead(200, 'OK', {
    //'content-encoding': 'gzip',
    'content-length': buffer.length,
    'content-type': 'text/thml'
  });
  //res.end(buffer);
  res.write(doc);
  res.end();
  res.emit('end');
  res.emit('finish');
  return httpMocks.createRequest({
      method: 'GET',
      url: 'http://localhost:9998/path/to',
      headers: {
        host: 'localhost:9998',
      },
      connection: { encrypted: false }
    });
};

class MockIncomingMessage extends events.EventEmitter {
  constructor(statusCode, statusMessage, headers) {
    super();
    this._statusCode = (statusCode) ? statusCode : 200;
    this._statusMessage = (statusMessage) ? statusMessage : 'OK';
    this._headers = (headers) ? headers : { 'content-type': 'text/html' };
    //this.statusCode = 200;
    //this.statusMessage = 'OK';
    //this.headers = {
    //  'content-type': 'text/html'
    //}
  }

  get statusCode() { return this._statusCode }
  get statusMessage() { return this._statusMessage }
  get headers() { return this._headers }
};

class MockClientRequest extends events.EventEmitter {
  constructor() {
    super();
  }
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
    console.log('MOCK RESPONSE WRITEHEAD CALLED');
    console.log(headers);
    this._statusCode = statusCode;
    this._statusMessage = statusMessage;
    this._headers = headers;
  }

  write(chunk) {
    console.log('MOCK RESPONSE WRITE CALLED');
    this._data.push(chunk);
    this.emit('data', chunk);
  }

  end(chunk) {
    console.log('MOCK RESPONSE END CALLED');
    if (chunk) this._data.push(chunk);
    this.emit('end');
    if (this.callback) this.callback();
  }
};

const createFakeAgent = (res, data) => {
  return {
    request: (opts, callback) => {
      console.log('FAKE AGENT REQUEST CALLED');
      console.log(opts);
      setTimeout(() => {
        console.log('FAKE RESPONSE RETURNED');
        callback(res);
      }, 5);
      setTimeout(() => {
        console.log('FAKE RESPONSE DATA STARTED');
        res.emit('data', data);
        res.emit('end');
      }, 10);
      return new MockClientRequest();
    }
  }
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
        expect(cache.buffer.toString()).to.be.equal(expected.body);
      })
      .then(callback());
  }, 5);
};

describe('proxy#startProxyRequest', () => {
  const proxy = setUpProxy(conf, translator);
  const buffer = Buffer.from(doc);

  context('given html with lang param', () => {
    const reqObj = {
      id: 2,
      lang: 'ja',
      href: 'http://localhost/path/to?lang=ja',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: targetHttpPort,
      path: '/path/to?lang=ja',
    };
    const expected = {
      res: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {
          'content-type': 'text/html',
          'content-length': translatedDoc.length,
          'access-control-allow-origin': 'localhost',
          'set-cookie': [ 'SELECTEDLANG=ja' ]
        }
      },
      body: translatedDoc
    };
    const res = new MockResponse();
    const proxyRes = new MockIncomingMessage();
    const agent = createFakeAgent(proxyRes, buffer);

    before((done) => {
      //ResponseCache.save(reqObj, null, resHeader, buffer).then(done());
      ResponseCache.del(reqObj, 'ja').then(done());
    });

    it('sends a request to the specified web server', (done) => {
      res.on('end', (chunk) => {
        expect(res.statusCode).to.be.equal(expected.res.statusCode);
        expect(res.statusMessage).to.be.equal(expected.res.statusMessage);
        expect(res.headers).to.eql(expected.res.headers);
        expect(res.data.toString()).to.be.equal(expected.body);
        checkCache(reqObj, 'ja', expected, done);
      });

      proxy.startProxyRequest(res, agent, reqObj);
    });
  });

  context('given html without lang param', () => {
    const reqObj = {
      id: 3,
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: targetHttpPort,
      path: '/path/to',
    };
    const expected = {
      res: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: { 'content-type': 'text/html' }
      },
      body: doc
    };
    const res = new MockResponse();
    const proxyRes = new MockIncomingMessage();
    const agent = createFakeAgent(proxyRes, buffer);

    before((done) => {
      //ResponseCache.save(reqObj, null, resHeader, buffer).then(done());
      ResponseCache.del(reqObj, null).then(done());
    });

    it('sends a request to the specified web server', (done) => {
      res.on('end', (chunk) => {
        expect(res.statusCode).to.be.equal(expected.res.statusCode);
        expect(res.statusMessage).to.be.equal(expected.res.statusMessage);
        expect(res.headers).to.eql(expected.res.headers);
        expect(res.data.toString()).to.be.equal(doc);
        const expected2 = { ...expected };
        expected2.res.headers['content-length'] = doc.length;
        checkCache(reqObj, null, expected2, done);
      });

      proxy.startProxyRequest(res, agent, reqObj);
    });
  });
});

//    const url = 'http://localhost:' + serverHttpPort;

//describe('proxy#serve', () => {
//  const ResponseCache = createResponseCache(conf);
//  let req;
//  let res;
//  let cache;
//
//  before((done) => {
//    req = httpMocks.createRequest({
//      method: 'GET',
//      url: 'http://localhost:9996/path/to',
//      //host: 'localhost:9996',
//      //hostname: 'localhost',
//      headers: {
//        host: 'localhost:9996',
//      },
//      connection: { encrypted: false }
//    });
//    res = httpMocks.createResponse({
//      //writableStream: true,
//      //eventEmitter: events.EventEmitter
//    });
//    //ResponseCache.save(reqObj, null, resHeader, buffer).then(done());
//    ResponseCache.del(reqObj, null).then(done());
//  });
//
//  after((done) => {
//    ResponseCache.del(reqObj, null).then(done());
//  });
//
//  context('With cache', () => {
//    it('sends a request to the specified web server', (done) => {
//      const proxy = setUpProxy(conf, translator, proxyFunc, () => {
//        expect(res.statusCode).to.be.equal(200);
//        expect(res.statusMessage).to.be.equal('OK');
//        const data = res._getData();
//        console.log('--------------------------------------------');
//        console.log(data);
//        console.log('--------------------------------------------');
//        done();
//      });
//      proxy.serve(req, res);
//    });
//  });
//});
