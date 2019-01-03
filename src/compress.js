
import zlib from 'zlib';
import Logger from './logger.js';

export const uncompress = (text, encoding) => {
  if (encoding === 'gzip') {
    return zlib.gunzipSync(text).toString();
  } else if (encoding === 'deflate') {
    return zlib.inflateRawSync(text).toString();
  }
  return text;
}

export const compress = (text, encoding) => {
  Logger.debug('COMPRESS with: ' + encoding);
  if (encoding === 'gzip') {
    return zlib.gzipSync(text);
  } else if (encoding === 'deflate') {
    return zlib.deflateSync(text);
  }
  return text;
}

export const uncompressAsync = (text, encoding) => {
  return new Promise((resolve, reject) => {
    if (encoding === 'gzip') {
      return zlib.gunzip(text, (err, buffer) => {
        if (err) {
          Logger.error('GUNZIP Failed');
          Logger.error(err);
          return reject(err);
        }
        return resolve(buffer.toString());
      });
    } else if (encoding === 'deflate') {
      return zlib.inflateRawi(text, (err, buffer) => {
        if (err) {
          Logger.error('INFLATERAW Failed');
          Logger.error(err);
          return reject(err);
        }
        return resolve(buffer.toString());
      });
    }
    return resolve(text);
  });
}

export const compressAsync = (text, encoding) => {
  return new Promise((resolve, reject) => {
    Logger.debug('COMPRESS with: ' + encoding);
    if (encoding === 'gzip') {
      return zlib.gzip(text, (err, compressed) => {
        if (err) {
          Logger.error('GZIP Failed');
          Logger.error(err);
          return reject(err);
        }
        return resolve(compressed);
      });
    } else if (encoding === 'deflate') {
      return zlib.deflateSync(text, (err, compressed) => {
        if (err) {
          Logger.error('Deflate Failed');
          Logger.error(err);
          return reject(err);
        }
        return resolve(compressed);
      });
    }
    return resolve(text);
  });
}

