
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
    //return zlib.deflateRawSync(text).toString();
    return zlib.deflateSync(text);
  }
  return text;
}

