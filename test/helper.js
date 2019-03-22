
import events from 'events';
import Logger from '../src/logger.js';

const debug = false;
const port  = 9998;

//const conf = {
//  "cacheEnabled": true,
//  "cacheSkip": ["do-not-cache-if-url-contains"],
//  "proxiedHosts": {
//    "localhost": true,
//    "127.0.0.1": true,
//    "spo.hawaii.gov": true
//  },
//  "targetHttpPort": port,
//  "sslCert": "./certs/test.pem",
//  "sslKey": "./certs/test.key",
//  "reidsPort": 6379,
//};
//
//const ResponseCache = createResponseCache(conf);

export const enableTestLog = () => {
  Logger.initialize({
    "enableLog": true,
    "logLevel": "debug",
    "logDir": "./logs",
    "logFile": "test.log",
    "accessLogFile": "test-access.log",
  });
};

export const wait = (ms) => new Promise((r, j) => setTimeout(r, ms));

export const doc = `
  <html>
    <head>
      <title>Test</title>
    </head>
    <body>
      <div>Hello, World!</div>
    </body>
  </html>
`;

export const translatedDoc = `
  <html>
    <head>
      <title>Tanslated</title>
    </head>
    <body>
      <div>Konnichiwa, Sekai!</div>
    </body>
  </html>
`;

export const translator = {
  translatePage: (html, lang, callback) => {
    if (debug) console.log('TRANSLATOR CALLED');
    callback(null, translatedDoc);
  }
};

export const errTranslator = {
  translatePage: (html, lang, callback) => {
    if (debug) console.log('ERROR TRANSLATOR CALLED');
    callback('TEST TRANSLATION ERROR');
  }
};

export const createMockSendBuffer = () => {
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

export const createMockSendTranslation = () => {
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

export const createNextFunc = (callback) => {
  const r = { isCalled: false };

  r.func = () => {
    r.isCalled = true;
    if (callback) callback();
  };

  return r;
};

export class MockIncomingMessage extends events.EventEmitter {
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

export class MockClientRequest extends events.EventEmitter {
  constructor(reqObj, headers) {
    super();

    const scheme = (reqObj && reqObj.protocol)? reqObj.protocol.slice(0, -1) : 'http';
    const encrypted = (scheme === 'http')? false : true;
    this._method = (reqObj && reqObj.method) ? reqObj.method : 'GET';
    this._headers = (headers) ? headers : {};
    this._connection = { encrypted, remoteAddress: '123.123.123.123' };
    this._headers.host = (reqObj && reqObj.host) ? reqObj.host : null;
    if (reqObj && reqObj.path) {
      this._url = reqObj.path;
      if (reqObj.lang) {
        if (this._url.includes('?')) {
          this._url += '&lang=' + reqObj.lang;
        } else {
          this._url += '?lang=' + reqObj.lang;
        }
      }
    }
  }

  get url() { return this._url; }
  get connection() { return this._connection; }
  get method() { return this._method; }
  get headers() { return this._headers; }
};

export class MockResponse extends events.EventEmitter {
  constructor(reqObj) {
    super();
    this._data = [];
    this._statusCode = null;
    this._statusMessage = null;
    this._headers = {};
    this._locals = {};
    if (reqObj) this._locals.reqObj = reqObj;
  }

  get statusCode() { return this._statusCode }
  get statusMessage() { return this._statusMessage }
  get headers() { return this._headers }
  get locals() { return this._locals }
  get data() { return this._data }

  writeHead(statusCode, statusMessage, headers) {
    if (debug) console.log('MOCK RESPONSE WRITEHEAD CALLED');
    if (debug) console.log(headers);
    this._statusCode = statusCode;
    this._statusMessage = statusMessage;
    this._headers = headers;
  }

  write(chunk) {
    if (debug) console.log('MOCK RESPONSE WRITE CALLED');
    this._data.push(chunk);
    this.emit('data', chunk);
  }

  end(chunk) {
    if (debug) console.log('MOCK RESPONSE END CALLED');
    if (chunk) this._data.push(chunk);
    this.emit('end');
  }
};

/**
 * The returned function mocks node http/https.
 * The function returns the specified response to the given response.
 */
export const createFakeAgent = (res, data, reqObj) => {
  return {
    request: (opts, callback) => {
      if (debug) console.log('FAKE AGENT REQUEST CALLED');
      if (debug) console.log(opts);
      setTimeout(() => {
        if (debug) console.log('FAKE RESPONSE RETURNED');
        callback(res);
      }, 5);
      setTimeout(() => {
        if (debug) console.log('FAKE RESPONSE DATA STARTED');
        res.emit('data', data);
        res.emit('end');
      }, 10);
      return new MockClientRequest(reqObj);
    }
  }
};

/**
 * The returned function mocks node http/https.
 * The function gets the given response to emit an error.
 */
export const createFakeAgentEmitResponseError = (res, data) => {
  return {
    request: (opts, callback) => {
      if (debug) console.log('FAKE AGENT REQUEST CALLED');
      if (debug) console.log(opts);
      setTimeout(() => {
        if (debug) console.log('FAKE RESPONSE RETURNED');
        callback(res);
      }, 5);
      setTimeout(() => {
        if (debug) console.log('FAKE RESPONSE EMIT ERROR');
        res.emit('error', 'FAKE RESPONSE ERROR');
      }, 10);
      return new MockClientRequest();
    }
  }
};

/**
 * The returned function mocks node http/https.
 * The function gets the given response to emit an error.
 */
export const createFakeAgentEmitRequestError = (res, data) => {
  return {
    request: (opts, callback) => {
      const req = new MockClientRequest();
      if (debug) console.log('FAKE AGENT REQUEST CALLED');
      if (debug) console.log(opts);
      setTimeout(() => {
        if (debug) console.log('FAKE RESPONSE RETURNED');
        callback(res);
      }, 5);
      setTimeout(() => {
        if (debug) console.log('FAKE RESPONSE EMIT ERROR');
        req.emit('error', 'FAKE REQUEST ERROR');
      }, 10);
      return req;
    }
  }
};

/**
 * The returned function mocks node http/https.
 * The function returns the specified response to the given response.
 */
export const createCallbackFakeAgent = (res, data, callback) => {
  return {
    request: (opts, callackNeverCalled) => {
      if (debug) console.log('FAKE AGENT REQUEST CALLED');
      if (debug) console.log(opts);
      setTimeout(() => {
        if (debug) console.log('FAKE RESPONSE RETURNED');
        callback();
      }, 1);
      return new MockClientRequest();
    }
  }
};

/**
 * The returned function mocks startProxy function.
 * The function returns the specified response to the given response.
 */
export const createProxyFunc = (statusCode, statusMsg, headers, data) => {
  const r = { isCalled: false };

  r.func = (res, agent, reqObj) => {
    if (debug) console.log('FAKE PROXY WAS CALLED');
    r.isCalled = true;

    setTimeout(() => {
      if (debug) console.log('FAKE PROXY RESPONSE DATA STARTED');
      res.writeHead(statusCode, statusMsg, headers);
      res.write(data);
      res.end();
    }, 5);
    return new MockClientRequest(reqObj);
  };

  return r;
};

