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
        const sourceId = options.sourceId;
        await api.startIndexing(sourceId);
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

  indexing
    .command('history')
    .description('Show indexing history for a source')
    .requiredOption('--source-id <id>', 'Source ID to check')
    .action(async (options) => {
      const spinner = ora('Fetching indexing history...').start();
      try {
        const history = await api.getIndexingHistory(options.sourceId);
        spinner.stop();

        if (program.opts().json) {
          console.log(JSON.stringify(history, null, 2));
        } else {
          console.log(chalk.bold('\nIndexing History:'));
          if (history.length === 0) {
            console.log(chalk.yellow('\nNo indexing history found for this source.'));
          } else {
            history.forEach(entry => {
              console.log(chalk.cyan(`\n• ${new Date(entry.timestamp).toLocaleString()}`));
              console.log(`  Status: ${entry.status}`);
              console.log(`  Total Files: ${entry.totalFiles}`);
              console.log(`  Processed: ${entry.processedFiles}`);
              if (entry.error) {
                console.log(chalk.red(`  Error: ${entry.error}`));
              }
            });
          }
        }
      } catch (error) {
        spinner.fail('Failed to fetch indexing history');
        logError(error, 'Indexing History Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  // New thumbnail generation commands
  const thumbnails = admin.command('thumbnails')
    .description('Manage thumbnail generation');

  thumbnails
    .command('status')
    .description('Show current thumbnail generation status')
    .option('--watch', 'Watch for status changes')
    .action(async (options) => {
      const checkStatus = async () => {
        try {
          const status = await api.getThumbnailStatus();
          if (program.opts().json) {
            console.log(JSON.stringify(status, null, 2));
          } else {
            console.clear();
            console.log(chalk.bold('\nThumbnail Generation Status:'));
            console.log(chalk.cyan(`• Currently Generating: ${status.isGenerating}`));
            console.log(`• Pending Count: ${status.pendingCount}`);
            console.log(`• Failed Count: ${status.failedCount}`);
            console.log(`• CPU Usage: ${status.cpuUsage.toFixed(1)}%`);
            console.log(`• CPU Throttling: ${status.cooldownActive ? 'Active' : 'Inactive'}`);
            if (status.lastRunTime) {
              console.log(`• Last Run: ${new Date(status.lastRunTime).toLocaleString()}`);
            }
          }
          return status.isGenerating;
        } catch (error) {
          logError(error, 'Thumbnail Status Command');
          if (program.opts().debug) {
            console.error(error);
          }
          process.exit(1);
        }
      };

      if (options.watch) {
        console.log(chalk.yellow('Watching thumbnail generation status (Ctrl+C to stop)...'));
        while (true) {
          await checkStatus();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        await checkStatus();
      }
    });

  thumbnails
    .command('history')
    .description('Show thumbnail generation history')
    .option('--source-id <id>', 'Filter by source ID')
    .option('--status <status>', 'Filter by status (success/failed)')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .action(async (options) => {
      const spinner = ora('Fetching thumbnail generation history...').start();
      try {
        const history = await api.getThumbnailHistory({
          sourceId: options.sourceId,
          status: options.status,
          from: options.from,
          to: options.to
        });
        spinner.stop();

        if (program.opts().json) {
          console.log(JSON.stringify(history, null, 2));
        } else {
          console.log(chalk.bold('\nThumbnail Generation History:'));
          if (history.length === 0) {
            console.log(chalk.yellow('\nNo thumbnail generation history found.'));
          } else {
            history.forEach(entry => {
              const statusColor = entry.status === 'success' ? chalk.green : chalk.red;
              console.log(chalk.cyan(`\n• ${new Date(entry.timestamp).toLocaleString()}`));
              console.log(`  Status: ${statusColor(entry.status)}`);
              console.log(`  Duration: ${entry.duration}ms`);
              console.log(`  Input Size: ${formatBytes(entry.input_size)}`);
              if (entry.status === 'success') {
                console.log(`  Output Size: ${formatBytes(entry.output_size)}`);
              }
              console.log(`  Attempt: ${entry.attempt}`);
              if (entry.error) {
                console.log(chalk.red(`  Error: ${entry.error}`));
              }
            });
          }
        }
      } catch (error) {
        spinner.fail('Failed to fetch thumbnail history');
        logError(error, 'Thumbnail History Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  thumbnails
    .command('generate')
    .description('Trigger thumbnail generation')
    .option('--source-id <id>', 'Generate thumbnails for specific source')
    .action(async (options) => {
      const spinner = ora('Triggering thumbnail generation...').start();
      try {
        await api.triggerThumbnailGeneration(options.sourceId);
        spinner.succeed('Thumbnail generation triggered successfully');
      } catch (error) {
        spinner.fail('Failed to trigger thumbnail generation');
        logError(error, 'Thumbnail Generation Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  // Helper function to format bytes (copied from backend utils)
  function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }
}