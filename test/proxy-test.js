
import express from 'express';
import http from 'http';
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';

//import rp from 'request-promise';
//import httpMocks from 'node-mocks-http';


import { loadConfig } from '../src/conf.js';
import Logger from '../src/logger.js';
import createResponseCache from '../src/response-cache.js';
import { setUpProxy, clientError } from '../src/proxy.js';

//let conf = loadConfig('./config/config.json', {
//  "cacheEnabled": true,
//  "proxiedHosts": ["loccalhost"],
//  "translationSelectors": ["#header", "#main", "#footer"],
//  "serverHttpPort": 8888,
//  "serverHttpsPort": 8889,
//  "enableLog": true,
//  "logLevel": "debug",
//  "logDir": "./logs"
//});

const serverHttpPort  = 9996;
const serverHttpsPort = 9997;
const targetHttpPort  = 9998;
const targetHttpsPort = 9999;
//const targetHttpPort  = 80;
//const targetHttpsPort = 443;

let conf = loadConfig('./config/config.json', {
  "cacheEnabled": false,
  "cacheSkip": ["do-not-cache-if-url-contains"],
  "proxiedHosts": {
    "localhost": true,
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

const buffer = Buffer.from(doc);
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

const reqObj4 = {
  id: 4,
  href: 'http://spo.hawaii.gov',
  protocol: 'http:',
  method: 'GET',
  //host: 'localhost',
  hostname: 'spo.hawaii.gov',
  port: serverHttpPort,
  path: '/',
};

const translator = {
  translatePage: (html, lang, callback) => {
    callback(null, translatedDoc);
  }
};

const sockets = {};
let nextSockId = 0;
const testWebServer = http.createServer((req, res) => {
  console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
  console.log('TEST SERVER HIT');

  req.on('data', (chunk) => {
    console.log('SERVER REQ DATA');
  });

  req.on('end', () => {
    console.log('SERVER REQ END');
    res.writeHead(200, {'Content-Type': 'text/html'})
    res.write(doc);
    res.end();
  });

  req.on('error', (e) => {
    console.log('SERVER REQ ERROR');
    console.log(e);
  });

  res.on('error', (e) => {
    console.log('SERVER RES ERROR');
    res.writeHead(500, 'text/plain');
    res.end('Error 500: Internal Server Error');
  });
});

testWebServer.on('error', (e) => {
  console.log('TEST WEB SERVER ERROR');
  console.log(e);
});

testWebServer.on('connect', (req, sock, head) => {
  console.log('TEST WEB SERVER CONNECT');
});

testWebServer.on('close', () => {
  console.log('TEST WEB SERVER CLOSE');
});

testWebServer.on('connection', (sock) => {
  const sockId = nextSockId++;
  sockets[sockId] = sock;
  console.log('OPENED SOCK#' + sockId);

  sock.on('close', () => {
    console.log('CLOSED SOCK#' + sockId);
    sockets[sockId].destroy();
    delete sockets[sockId];
  })
})

const proxy = setUpProxy(conf, translator);
const ResponseCache = createResponseCache(conf);
const testProxyServer = http.createServer(proxy.serve);

const sendRequest = (opts) => {
  return new Promise((resolve, reject) => {
    try {
      const body = [];
      console.log('REQUEST SENDING');
      console.log(opts);
      const req = http.request(opts, (res) => {
        console.log('REQUEST GOT RESPONSE: ' + res.statusCode + ' ' + res.statusMessage);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          console.log('REQUEST RESPONSE DATA');
          console.log(chunk);
          body.push(chunk)
        });
        res.on('end', () => {
          console.log('REQUEST RESPONSE END');
          console.log(body.join(''));
          resolve(body.join(''));
        });
      });

      req.on('end', () => {
        console.log('REQUEST END')
      });
      req.on('connect', () => {
        console.log('REQUEST CONNECT')
      });
      req.on('finish', () => {
        console.log('REQUEST FINISH')
      });
      req.on('error', (e) => {
        console.log('REQUEST ERROR');
        console.log(e);
        reject(e);
      });

      req.end();
    }
    catch (e) {
      console.log('REQUEST EXCEPTION');
      console.log(e);
      reject(e);
    }
  });
}

const openServer = (server, port, msg) => {
  return new Promise((resolve, reject) => {
    try {
      let s = server.listen(port, () => {
        console.log(msg);
        resolve(s);
      });
    }
    catch (e) {
      console.log('OPEN SERVER EXCEPTION');
      console.log(e);
      reject(e);
    }
  });
};

const closeServer = (server, msg) => {
  return new Promise((resolve, reject) => {
    try {
      server.close(() => {
        console.log(msg);
        resolve();
      });
    }
    catch (e) {
      console.log('CLOSE SERVER EXCEPTION');
      console.log(e);
      reject(e);
    }
  });
};

const testExpress = express();

const allowCrossDomain = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  next();
};

testExpress.use(allowCrossDomain);

testExpress.get('/', (req, res) => {
  console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
  console.log('EXPRESS SERVER HIT /');
  res.status(200);
  res.set('Content-Type', 'text/html');
  res.send(doc);
  //res.send('This is /');
});

testExpress.get('/path/to', (req, res) => {
  console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
  console.log('EXPRESS SERVER HIT /path/to');
  res.status(200);
  res.set('Content-Type', 'text/html');
  res.send(doc);
  //res.send('This is /path/to');
});


const reqObj = reqObj2;

describe('proxy#serve', () => {
  //let req;
  //let res;
  let cache;
  let exp;

  before((done) => {
    //req = httpMocks.createRequest({
    //  method: 'GET',
    //  url: '/path/to'
    //});
    //res = httpMocks.createResponse();
    openServer(testExpress, targetHttpPort, 'TEST EXPRESS SERVER OPENED')
      .then((server) => exp = server)
      .then(openServer(testProxyServer, serverHttpPort, 'TEST PROXY SERVER OPENED'))
    //openServer(testWebServer, targetHttpPort, 'TEST WEB SERVER OPENED')
    //openServer(testProxyServer, serverHttpPort, 'TEST PROXY SERVER OPENED')
      .then(ResponseCache.del(reqObj, null))
      .then(done());
    //ResponseCache.save(reqObj, null, resHeader, buffer).then(done());
  });

  //after((done) => {
  //  closeServer(testProxyServer, 'TEST PROXY SERVER CLOSED')
  //    //.then(closeServer(testWebServer, 'TEST WEB SERVER CLOSED'))
  //    .then(closeServer(exp, 'TEST EXPRESS SERVER CLOSED'))
  //    .then(ResponseCache.del(reqObj, null))
  //    //.then(done());
  //    .then(() => {
  //      console.log('Waiting...');
  //      setTimeout(() => {
  //        console.log('Passed 1.5 secs');
  //        done();
  //      }, 1500);
  //    });
  //});

  context('With cache', (done) => {
    const url = 'http://localhost:' + serverHttpPort;
    it('sends a request to the specified web server', () => {
       //proxy.serve(req, res);
      sendRequest(reqObj)
      //rp(url)
        .then((res) => {
          console.log('CALLBACK GOT RESPONSE');
          console.log(res);
        })
        //.then(() => done())
        .then(() => {
          console.log('Waiting...');
          setTimeout(() => {
            console.log('Passed 1.5 secs');
            done();
          }, 1500);
        })
        .catch((e) => console.log(e));
    });
  });
});
