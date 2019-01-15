
import fs from 'fs';
import Logger from './logger.js';

/**
 * arg: { env }
 */
export const loadConfig = (file, updates) => {
  if (!fs.existsSync(file)) return null;
  let conf = JSON.parse(fs.readFileSync(file));
  let proxiedHosts = {};
  if (conf.proxiedHosts) {
    conf.proxiedHosts.forEach((host) => {
      proxiedHosts[host] = true;
    });
  }
  conf.proxiedHosts = proxiedHosts;
  if (updates) {
    conf = { ...conf, ...updates };
  }
  //Logger.initialize(conf);
  console.log(conf);
  return conf;
};

