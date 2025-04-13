import chalk from 'chalk';
import * as api from '../../lib/api.js';
import { logError } from '../../utils/logger.js';
import { withSpinner } from './utils/spinners.js';
import { formatDate } from './utils/formatters.js';

export function deduplicationCommands(program, dedupe) {
  dedupe
    .command('start')
    .description('Start the deduplication cleanup process')
    .action(async () => {
      try {
        const result = await withSpinner(
          'Requesting deduplication start...',
          () => api.startDeduplication()
        );
        console.log(chalk.green(`Deduplication process requested. Status: ${result.message}`));
      } catch (error) {
        logError(error, 'Start Deduplication Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  dedupe
    .command('status')
    .description('Show current deduplication status and last run info')
    .action(async () => {
      try {
        const status = await withSpinner(
          'Fetching deduplication status...',
          () => api.getDeduplicationStatus()
        );

        if (program.opts().json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          console.log(chalk.bold('\nDeduplication Status:'));
          console.log(chalk.cyan(`• Currently Cleaning: ${status.isCleaning ? 'Yes' : 'No'}`));
          console.log(`• Last Run Status: ${status.status}`);
          if (status.startTime) {
            console.log(`• Last Run Started: ${formatDate(status.startTime)}`);
          }
          if (status.endTime) {
            console.log(`• Last Run Ended: ${formatDate(status.endTime)}`);
          }
          if (status.startTime && status.endTime) {
             const duration = (new Date(status.endTime) - new Date(status.startTime));
             console.log(`• Last Run Duration: ${duration}ms`);
          }
          console.log(`• Hashes with Duplicates Found (Last Run): ${status.hashesProcessed}`);
          console.log(`• Duplicates Removed (Last Run): ${status.duplicatesRemoved}`);
          if (status.error) {
            console.log(chalk.red(`• Last Run Error: ${status.error}`));
          }
        }
      } catch (error) {
        logError(error, 'Deduplication Status Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
}