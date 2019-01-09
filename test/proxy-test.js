
import http from 'http';
import fs from 'fs';
import util from 'util';
import { expect } from 'chai';
import httpMocks from 'node-mocks-http';

import { loadConfig } from '../src/conf.js';
import Logger from '../src/logger.js';
import createResponseCache from './response-cache.js';
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

const conf = {
  "cacheEnabled": true,
  "cacheSkip": ["do-not-cache-if-url-contains"],
  "proxiedHosts": ["loccalhost"],
  "translationSelectors": ["#header", "#main", "#footer"],
  "maxTextPerRequest": 12000,
  "domBreakdownThreshold": 250,
  "keyPath": "/path/to/key.json",
  "gcloudPath": "/path/to/google-cloud-sdk/bin/gcloud",
  "serverHttpPort": 8888,
  "serverHttpsPort": 8889,
  "targetHttpPort": 8888,
  "targetHttpsPort": 8889,
  "sslCert": "./certs/test.pem",
  "sslKey": "./certs/test.key",
  "reidsPort": 6379,
  "enableLog": true,
  "logLevel": "debug",
  "logDir": "./logs"
};

Logger.initialize(conf);

const proxy = setUpProxy(conf);
const ResponseCache = createResponseCache(conf);

const doc = '<html><body>Hello, World!</body></html>';
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
const reqObj = {
  protocol: 'http:',
  method: 'GET',
  host: 'localhost',
  port: 8888,
  path: '/path/to',
};

describe('proxy#serve', () => {
  let req;
  let res;
  let cache;

  before((done) => {
    req = httpMocks.createRequest({
      method: 'GET',
      url: '/path/to'
    });
    res = httpMocks.createResponse();
    await ResponseCache.save(reqObj, null, resHeader, buffer);
    done();
  })

  context('With cache', () => {
    it('sends a request to the specified web server', () => {
       proxy.serve(req, res);
    });
  });
});
