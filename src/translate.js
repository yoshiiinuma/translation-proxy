
import https from 'https';
import Logger from './logger.js';
import childProcess from 'child_process';

const exec = childProcess.exec;

const setLangAttribute = (html) => {
};

const getApiKey = (conf, callback) => {
  const command = conf.gcloudPath + ' auth application-default print-access-token';
  const env = { env: { 'GOOGLE_APPLICATION_CREDENTIALS': conf.keyPath } };

  exec(command, env, (error, stdout, stderr) => {
    if (error) {
      Logger.error('Translate#getApiKey: ');
      Logger.error(error);
      callback(error);
    } else {
      if (stderr) {
        Logger.error('Translate#getApiKey: ' + stderr);
      }
      callback(null, stdout.toString().trim());
    }
  });
};

const createOption = (conf, callback) => {
  getApiKey(conf, (err, key) => {
    if (err) {
      callback(err);
    } else {
      callback(null, {
        protocol: 'https:',
        method: 'POST',
        host: 'translation.googleapis.com',
        path: '/language/translate/v2',
        headers: {
          'Authorization': 'Bearer ' + key,
          'Contetn-Type': 'application/json; charset=utf-8'
        }
      });
    }
  });
}; 

export default (conf) => {
  return (html, lang, callback) => {
    const data = {
      source: 'en',
      target: lang,
      format: 'html',
      q: html
    }
    createOption(conf, (err, opts) => {
      if (err) callback(err);
      translate(opts, data, callback);
    });
  }; 
};

const translate = (opts, data, callback) => {
  const req = https.request(opts, (res) => {
    let body = '';

    res.on('error', (e) => {
      Logger.error('API RESPONSE ERROR');
      Logger.error(e);
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
    Logger.error(e);
    callback(e);
  });

  req.write(JSON.stringify(data));
  req.end();
};
