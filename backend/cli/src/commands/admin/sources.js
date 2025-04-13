import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as api from '../../lib/api.js';
import { logError } from '../../utils/logger.js';
import { withSpinner } from './utils/spinners.js';
import { formatSourceConfig } from './utils/formatters.js';
import { confirmAction, selectSource, promptSourceConfig } from './utils/prompts.js';

export function sourceCommands(program, sources) {
  sources
    .command('test')
    .description('Test connection to all configured sources')
    .action(async () => {
      try {
        const sources = await withSpinner(
          'Testing sources...',
          () => api.listSources()
        );
        
        if (sources.length === 0) {
          console.log(chalk.yellow('\nNo sources configured.'));
          return;
        }

        console.log(chalk.bold('\nTesting sources:'));
        for (const source of sources) {
          const testSpinner = ora(`Testing ${source.type} source (${source._id})...`).start();
          try {
            const result = await api.testSource(source._id);
            testSpinner.succeed(`${source.type} source (${source._id}): ${chalk.green('Connection successful')}`);
            if (result.details) {
              console.log(chalk.gray(`  Details: ${result.details}`));
            }
          } catch (error) {
            testSpinner.fail(`${source.type} source (${source._id}): ${chalk.red('Connection failed')}`);
            console.log(chalk.red(`  Error: ${error.response?.data?.error || error.message}`));
          }
        }
      } catch (error) {
        logError(error, 'Test Sources Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  sources
    .command('list')
    .description('List all configured sources')
    .action(async () => {
      try {
        const result = await withSpinner(
          'Fetching sources...',
          () => api.listSources()
        );

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.bold('\nConfigured sources:'));
          if (result.length === 0) {
             console.log(chalk.yellow('No sources configured yet.'));
             return;
          }
          result.forEach(source => {
            console.log(chalk.cyan(`\n• Source ID: ${source._id}`));
            console.log(`  Type: ${source.type}`);
            console.log(`  Created: ${new Date(source.createdAt).toLocaleString()}`);
            console.log(`  Config:`);
            console.log(formatSourceConfig(source.config));
          });
        }
      } catch (error) {
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
    .option('--path <path>', 'Path to media files (local or remote)')
    .option('--host <host>', 'SFTP host')
    .option('--port <port>', 'SFTP port (default: 22)')
    .option('--user <username>', 'SFTP username')
    .option('--pass <password>', 'SFTP password')
    .action(async (options) => {
      try {
        let type = options.type;
        if (!type) {
          const answer = await inquirer.prompt([{
            type: 'list',
            name: 'type',
            message: 'Select source type:',
            choices: ['local', 'sftp']
          }]);
          type = answer.type;
        }

        let config;
        if (type === 'local') {
          config = await promptSourceConfig('local', { path: options.path });
        } else if (type === 'sftp') {
          config = await promptSourceConfig('sftp', options);
        } else {
          console.error(chalk.red(`Error: Invalid source type '${type}'. Use 'local' or 'sftp'.`));
          process.exit(1);
        }

        const result = await withSpinner(
          'Adding source...',
          () => api.addSource(type, config)
        );

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.cyan(`\nSource ID: ${result._id}`));
          console.log(chalk.bold('\nSource Configuration:'));
          console.log(`Type: ${result.type}`);
          console.log(formatSourceConfig(result.config));
        }
      } catch (error) {
        logError(error, 'Add Source Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  sources
    .command('edit')
    .description('Edit an existing source')
    .option('--source-id <id>', 'Source ID to edit')
    .option('--type <type>', 'New source type (local or sftp)')
    .option('--path <path>', 'New path to media files')
    .option('--host <host>', 'New SFTP host')
    .option('--port <port>', 'New SFTP port')
    .option('--user <username>', 'New SFTP username')
    .option('--pass <password>', 'New SFTP password')
    .action(async (options) => {
      try {
        const sources = await withSpinner(
          'Fetching sources...',
          () => api.listSources()
        );

        let sourceId = options.sourceId;
        if (!sourceId) {
          sourceId = await selectSource(sources, 'Select source to edit:');
          if (!sourceId) return;
        }

        const source = sources.find(s => s._id === sourceId);
        if (!source) {
          console.error(chalk.red(`Source with ID ${sourceId} not found`));
          process.exit(1);
        }

        let type = options.type;
        let config = { ...source.config };

        if (!options.type && !options.path && !options.host && !options.port && !options.user && !options.pass) {
          const typeAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'type',
            message: 'Select source type:',
            default: source.type,
            choices: ['local', 'sftp']
          }]);
          type = typeAnswer.type;
          config = await promptSourceConfig(type, source.config);
        } else {
          type = options.type || source.type;
          if (type === 'local') {
            if (options.path) config = { path: options.path };
          } else if (type === 'sftp') {
            if (options.path) config.path = options.path;
            if (options.host) config.host = options.host;
            if (options.port) config.port = parseInt(options.port);
            if (options.user) config.user = options.user;
            if (options.pass) config.pass = options.pass;
          }
        }

        const result = await withSpinner(
          'Updating source...',
          () => api.updateSource(sourceId, { type, config })
        );

        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.cyan(`\nSource ID: ${result._id}`));
          console.log(chalk.bold('\nUpdated Configuration:'));
          console.log(`Type: ${result.type}`);
          console.log(formatSourceConfig(result.config));
        }

        // Test the updated source
        try {
          const testResult = await withSpinner(
            'Testing updated source...',
            () => api.testSource(sourceId)
          );
          console.log(chalk.green('Connection test: Success'));
          if (testResult.details) {
            console.log(chalk.gray(`Details: ${testResult.details}`));
          }
        } catch (error) {
          console.log(chalk.red('Connection test: Failed'));
          console.log(chalk.red(`Error: ${error.response?.data?.error || error.message}`));
        }
      } catch (error) {
        logError(error, 'Edit Source Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  sources
    .command('remove')
    .description('Remove an existing source')
    .action(async () => {
      try {
        const sources = await withSpinner(
          'Fetching sources...',
          () => api.listSources()
        );

        const sourceId = await selectSource(sources, 'Select source to remove:');
        if (!sourceId) return;

        const source = sources.find(s => s._id === sourceId);
        const confirmed = await confirmAction(
          `Are you sure you want to remove this source?\nType: ${source.type}\nPath: ${source.config.path}\nThis action cannot be undone!`
        );

        if (!confirmed) {
          console.log(chalk.yellow('Operation cancelled.'));
          return;
        }

        await withSpinner(
          'Removing source...',
          () => api.deleteSource(sourceId)
        );
        
        console.log(chalk.green('Source removed successfully'));
      } catch (error) {
        logError(error, 'Remove Source Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
}