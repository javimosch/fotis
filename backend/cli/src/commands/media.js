import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { getOutputDir } from '../lib/config.js';
import * as api from '../lib/api.js';
import { logError } from '../utils/logger.js';

export function mediaCommands(program) {
  const media = program.command('media');

  // List media
  media
    .command('list')
    .description('List media files with pagination and filters')
    .option('--offset <number>', 'Number of items to skip', '0')
    .option('--limit <number>', 'Number of items to return', '50')
    .option('--year <number>', 'Filter by year')
    .option('--month <number>', 'Filter by month (1-12)')
    .action(async (options) => {
      const spinner = ora('Fetching media list...').start();
      try {
        const result = await api.listMedia(options);
        spinner.stop();
        
        if (program.opts().json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.bold('\nMedia items:'));
          result.forEach(item => {
            console.log(chalk.cyan(`\n• Hash: ${item.hash}`));
            console.log(`  Path: ${item.path}`);
            console.log(`  Type: ${item.type}`);
            console.log(`  Date: ${new Date(item.timestamp).toLocaleString()}`);
          });
        }
      } catch (error) {
        spinner.fail('Failed to fetch media list');
        logError(error, 'Media List Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  // Get thumbnail
  media
    .command('thumb <hash>')
    .description('Get thumbnail for a specific media item')
    .option('--output <path>', 'Output file path')
    .action(async (hash, options) => {
      const outputPath = options.output || path.join(getOutputDir(), `${hash}.jpg`);
      const spinner = ora('Downloading thumbnail...').start();
      
      try {
        const stream = await api.getThumb(hash);
        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
        
        stream.pipe(fs.createWriteStream(outputPath))
          .on('finish', () => {
            spinner.succeed(`Thumbnail saved to ${outputPath}`);
          })
          .on('error', (error) => {
            spinner.fail('Failed to save thumbnail');
            logError(error, 'Thumbnail Save Error');
            if (program.opts().debug) {
              console.error(error);
            }
            process.exit(1);
          });
      } catch (error) {
        spinner.fail('Failed to download thumbnail');
        logError(error, 'Thumbnail Download Error');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
}