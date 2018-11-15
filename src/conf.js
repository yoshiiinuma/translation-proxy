
import fs from 'fs';
import Logger from './logger.js';

/**
 * arg: { env }
 */
export const loadConfig = (file) => {
  if (!fs.existsSync(file)) return null;
  const conf = JSON.parse(fs.readFileSync(file));
  Logger.initialize(conf);
  return conf;
};

