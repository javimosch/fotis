const Client = require('ssh2-sftp-client');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class SftpService {
  constructor() {
    this.client = new Client();
    this.tempDir = path.join(os.tmpdir(), 'fotis-sftp-temp');
  }

  async connect(config) {
    console.log('[DEBUG] SftpService.connect', { host: config.host, port: config.port, username: config.username });
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
      console.log('[DEBUG] SftpService.listFiles', { path });
      return await this.client.list(path);
    } catch (error) {
      console.log('[DEBUG] SftpService.listFiles error', { path, message: error.message, stack: error.stack });
      throw error;
    }
  }

  async downloadFile(remotePath) {
    try {
      console.log('[DEBUG] SftpService.downloadFile', { remotePath });
      const tempFilePath = path.join(this.tempDir, path.basename(remotePath));
      await this.client.get(remotePath, tempFilePath);
      console.log('[DEBUG] SftpService.downloadFile success', { remotePath, tempFilePath });
      return tempFilePath;
    } catch (error) {
      console.log('[DEBUG] SftpService.downloadFile error', { remotePath, message: error.message, stack: error.stack });
      throw error;
    }
  }

  async ensureTempDir() {
    try {
      console.log('[DEBUG] SftpService.ensureTempDir', { tempDir: this.tempDir });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.log('[DEBUG] SftpService.ensureTempDir error', { tempDir: this.tempDir, message: error.message, stack: error.stack });
      throw error;
    }
  }

  async cleanupTempFile(tempFilePath) {
    try {
      console.log('[DEBUG] SftpService.cleanupTempFile', { tempFilePath });
      await fs.unlink(tempFilePath);
    } catch (error) {
      console.log('[DEBUG] SftpService.cleanupTempFile error', { tempFilePath, message: error.message, stack: error.stack });
      // Don't throw error for cleanup failures
    }
  }

  async disconnect() {
    try {
      console.log('[DEBUG] SftpService.disconnect');
      await this.client.end();
    } catch (error) {
      console.log('[DEBUG] SftpService.disconnect error', { message: error.message, stack: error.stack });
    }
  }
}

module.exports = SftpService;