
import { expect } from 'chai';

import * as TestHelper from './helper.js';
import { setUpMiddleFirewall } from '../src/middle-firewall.js';

const reqObj = {
  href: 'http://localhost/path/to',
  protocol: 'http:',
  method: 'GET',
  host: 'localhost',
  port: 8888,
  path: '/path/to',
};

describe('MiddleFirewall', () => {
  const conf = {
    proxiedHosts: { 'localhost': true },
    purgeAllowedIps: [ '127.0.0.1' ]
  };
  const MiddleFirewall = setUpMiddleFirewall(conf);

  context('reqObj is not provided', () => {
    const req = new TestHelper.MockClientRequest(reqObj);
    const res = new TestHelper.MockResponse();
    const next = TestHelper.createNextFunc();

    it('returns 500', (done) => {
      res.on('end', () => {
        expect(next.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(500);
        expect(res.statusMessage).to.be.equal('Internal Server Error');
        expect(res.data.toString()).to.be.equal('Error 500: Internal Server Error');
        done();
      });
      MiddleFirewall(req, res, next.func);
    });
  });

  context('when proxied host gets requested', () => {
    const req = new TestHelper.MockClientRequest(reqObj);
    const res = new TestHelper.MockResponse(reqObj);

    it('calls next', (done) => {
      const next = TestHelper.createNextFunc(() => {
        expect(next.isCalled).to.be.equal(true);
        done();
      });
      MiddleFirewall(req, res, next.func);
    });
  });

  context('when non-proxied host gets requested', () => {
    const reqObj2 = { ...reqObj, ...{ href: 'http://test.example.com/path/to', host: 'test.example.com' } };
    const req = new TestHelper.MockClientRequest(reqObj2);
    const res = new TestHelper.MockResponse(reqObj2);
    const next = TestHelper.createNextFunc();

    it('returns 400 bad request', (done) => {
      res.on('end', () => {
        expect(next.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(400);
        expect(res.statusMessage).to.be.equal('Bad Request');
        expect(res.data.toString()).to.be.equal('Error 400: Bad Request');
        done();
      });
      MiddleFirewall(req, res, next.func);
    });
  });

  context('when purge request is recieved from an allowed IP', () => {
    const reqObj2 = { ...reqObj, ...{ method: 'PURGE' } };
    let req = new TestHelper.MockClientRequest(reqObj2);
    const res = new TestHelper.MockResponse(reqObj2);
    const next = TestHelper.createNextFunc();

    before((done) => {
      res.locals.reqObj.remoteIp = '127.0.0.1';
      done();
    });

    it('accepts the request and call next', (done) => {
      const next = TestHelper.createNextFunc(() => {
        expect(next.isCalled).to.be.equal(true);
        done();
      });
      MiddleFirewall(req, res, next.func);
    })
  });

  context('when purge request is recieved from a not-allowed IP', () => {
    const reqObj2 = { ...reqObj, ...{ method: 'PURGE' } };
    const req = new TestHelper.MockClientRequest(reqObj2);
    const res = new TestHelper.MockResponse(reqObj2);
    const next = TestHelper.createNextFunc();

    before((done) => {
      res.locals.reqObj.remoteIp = '123.123.123.123';
      done();
    });

    it('accepts the request and call next', (done) => {
      res.on('end', () => {
        expect(next.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(403);
        expect(res.statusMessage).to.be.equal('Forbidden');
        expect(res.data.toString()).to.be.equal('Error 403: Forbidden');
        done();
      });
      MiddleFirewall(req, res, next.func);
    })
  });
});

