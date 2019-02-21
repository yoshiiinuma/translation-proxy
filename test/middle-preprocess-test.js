
import { expect } from 'chai';
import { MockResponse, MockClientRequest } from './helper.js';

import { setUpPreprocessor } from '../src/middle-preprocess.js';

const port = 7777;

const conf = {
  targetHttpPort: 8888,
  targetHttpsPort: 9999
}

const MiddlePreprocessor = setUpPreprocessor(conf);

describe('MiddlePreprocessor', () => {
  //context('with conf', () => {
  //  const reqObj = {
  //    href: 'http://localhost/path/to',
  //    protocol: 'http:',
  //    method: 'GET',
  //    host: 'localhost',
  //    port: port,
  //    path: '/path/to',
  //  };
  //  const expected = {
  //    id: '           0',
  //    href: 'http://localhost/path/to',
  //    remoteIp: '123.123.123.123',
  //    lang: null,
  //    scheme: 'http',
  //    protocol: 'http:',
  //    method: 'GET',
  //    host: 'localhost',
  //    port: conf.targetHttpPort,
  //    requestedHost: 'localhost',
  //    requestedPort: conf.targetHttpPort,
  //    path: '/path/to',
  //    headers: {
  //      host: 'localhost',
  //     'X-Forwarded-For': '123.123.123.123',
  //     'X-Forwarded-Proto': 'http',
  //     'X-Real-IP': '123.123.123.123'
  //    },
  //    rawHeaders: undefined
  //  };
  //  const res = new MockResponse();
  //  const req = new MockClientRequest(reqObj);

  //  it('creates reqObj and set it to res.locals', (done) => {
  //    MiddlePreprocessor(req, res, () => {
  //      expect(res.locals.reqObj).to.eql(expected);
  //      done();
  //    });
  //  });
  //});

  context('when request has parameters', () => {
    context('with lang option', () => {
      context('and no other options', () => {
        it('sets the lang option and removes it from the path', (done) => {
          const reqObj = {
            protocol: 'http:',
            method: 'GET',
            host: 'ets.hawaii.gov',
            path: '/path/to/?lang=zh-CN',
          };
          const res = new MockResponse();
          const req = new MockClientRequest(reqObj);

          MiddlePreprocessor(req, res, () => {
            expect(res.locals.reqObj.lang).to.be.equal('zh-CN');
            expect(res.locals.reqObj.path).to.be.equal('/path/to/');
            done();
          });
        });
      });

      context('located in the head of the query string', () => {
        it('sets the lang option and removes it from the path', (done) => {
          const reqObj = {
            protocol: 'http:',
            method: 'GET',
            host: 'ets.hawaii.gov',
            path: '/path/to/?lang=zh-CN&a=1&b=2',
          };
          const res = new MockResponse();
          const req = new MockClientRequest(reqObj);

          MiddlePreprocessor(req, res, () => {
            expect(res.locals.reqObj.lang).to.be.equal('zh-CN');
            expect(res.locals.reqObj.path).to.be.equal('/path/to/?a=1&b=2');
            done();
          });
        });
      });

      context('located in the middle of the query string', () => {
        it('sets the lang option and removes it from the path', (done) => {
          const reqObj = {
            protocol: 'http:',
            method: 'GET',
            host: 'ets.hawaii.gov',
            path: '/path/to/?a=1&lang=zh-CN&b=2',
          };
          const res = new MockResponse();
          const req = new MockClientRequest(reqObj);

          MiddlePreprocessor(req, res, () => {
            expect(res.locals.reqObj.lang).to.be.equal('zh-CN');
            expect(res.locals.reqObj.path).to.be.equal('/path/to/?a=1&b=2');
            done();
          });
        });
      });

      context('located in the tail of the query string', () => {
        it('sets the lang option and removes it from the path', (done) => {
          const reqObj = {
            protocol: 'http:',
            method: 'GET',
            host: 'ets.hawaii.gov',
            path: '/path/to/?a=1&b=2&lang=zh-CN',
          };
          const res = new MockResponse();
          const req = new MockClientRequest(reqObj);

          MiddlePreprocessor(req, res, () => {
            expect(res.locals.reqObj.lang).to.be.equal('zh-CN');
            expect(res.locals.reqObj.path).to.be.equal('/path/to/?a=1&b=2');
            done();
          });
        });
      });
    })

    context('with multiple search parameters', () => {
      const reqObj = {
        //href: 'http://ets.hawaii.gov/?s=xxx+yyy',
        protocol: 'http:',
        method: 'GET',
        host: 'ets.hawaii.gov',
        path: '/path/to/?s=xxx+yyy+zzz',
      };

      const res = new MockResponse();
      const req = new MockClientRequest(reqObj);

      it('correctly sets the path', (done) => {
        MiddlePreprocessor(req, res, () => {
          expect(res.locals.reqObj.path).to.be.equal('/path/to/?s=xxx+yyy+zzz');
          done();
        });
      });
    })
  })
});
