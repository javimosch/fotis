import chalk from 'chalk';
import * as api from '../../lib/api.js';
import { logError } from '../../utils/logger.js';
import { withSpinner } from './utils/spinners.js';
import { formatDate } from './utils/formatters.js';

export function indexingCommands(program, indexing) {
  indexing
    .command('start')
    .description('Start indexing for a source')
    .requiredOption('--source-id <id>', 'Source ID to index')
    .action(async (options) => {
      try {
        const result = await withSpinner(
          'Requesting indexing start...',
          () => api.startIndexing(options.sourceId)
        );
        console.log(chalk.green(`Indexing requested for source ${options.sourceId}. Status: ${result.message}`));
      } catch (error) {
        logError(error, 'Start Indexing Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  indexing
    .command('status')
    .description('Get indexing status for a source')
    .requiredOption('--source-id <id>', 'Source ID to check')
    .option('--watch', 'Watch for status changes (updates every 5s)')
    .action(async (options) => {
      const sourceId = options.sourceId;
      let isWatching = options.watch;

      const checkStatus = async () => {
        try {
          const status = await withSpinner(
            `Fetching status for source ${sourceId}...`,
            () => api.getIndexingStatus(sourceId)
          );

          if (program.opts().json) {
            console.log(JSON.stringify(status, null, 2));
          } else {
            if (isWatching) console.clear();
            console.log(chalk.bold(`\nIndexing Status (Source: ${sourceId}):`));
            console.log(chalk.cyan(`• Is Indexing: ${status.isIndexing ? 'Yes' : 'No'}`));
            console.log(`• Total Files in DB: ${status.totalFiles}`);
            console.log(`• Last Run Processed: ${status.processedFiles ?? 'N/A'}`);
            if (status.lastIndexed) {
              console.log(`• Last Run Started: ${formatDate(status.lastIndexed)}`);
              console.log(`• Last Run Status: ${status.lastStatus || 'unknown'}`);
              if (status.lastDurationMs) console.log(`• Last Run Duration: ${status.lastDurationMs}ms`);
              if (status.lastError) console.log(chalk.red(`• Last Run Error: ${status.lastError}`));
            } else {
              console.log(chalk.yellow('• No indexing history found for this source.'));
            }
          }
          return status.isIndexing;
        } catch (error) {
          console.error(chalk.red('Error fetching status.'));
          logError(error, 'Check Indexing Status Command');
          if (program.opts().debug) {
            console.error(error);
          }
          if (isWatching) throw error;
          else process.exit(1);
        }
      };

      if (isWatching) {
        console.log(chalk.yellow(`Watching indexing status for source ${sourceId} (Ctrl+C to stop)...`));
        try {
          let stillIndexing = true;
          while (stillIndexing) {
            stillIndexing = await checkStatus();
            if (stillIndexing) {
               await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
               console.log(chalk.green('\nIndexing finished.'));
            }
          }
        } catch (error) {
          console.error(chalk.red('Exiting watch mode due to error.'));
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
      try {
        const history = await withSpinner(
          'Fetching indexing history...',
          () => api.getIndexingHistory(options.sourceId)
        );

        if (program.opts().json) {
          console.log(JSON.stringify(history, null, 2));
        } else {
          console.log(chalk.bold(`\nIndexing History (Source: ${options.sourceId}):`));
          if (history.length === 0) {
            console.log(chalk.yellow('\nNo indexing history found for this source.'));
          } else {
            history.forEach(entry => {
              const statusColor = entry.status === 'completed' ? chalk.green : chalk.red;
              console.log(chalk.cyan(`\n• Run Started: ${formatDate(entry.timestamp)}`));
              console.log(`  Status: ${statusColor(entry.status)}`);
              console.log(`  Duration: ${entry.durationMs}ms`);
              console.log(`  Total Files Found: ${entry.totalFiles}`);
              console.log(`  Files Processed: ${entry.processedFiles}`);
              if (entry.error) {
                console.log(chalk.red(`  Error: ${entry.error}`));
              }
            });
          }
        }
      } catch (error) {
        logError(error, 'Indexing History Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
}