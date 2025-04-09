import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as api from '../lib/api.js';
import { logError } from '../utils/logger.js';

export function adminCommands(program) {
  const admin = program.command('admin');

  // Sources management
  const sources = admin.command('sources');

  sources
    .command('list')
    .description('List all configured sources')
    .action(async () => {
      const spinner = ora('Fetching sources...').start();
      try {
        const result = await api.listSources();
        spinner.stop();
        
        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.bold('\nConfigured sources:'));
          result.forEach(source => {
            console.log(chalk.cyan(`\n• Source ID: ${source._id}`));
            console.log(`  Type: ${source.type}`);
            console.log(`  Created: ${new Date(source.createdAt).toLocaleString()}`);
            console.log(`  Config: ${JSON.stringify(source.config, null, 2)}`);
          });
        }
      } catch (error) {
        spinner.fail('Failed to fetch sources');
        logError(error, 'Sources List Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  sources
    .command('add')
    .description('Add a new source')
    .option('--type <type>', 'Source type (local or sftp)')
    .option('--path <path>', 'Path to media files')
    .option('--host <host>', 'SFTP host')
    .option('--user <username>', 'SFTP username')
    .option('--pass <password>', 'SFTP password')
    .action(async (options) => {
      let config;
      
      try {
        if (!options.type) {
          const answer = await inquirer.prompt([{
            type: 'list',
            name: 'type',
            message: 'Select source type:',
            choices: ['local', 'sftp']
          }]);
          options.type = answer.type;
        }

        if (options.type === 'local') {
          if (!options.path) {
            const answer = await inquirer.prompt([{
              type: 'input',
              name: 'path',
              message: 'Enter local path:'
            }]);
            options.path = answer.path;
          }
          config = { path: options.path };
        } else if (options.type === 'sftp') {
          if (!options.host || !options.user || !options.pass || !options.path) {
            const answers = await inquirer.prompt([
              {
                type: 'input',
                name: 'host',
                message: 'Enter SFTP host:',
                when: !options.host
              },
              {
                type: 'input',
                name: 'user',
                message: 'Enter SFTP username:',
                when: !options.user
              },
              {
                type: 'password',
                name: 'pass',
                message: 'Enter SFTP password:',
                when: !options.pass
              },
              {
                type: 'input',
                name: 'path',
                message: 'Enter remote path:',
                when: !options.path
              }
            ]);
            Object.assign(options, answers);
          }
          config = {
            host: options.host,
            user: options.user,
            pass: options.pass,
            path: options.path
          };
        }

        const spinner = ora('Adding source...').start();
        try {
          const result = await api.addSource(options.type, config);
          spinner.succeed('Source added successfully');
          if (program.opts().json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(chalk.cyan(`\nSource ID: ${result.insertedId}`));
          }
        } catch (error) {
          spinner.fail('Failed to add source');
          logError(error, 'Add Source API Error');
          if (program.opts().debug) {
            console.error(error);
          }
          process.exit(1);
        }
      } catch (error) {
        logError(error, 'Add Source Command Error');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  // Indexing commands
  const indexing = admin.command('index');

  indexing
    .command('start')
    .description('Start indexing for a source')
    .requiredOption('--source-id <id>', 'Source ID to index')
    .action(async (options) => {
      const spinner = ora('Starting indexing...').start();
      try {
        await api.startIndexing(options.sourceId);
        spinner.succeed('Indexing started');
      } catch (error) {
        spinner.fail('Failed to start indexing');
        logError(error, 'Start Indexing Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  indexing
    .command('status')
    .description('Get indexing status')
    .requiredOption('--source-id <id>', 'Source ID to check')
    .option('--watch', 'Watch for status changes')
    .action(async (options) => {
      const checkStatus = async () => {
        try {
          const status = await api.getIndexingStatus(options.sourceId);
          if (program.opts().json) {
            console.log(JSON.stringify(status, null, 2));
          } else {
            console.clear();
            console.log(chalk.bold('\nIndexing Status:'));
            console.log(chalk.cyan(`• Is Indexing: ${status.isIndexing}`));
            console.log(`• Total Files: ${status.totalFiles}`);
            console.log(`• Processed: ${status.processedFiles}`);
            if (status.lastIndexed) {
              console.log(`• Last Indexed: ${new Date(status.lastIndexed).toLocaleString()}`);
            }
          }
          return status.isIndexing;
        } catch (error) {
          logError(error, 'Check Status Command');
          if (program.opts().debug) {
            console.error(error);
          }
          process.exit(1);
        }
      };

      if (options.watch) {
        console.log(chalk.yellow('Watching for status changes (Ctrl+C to stop)...'));
        try {
          while (await checkStatus()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          logError(error, 'Watch Status Command');
          if (program.opts().debug) {
            console.error(error);
          }
          process.exit(1);
        }
      } else {
        await checkStatus();
      }
    });
}