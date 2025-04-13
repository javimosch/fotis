const Client = require('ssh2-sftp-client');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class SftpService {
  constructor() {
    this.client = new Client();
    this.tempDir = path.join(os.tmpdir(), 'fotis-sftp-temp');

    //prune tempDir
    //fs.rmdir(this.tempDir, { recursive: true }).catch(() => {});
  }

  async connect(config) {
    console.debug('[DEBUG] SftpService.connect', { host: config.host, port: config.port, username: config.username });
    await this.client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password
    });
    await this.ensureTempDir();
  }

  async listFiles(path) {
    try {
      console.debug('[DEBUG] SftpService.listFiles', { path });
      return await this.client.list(path);
    } catch (error) {
      console.debug('[DEBUG] SftpService.listFiles error', { path, message: error.message, stack: error.stack });
      throw error;
    }
  }

  async downloadFile(remotePath) {
    try {
      console.debug('[DEBUG] SftpService.downloadFile', { remotePath });
      const tempFilePath = path.join(this.tempDir, path.basename(remotePath));
      await this.client.get(remotePath, tempFilePath);
      console.debug('[DEBUG] SftpService.downloadFile success', { remotePath, tempFilePath });
      return tempFilePath;
    } catch (error) {
      console.debug('[DEBUG] SftpService.downloadFile error', { remotePath, message: error.message, stack: error.stack });
      throw error;
    }
  }

  async ensureTempDir() {
    try {
      console.debug('[DEBUG] SftpService.ensureTempDir', { tempDir: this.tempDir });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.debug('[DEBUG] SftpService.ensureTempDir error', { tempDir: this.tempDir, message: error.message, stack: error.stack });
      throw error;
    }
  }

  async cleanupTempFile(tempFilePath) {
    try {
      console.debug('[DEBUG] SftpService.cleanupTempFile', { tempFilePath });
      await fs.unlink(tempFilePath);
    } catch (error) {
      console.debug('[DEBUG] SftpService.cleanupTempFile error', { tempFilePath, message: error.message, stack: error.stack });
      // Don't throw error for cleanup failures
    }
  }

  async disconnect() {
    try {
      console.debug('[DEBUG] SftpService.disconnect');
      await this.client.end();
    } catch (error) {
      console.debug('[DEBUG] SftpService.disconnect error', { message: error.message, stack: error.stack });
    }
  }
}

module.exports = SftpService;