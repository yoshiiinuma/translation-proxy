
import https from 'https';
import childProcess from 'child_process';
import cheerio from 'cheerio';
import Logger from './logger.js';

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

export const createConnectionOption = (conf) => {
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

const DEFAULT_SELECTORS = ["body"];

const extractTexts = (html, conf) => {
  return new Promise((resolve, reject) => {
    try {
      const selectors = conf.translationSelectors || DEFAULT_SELECTORS;
      const $ = cheerio.load(html);
      const q = [];

      selectors.forEach((sel) => {
        let text = $(sel).html();
        Logger.debug('Translate ' + sel + ' SIZE: ' + text ? text.length : 0);
        q.push(text);
      });
      resolve(q);
    }
    catch (err) {
      reject(err);
    }
  });
};

export const replaceTexts = (html, translated, conf) => {
  return new Promise((resolve, reject) => {
    try {
      const selectors = conf.translationSelectors || DEFAULT_SELECTORS;
      const $ = cheerio.load(html);

      selectors.forEach((sel) => {
        $(sel).html(translated.shift().translatedText);
      });
      resolve($.html());
    }
    catch (err) {
      reject(err);
    }
  });
};

export const createPostData = (html, lang, conf) => {
  return extractTexts(html, conf)
    .then((q) => {
      return {
      source: 'en',
      target: lang,
      format: 'html',
      q
      }
    })
};

/**
 * opts: conforms http.request, pointing to Google API endpoint
 * data: conforms Google Cloud Translation API post data
 */
export const callTranslateApi = (opts, data) => {
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
        if (json.data && json.data.translations) {
          return resolve(json.data.translations);
        }
        Logger.error('API REQUEST FAILED');
        Logger.error(json);
        return reject(json);
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
    let opts;
    let data;
    createConnectionOption(conf)
      .then((_opts) => opts = _opts)
      .then(() => createPostData(html, lang, conf))
      .then((_data) => data = _data)
      .then(() => callTranslateApi(opts, data))
      .then((rslt) => replaceTexts(html, rslt, conf))
      .then((rslt) => callback(null, rslt))
      .catch((err) => callback(err));
  };
};

