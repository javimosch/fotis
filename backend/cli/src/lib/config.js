import Conf from 'conf';
import { homedir } from 'os';
import path from 'path';

const conf = new Conf({
  projectName: 'fotis-cli',
  defaults: {
    apiUrl: 'http://localhost:3001',
    outputDir: path.join(homedir(), 'fotis-thumbnails'),
  }
});

export function loadConfig() {
  return conf;
}

export function getApiUrl() {
  return conf.get('apiUrl');
}

export function setApiUrl(url) {
  conf.set('apiUrl', url);
}

export function getOutputDir() {
  return conf.get('outputDir');
}

export function setOutputDir(dir) {
  conf.set('outputDir', dir);
}