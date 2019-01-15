
import fs from 'fs-extra';
import util from 'util';
import dateFormat from 'dateformat';

const Logger = {};

Logger.Type = {
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5
}

const Label = {
  DEBUG: 'DEBUG',
  INFO:  'INFO ',
  WARN:  'WARN ',
  ERROR: 'ERROR',
  FATAL: 'FATAL'
};

const DEFAULT_LOG_LEVEL = Logger.Type.ERROR;
const DEFAULT_LOG_DIR = './logs';
const DEFAULT_APP_LOG_FILE = 'application.log';
const DEFAULT_ACCESS_LOG_FILE = 'access.log';

let logEnabled = false;
let logLevel = DEFAULT_LOG_LEVEL;
let logFile = DEFAULT_LOG_DIR + '/' + DEFAULT_APP_LOG_FILE;
let accessLogFile = DEFAULT_LOG_DIR + '/' + DEFAULT_ACCESS_LOG_FILE;

const logFormat = (label, msg) => {
  let time = dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss.l');
  if (typeof msg !== 'string') msg = util.inspect(msg);
  return time + ' ' + label + ' ' + msg + "\n";
}

const writeToStdout = (label, msg) => {
  process.stdout.write(logFormat(label, msg));
};

const appendToFile = (label, msg) => {
  fs.appendFile(logFile, logFormat(label, msg), (err) => {
    if (err) throw err;
  });
};

let append = writeToStdout;

const switchToStdout = () => {
  append = writeToStdout;
}

const switchToFile = () => {
  append = appendToFile;
}

Logger.enable = () => {
  logEnabled = true;
  switchToFile();
}

Logger.disable = () => {
  logEnabled = false;
  switchToStdout();
}

Logger.setLogFile = (filePath) => {
  logFile = filePath;
}

Logger.setAccessLogFile = (filePath) => {
  accessLogFile = filePath;
}

Logger.showStatus = () => {
  console.log(' Log Enabled: ' + logEnabled);
  console.log(' Log Level  : ' + Logger.convLevelToString(logLevel));
  console.log(' Log File   : ' + logFile);
}

Logger.convStringLevel = (level) => {
  if (typeof level === 'string') {
    level = level.toLowerCase();
    if (level === 'debug') return Logger.Type.DEBUG;
    if (level === 'info') return Logger.Type.INFO;
    if (level === 'warn') return Logger.Type.WARN;
    if (level === 'error') return Logger.Type.ERROR;
    if (level === 'fatal') return Logger.Type.FATAL;
  }
}

Logger.convLevelToString = (level) => {
  if (typeof level === 'number') {
    if (level === Logger.Type.DEBUG) return 'DEBUG';
    if (level === Logger.Type.INFO) return 'INFO';
    if (level === Logger.Type.WARN) return 'WARN';
    if (level === Logger.Type.ERROR) return 'ERROR';
    if (level === Logger.Type.FATAL) return 'FATAL';
  }
}

Logger.setLogLevel = (level) => {
  if (typeof level === 'number') {
    logLevel = level;
  }
  if (typeof level === 'string') {
    level = level.toLowerCase();
    if (level === 'debug') {
      logLevel = Logger.Type.DEBUG;
    } else if (level === 'info') {
      logLevel = Logger.Type.INFO;
    } else if (level === 'warn') {
      logLevel = Logger.Type.WARN;
    } else if (level === 'error') {
      logLevel = Logger.Type.ERROR;
    } else if (level === 'fatal') {
      logLevel = Logger.Type.FATAL;
    } else {
      logLevel = Logger.Type.ERROR;
    }
  }
}

/**
 * arg: { disableLog, logLevel, logDir, logFile }
 *   enableLog (optional)     : redirects outputs from stdout to file if true
 *   logLevel (optional)      : specifies the log level; default ERROR
 *   logDir (optional)        : specifies the directory to put log file; default '.logs'
 *   logFile (optional)       : path to the log file
 *   accessLogFile (optional) : path to the access log file
 */
Logger.initialize = (arg) => {
  if (arg.enableLog) Logger.enable();
  if (arg.logLevel) Logger.setLogLevel(arg.logLevel);
  let dir = DEFAULT_LOG_DIR;
  if (arg.logDir) {
    dir = arg.logDir;
  }
  if (!dir.endsWith('/')) dir += '/';
  if (arg.logFile) {
    Logger.setLogFile(dir + arg.logFile);
    fs.ensureFileSync(logFile);
  }
  if (arg.accessLogFile) {
    Logger.setAccessLogFile(dir + arg.accessLogFile);
    fs.ensureFileSync(accessLogFile);
  }
}

Logger.debug = (msg) => {
  if (logLevel > Logger.Type.DEBUG) return;
  append(Label.DEBUG, msg);
}

Logger.info = (msg) => {
  if (logLevel > Logger.Type.INFO) return;
  append(Label.INFO, msg);
}

Logger.warn = (msg) => {
  if (logLevel < Logger.Type.WARN) return;
  append(Label.WARN, msg);
}

Logger.error = (msg) => {
  if (logLevel > Logger.Type.ERROR) return;
  append(Label.ERROR, msg);
}

Logger.fatal = (msg) => {
  if (logLevel > Logger.Type.FATAL) return;
  append(Label.FATAL, msg);
}

Logger.access = (reqObj) => {
  const time = dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss.l');
  let msg = time + ' ' + reqObj.remoteIp.padEnd(16, ' ') + reqObj.method.padEnd(7, ' ') +
    reqObj.href + "\n";
  fs.appendFile(accessLogFile, msg, (err) => {
    if (err) throw err;
  });
};

export default Logger;
