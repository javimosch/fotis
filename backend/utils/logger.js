let originalConsole = {...console};

const debug = (...args) => {
  if (process.env.VERBOSE === '1') {
    originalConsole.debug('[DEBUG]', ...args);
  }
};

const error = (...args) => {
  originalConsole.error('[ERROR]', ...args);
};

const info = (...args) => {
  originalConsole.log('[INFO]', ...args);
};

console.debug = debug;
console.error = error;
console.info = info;

module.exports = {
  debug,
  error,
  info
};