import chalk from 'chalk';
import * as api from '../../lib/api.js';
import { logError } from '../../utils/logger.js';
import { withSpinner } from './utils/spinners.js';
import { formatBytes, formatDate, formatStatus } from './utils/formatters.js';

export function thumbnailCommands(program, thumbnails) {
  thumbnails
    .command('status')
    .description('Show current thumbnail generation status')
    .option('--watch', 'Watch for status changes (updates every 5s)')
    .action(async (options) => {
      const isWatching = options.watch;

      const checkStatus = async () => {
        try {
          const status = await withSpinner(
            'Fetching thumbnail status...',
            () => api.getThumbnailStatus()
          );

          if (program.opts().json) {
            console.log(JSON.stringify(status, null, 2));
          } else {
            if (isWatching) console.clear();
            console.log(chalk.bold('\nThumbnail Generation Status:'));
            console.log(chalk.cyan(`• Currently Generating: ${status.isGenerating ? 'Yes' : 'No'}`));
            console.log(`• Pending Count: ${status.pendingCount}`);
            console.log(`• Failed Count (Max Attempts): ${status.failedCount}`);
            console.log(`• CPU Usage: ${status.cpuUsage.toFixed(1)}%`);
            console.log(`• CPU Throttling: ${status.cpuThrottling ? 'Active' : 'Inactive'}`);
            console.log(`• Work Ratio: ${status.workRatio} thumbs/sec`);
            console.log(`• Processed Count: ${status.processedCount}`);
            console.log(`• Elapsed Time: ${status.elapsedTime}s`);
            if (status.remainingTime) {
              console.log(chalk.green(`• Remaining Time: ${status.remainingTime}`));
            }
            if (status.estimatedCompletionTime) {
              console.log(chalk.green(`• Estimated Completion: ${status.estimatedCompletionTime}`));
            }
            if (status.lastEvent) {
              console.log(`• Last Run Event: ${formatDate(status.lastEvent)}`);
            }
          }
          return status.isGenerating || status.pendingCount > 0;
        } catch (error) {
          console.error(chalk.red('Error fetching status.'));
          logError(error, 'Thumbnail Status Command');
          if (program.opts().debug) {
            console.error(error);
          }
          if (isWatching) throw error;
          else process.exit(1);
        }
      };

      if (isWatching) {
        console.log(chalk.yellow('Watching thumbnail generation status (Ctrl+C to stop)...'));
        try {
          let keepWatching = true;
          while (keepWatching) {
            keepWatching = await checkStatus();
            if (keepWatching) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
              console.log(chalk.green('\nGeneration idle and no pending items.'));
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

  thumbnails
    .command('history')
    .description('Show thumbnail generation history')
    .option('--source-id <id>', 'Filter by source ID')
    .option('--status <status>', 'Filter by status (success/failed)')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .action(async (options) => {
      try {
        const history = await withSpinner(
          'Fetching thumbnail generation history...',
          () => api.getThumbnailHistory(options)
        );

        if (program.opts().json) {
          console.log(JSON.stringify(history, null, 2));
        } else {
          console.log(chalk.bold('\nThumbnail Generation History:'));
          if (history.length === 0) {
            console.log(chalk.yellow('\nNo matching thumbnail generation history found.'));
          } else {
            history.forEach(entry => {
              console.log(chalk.cyan(`\n• ${formatDate(entry.timestamp)}`));
              console.log(`  Media ID: ${entry.mediaId}`);
              console.log(`  Source ID: ${entry.sourceId}`);
              console.log(`  Status: ${formatStatus(entry.status)}`);
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
        logError(error, 'Thumbnail History Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  thumbnails
    .command('generate')
    .description('Trigger thumbnail generation (marks pending and runs cycle)')
    .option('--source-id <id>', 'Generate thumbnails only for a specific source')
    .option('--year <year>', 'Generate thumbnails only for media from a specific year')
    .action(async (options) => {
      try {
        const result = await withSpinner(
          'Requesting thumbnail generation...',
          () => api.triggerThumbnailGeneration(options.sourceId, options.year)
        );
        console.log(chalk.green(`Thumbnail generation requested. Status: ${result.message}`));
      } catch (error) {
        logError(error, 'Thumbnail Generation Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  thumbnails
    .command('prune')
    .description('Clean up invalid thumbnail entries')
    .option('--watch', 'Watch pruning progress')
    .action(async (options) => {
      const isWatching = options.watch;

      const checkStatus = async () => {
        try {
          const status = await withSpinner(
            'Fetching pruning status...',
            () => api.getThumbnailPruningStatus()
          );

          if (program.opts().json) {
            console.log(JSON.stringify(status, null, 2));
          } else {
            if (isWatching) console.clear();
            console.log(chalk.bold('\nThumbnail Pruning Status:'));
            console.log(chalk.cyan(`• Currently Pruning: ${status.isPruning ? 'Yes' : 'No'}`));
            
            if (status.lastRun) {
              console.log(`• Last Run: ${formatDate(status.lastRun.timestamp)}`);
              console.log(`• Last Status: ${status.lastRun.status}`);
              console.log(`• Files Checked: ${status.lastRun.processedCount}`);
              console.log(`• Invalid Entries Removed: ${status.lastRun.removedCount}`);
              console.log(`• Duration: ${status.lastRun.duration}ms`);

              if (status.lastRun.details && status.lastRun.details.sourceStats) {
                console.log(chalk.bold('\nRemoval Statistics by Source:'));
                for (const [sourceId, stats] of Object.entries(status.lastRun.details.sourceStats)) {
                  console.log(chalk.cyan(`\n• Source: ${sourceId}`));
                  console.log(`  Total Removed: ${stats.total}`);
                  if (stats.file_not_found > 0) {
                    console.log(`  - Missing Files: ${stats.file_not_found}`);
                  }
                  if (stats.missing_thumb_path > 0) {
                    console.log(`  - Missing Thumb Path: ${stats.missing_thumb_path}`);
                  }
                }
              }

              if (status.lastRun.error) {
                console.log(chalk.red(`• Error: ${status.lastRun.error}`));
              }
            } else {
              console.log(chalk.yellow('• No pruning history found.'));
            }
          }
          return status.isPruning;
        } catch (error) {
          console.error(chalk.red('Error fetching status.'));
          logError(error, 'Thumbnail Pruning Status Command');
          if (program.opts().debug) {
            console.error(error);
          }
          if (isWatching) throw error;
          else process.exit(1);
        }
      };

      try {
        await withSpinner(
          'Starting thumbnail pruning...',
          () => api.startThumbnailPruning()
        );
        console.log(chalk.green('Thumbnail pruning started'));

        if (isWatching) {
          console.log(chalk.yellow('\nWatching pruning progress (Ctrl+C to stop)...'));
          let isPruning = true;
          while (isPruning) {
            isPruning = await checkStatus();
            if (isPruning) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
              console.log(chalk.green('\nPruning completed.'));
            }
          }
        } else {
          await checkStatus();
        }
      } catch (error) {
        logError(error, 'Thumbnail Pruning Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  thumbnails
    .command('stats')
    .description('Show thumbnail statistics')
    .action(async () => {
      try {
        const stats = await withSpinner(
          'Fetching thumbnail statistics...',
          () => api.getThumbnailStats()
        );

        if (program.opts().json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log(chalk.bold('\nOverall Thumbnail Statistics:'));
          const overall = stats.overall;
          console.log(`• Total Media Items: ${overall.total}`);
          console.log(`• With Thumbnails: ${overall.withThumbs} (${((overall.withThumbs / overall.total) * 100).toFixed(1)}%)`);
          console.log(`• Pending Generation: ${overall.pending}`);
          console.log(`• Failed (Max Attempts): ${overall.failed}`);
          console.log(`• Missing/Not Generated: ${overall.total - overall.withThumbs - overall.pending - overall.failed}`);

          console.log(chalk.bold('\nBy Source:'));
          stats.bySource.forEach(source => {
            const sourceId = source._id || 'unknown';
            const sourceType = source.source?.type || 'unknown';
            const sourcePath = source.source?.config?.path || 'N/A';
            
            console.log(chalk.cyan(`\n• Source: ${sourceId}`));
            console.log(`  Type: ${sourceType}`);
            console.log(`  Path: ${sourcePath}`);
            console.log(`  Total Items: ${source.total}`);
            console.log(`  With Thumbnails: ${source.withThumbs} (${((source.withThumbs / source.total) * 100).toFixed(1)}%)`);
            console.log(`  Pending Generation: ${source.pending}`);
            console.log(`  Failed (Max Attempts): ${source.failed}`);
            console.log(`  Missing/Not Generated: ${source.total - source.withThumbs - source.pending - source.failed}`);
          });
        }
      } catch (error) {
        logError(error, 'Thumbnail Stats Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
}