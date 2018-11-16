
import https from 'https';
import Logger from './logger.js';

const endpoint = 'https://translation.googleapis.com/language/translate/v2';

const setLangAttribute = (html) => {
};

export default (apiKey) => {
  const opts = {
    protocol: 'https:',
    method: 'POST',
    host: 'translation.googleapis.com',
    path: '/language/translate/v2',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Contetn-Type': 'application/json; charset=utf-8'
    }
  }; 

  return (html, lang, callback) => {
    const data = {
      source: 'en',
      target: lang,
      format: 'html',
      q: html
    }
    const req = https.request(opts, (res) => {
      let body = '';

      res.on('error', (e) => {
        Logger.error('API RESPONSE ERROR');
        callback(e);
      });

      res.on('data', (chunk) => {
        Logger.debug('API RESPONSE DATA');
        body += chunk;
      });

      res.on('end', (chunk) => {
        Logger.debug('API RESPONSE END');
        if (chunk) { 
          body += chunk;
        }
        callback(null, JSON.parse(body));
      });

    });

    req.on('error', (e) => {
      Logger.error('API REQUEST ERROR');
      callback(e);
    });

    req.write(JSON.stringify(data));
    req.end();
  };
};
