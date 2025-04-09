const debug = (...args) => {
  if (process.env.VERBOSE === '1') {
    console.debug('[DEBUG]', ...args);
  }
};

const error = (...args) => {
  console.error('[ERROR]', ...args);
};

const info = (...args) => {
  console.log('[INFO]', ...args);
};

module.exports = {
  debug,
  error,
  info
};