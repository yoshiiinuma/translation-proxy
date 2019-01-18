
import Logger from './logger.js';

export const notFound = (res) => {
  Logger.info('404 Not Found');
  res.writeHead(404, 'File Not Found', { 'content-type': 'text/plain' });
  res.end('Error 404: File Not Found');
};

export const serverError = (e, res) => {
  Logger.info('500 Server Error');
  Logger.info(e);
  res.writeHead(500, 'Internal Server Error', { 'content-type': 'text/plain' });
  res.end('Error 500: Internal Server Error');
};

export const notImplemented = (res) => {
  Logger.info('501 Not Implemented');
  res.writeHead(501, 'Not Implemented', { 'content-type': 'text/plain' });
  res.end('Error 501: Not Implemented');
};

export const badGateway = (res) => {
  Logger.info('502 Bad Gateway');
  res.writeHead(502, 'Bad Gateway', { 'content-type': 'text/plain' });
  res.end('Error 502: Bad Gateway');
};

export const serviceUnavailable = (e, res) => {
  Logger.info('503 Service Unavailable');
  Logger.info(e);
  res.writeHead(503, 'Service Unavailable', { 'content-type': 'text/plain' });
  res.end('Error 503: Service Unavailable');
};

export const gatewayTimeout = (res) => {
  Logger.info('504 Gateway Timeout');
  res.writeHead(504, 'Gateway Timeout', { 'content-type': 'text/plain' });
  res.end('Error 504: Gateway Timeout');
};

export const badRequest = (e, res) => {
  Logger.info('400 Bad Request');
  Logger.info(e);
  res.writeHead(400, 'Bad Request', { 'content-type': 'text/plain' });
  res.end('Error 400: Bad Request');
};

export const clientError = (e, socket) => {
  Logger.info('CLIENT ERROR');
  if (e) {
    Logger.info(e);
    Logger.info(util.inspect(socket));
  }
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
};

