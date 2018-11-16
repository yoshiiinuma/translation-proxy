
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
        const json = JSON.parse(body);
        let translated;
        if (json.data && json.data.translations && json.data.translations[0]) {
          translated = json.data.translations[0].translatedText;
        }
        if (translated) {
          callback(null, translated);
        } else {
          Logger.error('API REQUEST FAILED');
          Logger.error(json);
          callback(json);
        }
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
