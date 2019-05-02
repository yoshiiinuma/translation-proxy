
import { expect } from 'chai';

import { createProxyServer } from '../src/proxy.js'; 
import Logger from '../src/logger.js';

Logger.initialize({
  enableLog: true,
  logLevel: "debug",
  logDir: "./logs",
  logFile: "test.log",
  accessLogFile: "test-access.log",
});

const conf = {
  shutdownGrace: 300,
  serverHttpPort: 9990,
  serverHttpsPort: 9991,
  targetHttpPort: 9992,
  targetHttpsPort: 9993,
  sslCert: "./certs/test.pem",
  sslKey: "./certs/test.key",
};

/*******************************************************
 * This test passes but the process exits with 130
 *
 * npm run test ends with:
 *   code ELIFECYCLE
 *   errno 130
 *
 * This is the expected behavior.
 *
describe('proxy', () => {
  context('when receiving SIGINT', () => {
    let server;

    before((done) => {
      server = createProxyServer(conf);
      server.start();

      setTimeout(() => {
        process.kill(server.pid, 'SIGINT');
        done();
      }, 100);
    });

    it('shutdowns the server gracefully', () => {
      expect(server.isRunning()).to.be.equal(false);
      expect(server.isGraceful()).to.be.equal(true);
    });
  });
});
/********************************************************/
