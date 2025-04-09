const Client = require('ssh2-sftp-client');

class SftpService {
  constructor() {
    this.client = new Client();
  }

  async connect(config) {
    await this.client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password
    });
  }

  async listFiles(path) {
    try {
      return await this.client.list(path);
    } catch (error) {
      console.error('SFTP list error:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.end();
    } catch (error) {
      console.error('SFTP disconnect error:', error);
    }
  }
}

module.exports = SftpService;