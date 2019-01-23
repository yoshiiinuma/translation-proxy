
import { expect } from 'chai';
import { MockResponse, MockClientRequest } from './helper.js';

import { setUpPreprocessor } from '../src/middle-preprocess.js';
//import { setUpMiddleCache } from '../src/middle-cache.js';

const port = 7777;

const conf = {
  targetHttpPort: 8888,
  targetHttpsPort: 9999
}

describe('MiddlePreprocessor', () => {
  context('with conf', () => {
    const MiddlePreprocessor = setUpPreprocessor(conf);
    const reqObj = {
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: port,
      path: '/path/to',
    };
    const expected = {
      id: '           0',
      href: 'http://localhost/path/to',
      remoteIp: '123.123.123.123',
      lang: null,
      scheme: 'http',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: conf.targetHttpPort,
      requestedHost: 'localhost',
      requestedPort: conf.targetHttpPort,
      path: '/path/to',
      headers: {
        host: 'localhost',
       'X-Forwarded-For': '123.123.123.123',
       'X-Forwarded-Proto': 'http',
       'X-Real-IP': '123.123.123.123'
      },
      rawHeaders: undefined
    };
    const res = new MockResponse();
    const req = new MockClientRequest(reqObj);

    it('creates reqObj and set it to res.locals', (done) => {
      MiddlePreprocessor(req, res, () => {
        expect(res.locals.reqObj).to.eql(expected);
        done();
      });
    });
  });
});
