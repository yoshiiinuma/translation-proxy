
import http from 'http';
import fs from 'fs';
import util from 'util';

const targetHttpPort  = 9998;

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
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': doc.length
    });
    //res.write(doc);
    res.end(doc);
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
    delete sockets[sockId];
  })
})


const openServer = (server, port, msg) => {
  return new Promise((resolve, reject) => {
    try {
      server.listen(port, () => {
        console.log(msg);
        resolve()
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
        resolve()
      });
    }
    catch (e) {
      console.log('CLOSE SERVER EXCEPTION');
      console.log(e);
      reject(e);
    }
  });
};

openServer(testWebServer, targetHttpPort, 'TEST WEB SERVER OPENED');

