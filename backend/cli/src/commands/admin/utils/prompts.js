import inquirer from 'inquirer';
import chalk from 'chalk';

export async function confirmAction(message, defaultNo = true) {
  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message: chalk.red(message),
    default: !defaultNo
  }]);
  return confirmed;
}

export async function selectSource(sources, message = 'Select source:') {
  if (sources.length === 0) {
    console.log(chalk.yellow('\nNo sources configured yet.'));
    return null;
  }

  const { sourceId } = await inquirer.prompt([{
    type: 'list',
    name: 'sourceId',
    message,
    choices: sources.map(s => ({
      name: `${s.type} - ${s.config.path} (${s._id})`,
      value: s._id
    }))
  }]);

  return sourceId;
}

export async function promptSourceConfig(type, defaults = {}) {
  if (type === 'local') {
    const { path } = await inquirer.prompt([{
      type: 'input',
      name: 'path',
      message: 'Enter local path:',
      default: defaults.path || ''
    }]);
    return { path };
  }

  const questions = [
    {
      type: 'input',
      name: 'host',
      message: 'Enter SFTP host:',
      default: defaults.host || ''
    },
    {
      type: 'input',
      name: 'port',
      message: 'Enter SFTP port:',
      default: defaults.port || '22',
      validate: (value) => /^\d+$/.test(value) && parseInt(value) > 0 && parseInt(value) < 65536 || 'Invalid port number'
    },
    {
      type: 'input',
      name: 'user',
      message: 'Enter SFTP username:',
      default: defaults.user || ''
    },
    {
      type: 'password',
      name: 'pass',
      message: 'Enter SFTP password:',
      mask: '*',
      default: defaults.pass || ''
    },
    {
      type: 'input',
      name: 'path',
      message: 'Enter remote path:',
      default: defaults.path || ''
    }
  ];

  const config = await inquirer.prompt(questions);
  config.port = parseInt(config.port);
  return config;
}