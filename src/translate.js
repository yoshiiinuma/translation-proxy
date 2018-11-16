
import https from 'https';
import Logger from './logger.js';
import childProcess from 'child_process';

const exec = childProcess.exec;

const setLangAttribute = (html) => {
};

const getApiKey = (conf) => {
  const command = conf.gcloudPath + ' auth application-default print-access-token';
  const env = { env: { 'GOOGLE_APPLICATION_CREDENTIALS': conf.keyPath } };

  return new Promise((resolve, reject) => {
    exec(command, env, (error, stdout, stderr) => {
      if (error) {
        Logger.error('Translate#getApiKey: ');
        Logger.error(error);
        return reject(error);
      }
      if (stderr) {
        Logger.error('Translate#getApiKey: ' + stderr);
      }
      resolve(stdout.toString().trim());
    });
  });
};

const createOption = (conf) => {
  return new Promise((resolve, reject) => {
    getApiKey(conf)
      .then((key) => {
        resolve({
          protocol: 'https:',
          method: 'POST',
          host: 'translation.googleapis.com',
          path: '/language/translate/v2',
          headers: {
            'Authorization': 'Bearer ' + key,
            'Contetn-Type': 'application/json; charset=utf-8'
          }
        });
      })
      .catch((e) => reject(e));
  });
};

const translate = (opts, data) => {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = '';

      res.on('error', (e) => {
        Logger.error('API RESPONSE ERROR');
        Logger.error(e);
        reject(e);
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
        if (!translated) {
          Logger.error('API REQUEST FAILED');
          Logger.error(json);
          return reject(json);
        }
        resolve(translated);
      });
    });

    req.on('error', (e) => {
      Logger.error('API REQUEST ERROR');
      Logger.error(e);
      reject(e);
    });

    req.write(JSON.stringify(data), () => req.end());
  });
};

export default (conf) => {
  return (html, lang, callback) => {
    Logger.debug('Translate to LANG: ' + lang + ' SIZE: ' + html.length);
    const data = {
      source: 'en',
      target: lang,
      format: 'html',
      q: html
    }

    createOption(conf)
      .then((opts) => translate(opts, data))
      .then((text) => callback(null, text))
      .catch((err) => callback(err));
  };
};

