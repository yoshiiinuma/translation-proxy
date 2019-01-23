
import { expect } from 'chai';

import * as TestHelper from './helper.js';
import { setUpMiddleFirewall } from '../src/middle-firewall.js';

describe('MiddleFirewall', () => {
  const conf = { proxiedHosts: { 'localhost': true } };
  const MiddleFirewall = setUpMiddleFirewall(conf);

  context('reqObj is not provided', () => {
    const reqObj = {
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: 8888,
      path: '/path/to',
    };
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
    const reqObj = {
      id: '    12345',
      href: 'http://localhost/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'localhost',
      port: 8888,
      path: '/path/to',
    };
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
    const reqObj = {
      id: '    12345',
      href: 'http://test.example.com/path/to',
      protocol: 'http:',
      method: 'GET',
      host: 'test.example.com',
      port: 8888,
      path: '/path/to',
    };
    const req = new TestHelper.MockClientRequest(reqObj);
    const res = new TestHelper.MockResponse(reqObj);
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
});

