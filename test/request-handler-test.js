
import { expect } from 'chai';
import events from 'events';

import { setUpRequestHandler } from '../src/request-handler.js';

const debug = false;

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
    if (this.callback) this.callback();
  }
};

const createMiddleware = (name) => {
  const middle = { isCalled: false };
  middle.func = (req, res, next) => {
    middle.isCalled = true;
    next();
  };
  return middle;
};

const createErrorMiddleware = (name) => {
  const middle = { isCalled: false };
  middle.func = (req, res, next) => {
    middle.isCalled = true;
    throw new Error('Error Middle');
  };
  return middle;
};

const createLastware = (name) => {
  const middle = { isCalled: false };
  middle.func = (req, res, next) => {
    middle.isCalled = true;
    res.writeHead(200, 'OK', { 'content-type': 'text/plain' });
    res.write(name);
    res.end();
  };
  return middle;
};

describe('RequestHandler#serve', () => {
  context('given no middleware', () => {
    const RequestHandler = setUpRequestHandler();
    const req = {};

    it('returns 501', () => {
      const res = new MockResponse(() => {
        expect(res.statusCode).to.be.equal(501);
        expect(res.statusMessage).to.be.equal('Not Implemented');
        expect(res.headers).to.eql({ 'content-type': 'text/plain' });
        expect(res.data.toString()).to.equal('Error 501: Not Implemented');
      })
      RequestHandler.serve(req, res);
    })
  });

  context('given multiple middleware', () => {
    const RequestHandler = setUpRequestHandler();
    const middle1 = createMiddleware('middle1');
    const middle2 = createMiddleware('middle2');
    const middle3 = createMiddleware('middle3');
    const last = createLastware('last');
    const req = {};

    before(() => {
      RequestHandler.use(middle1.func);
      RequestHandler.use(middle2.func);
      RequestHandler.use(last.func);
      RequestHandler.use(middle3.func);
    });

    it('returns 200', () => {
      const res = new MockResponse(() => {
        expect(middle1.isCalled).to.be.equal(true);
        expect(middle2.isCalled).to.be.equal(true);
        expect(middle3.isCalled).to.be.equal(false);
        expect(last.isCalled).to.be.equal(true);
        expect(res.statusCode).to.be.equal(200);
        expect(res.statusMessage).to.be.equal('OK');
        expect(res.headers).to.eql({ 'content-type': 'text/plain' });
        expect(res.data.toString()).to.equal('last');
      })
      RequestHandler.serve(req, res);
    })
  });

  context('when middleware throws an error', () => {
    const RequestHandler = setUpRequestHandler();
    const middle1 = createMiddleware('middle1');
    const middle2 = createMiddleware('middle2');
    const middle3 = createMiddleware('middle3');
    const errMiddle = createErrorMiddleware('errMiddle');
    const last = createLastware('last');
    const req = {};

    before(() => {
      RequestHandler.use(middle1.func);
      RequestHandler.use(middle2.func);
      RequestHandler.use(errMiddle.func);
      RequestHandler.use(last.func);
      RequestHandler.use(middle3.func);
    });

    it('returns 500', () => {
      const res = new MockResponse(() => {
        expect(middle1.isCalled).to.be.equal(true);
        expect(middle2.isCalled).to.be.equal(true);
        expect(middle3.isCalled).to.be.equal(false);
        expect(errMiddle.isCalled).to.be.equal(true);
        expect(last.isCalled).to.be.equal(false);
        expect(res.statusCode).to.be.equal(500);
        expect(res.statusMessage).to.be.equal('Internal Server Error');
        expect(res.headers).to.eql({ 'content-type': 'text/plain' });
        expect(res.data.toString()).to.equal('Error 500: Internal Server Error');
      })
      RequestHandler.serve(req, res);
    })
  });
});
