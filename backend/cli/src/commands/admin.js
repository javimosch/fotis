import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as api from '../lib/api.js';
import { logError } from '../utils/logger.js';

// Helper function to format bytes (copied from backend utils - keep it DRY later if possible)
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
}

export function adminCommands(program) {
  const admin = program.command('admin');

  // --- Sources management ---
  const sources = admin.command('sources');

  sources
    .command('test')
    .description('Test connection to all configured sources')
    .action(async () => {
      const spinner = ora('Testing sources...').start();
      try {
        const sources = await api.listSources();
        spinner.stop();
        
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
        spinner.fail('Failed to test sources');
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
      const spinner = ora('Fetching sources...').start();
      try {
        const result = await api.listSources();
        spinner.stop();

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
            // Display config nicely
            console.log(`  Config:`);
            for (const [key, value] of Object.entries(source.config)) {
              // Mask password
              const displayValue = key === 'pass' ? '********' : value;
              console.log(`    ${key}: ${displayValue}`);
            }
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
    .option('--path <path>', 'Path to media files (local or remote)')
    .option('--host <host>', 'SFTP host')
    .option('--port <port>', 'SFTP port (default: 22)')
    .option('--user <username>', 'SFTP username')
    .option('--pass <password>', 'SFTP password')
    .action(async (options) => {
      let config;
      let type = options.type;

      try {
        if (!type) {
          const answer = await inquirer.prompt([{
            type: 'list',
            name: 'type',
            message: 'Select source type:',
            choices: ['local', 'sftp']
          }]);
          type = answer.type;
        }

        if (type === 'local') {
          let path = options.path;
          if (!path) {
            const answer = await inquirer.prompt([{
              type: 'input',
              name: 'path',
              message: 'Enter local path:'
            }]);
            path = answer.path;
          }
          if (!path) {
             console.error(chalk.red('Error: Local path is required.'));
             process.exit(1);
          }
          config = { path: path };
        } else if (type === 'sftp') {
          const questions = [
            { type: 'input', name: 'host', message: 'Enter SFTP host:', when: !options.host },
            { type: 'input', name: 'port', message: 'Enter SFTP port:', default: '22', when: !options.port,
              validate: (value) => /^\d+$/.test(value) && parseInt(value) > 0 && parseInt(value) < 65536 || 'Invalid port number' },
            { type: 'input', name: 'user', message: 'Enter SFTP username:', when: !options.user },
            { type: 'password', name: 'pass', message: 'Enter SFTP password:', mask: '*', when: !options.pass },
            { type: 'input', name: 'path', message: 'Enter remote path:', when: !options.path }
          ];
          const answers = await inquirer.prompt(questions.filter(q => q.when !== false)); // Only ask if not provided
          // Merge provided options and answers
          const sftpOpts = { ...options, ...answers };

          if (!sftpOpts.host || !sftpOpts.user || !sftpOpts.pass || !sftpOpts.path) {
             console.error(chalk.red('Error: SFTP requires host, user, password, and path.'));
             process.exit(1);
          }
          config = {
            host: sftpOpts.host,
            port: parseInt(sftpOpts.port || '22'),
            user: sftpOpts.user,
            pass: sftpOpts.pass,
            path: sftpOpts.path
          };
        } else {
           console.error(chalk.red(`Error: Invalid source type '${type}'. Use 'local' or 'sftp'.`));
           process.exit(1);
        }

        const spinner = ora('Adding source...').start();
        try {
          const result = await api.addSource(type, config);
          spinner.succeed('Source added successfully');
          if (program.opts().json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(chalk.cyan(`\nSource ID: ${result._id}`)); // Use _id from returned object
            console.log(chalk.bold('\nSource Configuration:'));
            console.log(`Type: ${result.type}`);
            for (const [key, value] of Object.entries(result.config)) {
              const displayValue = key === 'pass' ? '********' : value;
              console.log(`  ${key}: ${displayValue}`);
            }
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
        // Catch errors from inquirer or validation
        logError(error, 'Add Source Command Error');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  // --- Indexing commands ---
  const indexing = admin.command('index');

  indexing
    .command('start')
    .description('Start indexing for a source')
    .requiredOption('--source-id <id>', 'Source ID to index')
    .action(async (options) => {
      const spinner = ora('Requesting indexing start...').start();
      try {
        const sourceId = options.sourceId;
        const result = await api.startIndexing(sourceId);
        spinner.succeed(`Indexing requested for source ${sourceId}. Status: ${result.message}`);
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
    .description('Get indexing status for a source')
    .requiredOption('--source-id <id>', 'Source ID to check')
    .option('--watch', 'Watch for status changes (updates every 5s)')
    .action(async (options) => {
      const sourceId = options.sourceId;
      let isWatching = options.watch;
      let spinner;

      const checkStatus = async () => {
        try {
          if (!isWatching && !spinner) spinner = ora(`Fetching status for source ${sourceId}...`).start();
          const status = await api.getIndexingStatus(sourceId);
          if (spinner) spinner.stop();

          if (program.opts().json) {
            console.log(JSON.stringify(status, null, 2));
          } else {
            if (isWatching) console.clear(); // Clear screen in watch mode
            console.log(chalk.bold(`\nIndexing Status (Source: ${sourceId}):`));
            console.log(chalk.cyan(`• Is Indexing: ${status.isIndexing ? 'Yes' : 'No'}`));
            console.log(`• Total Files in DB: ${status.totalFiles}`);
            console.log(`• Last Run Processed: ${status.processedFiles ?? 'N/A'}`);
            if (status.lastIndexed) {
              console.log(`• Last Run Started: ${new Date(status.lastIndexed).toLocaleString()}`);
              console.log(`• Last Run Status: ${status.lastStatus || 'unknown'}`);
              if (status.lastDurationMs) console.log(`• Last Run Duration: ${status.lastDurationMs}ms`);
              if (status.lastError) console.log(chalk.red(`• Last Run Error: ${status.lastError}`));
            } else {
              console.log(chalk.yellow('• No indexing history found for this source.'));
            }
          }
          // Return true if still indexing, false otherwise (for watch loop)
          return status.isIndexing;
        } catch (error) {
          if (spinner) spinner.fail('Failed to fetch status');
          else console.error(chalk.red('Error fetching status.'));
          logError(error, 'Check Indexing Status Command');
          if (program.opts().debug) {
            console.error(error);
          }
          // Stop watching on error
          if (isWatching) throw error; // Re-throw to exit watch loop
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
               await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            } else {
               console.log(chalk.green('\nIndexing finished.'));
            }
          }
        } catch (error) {
          // Error already logged in checkStatus
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
      const spinner = ora('Fetching indexing history...').start();
      try {
        const history = await api.getIndexingHistory(options.sourceId);
        spinner.stop();

        if (program.opts().json) {
          console.log(JSON.stringify(history, null, 2));
        } else {
          console.log(chalk.bold(`\nIndexing History (Source: ${options.sourceId}):`));
          if (history.length === 0) {
            console.log(chalk.yellow('\nNo indexing history found for this source.'));
          } else {
            history.forEach(entry => {
              const statusColor = entry.status === 'completed' ? chalk.green : chalk.red;
              console.log(chalk.cyan(`\n• Run Started: ${new Date(entry.timestamp).toLocaleString()}`));
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
        spinner.fail('Failed to fetch indexing history');
        logError(error, 'Indexing History Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  // --- Thumbnail generation commands ---
  const thumbnails = admin.command('thumbnails')
    .description('Manage thumbnail generation');

  thumbnails
    .command('status')
    .description('Show current thumbnail generation status')
    .option('--watch', 'Watch for status changes (updates every 5s)')
    .action(async (options) => {
       const isWatching = options.watch;
       let spinner;

       const checkStatus = async () => {
         try {
           if (!isWatching && !spinner) spinner = ora('Fetching thumbnail status...').start();
           const status = await api.getThumbnailStatus();
           if (spinner) spinner.stop();

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
               console.log(`• Last Run Event: ${new Date(status.lastEvent).toLocaleString()}`);
             }
           }
           return status.isGenerating || status.pendingCount > 0; // Keep watching if generating or pending
         } catch (error) {
           if (spinner) spinner.fail('Failed to fetch status');
           else console.error(chalk.red('Error fetching status.'));
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
               await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
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
            console.log(chalk.yellow('\nNo matching thumbnail generation history found.'));
          } else {
            history.forEach(entry => {
              const statusColor = entry.status === 'success' ? chalk.green : chalk.red;
              console.log(chalk.cyan(`\n• ${new Date(entry.timestamp).toLocaleString()}`));
              console.log(`  Media ID: ${entry.mediaId}`);
              console.log(`  Source ID: ${entry.sourceId}`);
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
    .description('Trigger thumbnail generation (marks pending and runs cycle)')
    .option('--source-id <id>', 'Generate thumbnails only for a specific source')
    .option('--year <year>', 'Generate thumbnails only for media from a specific year')
    .action(async (options) => {
      const spinner = ora('Requesting thumbnail generation...').start();
      try {
        const result = await api.triggerThumbnailGeneration(options.sourceId, options.year);
        spinner.succeed(`Thumbnail generation requested. Status: ${result.message}`);
      } catch (error) {
        spinner.fail('Failed to trigger thumbnail generation');
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
      let spinner;

      const checkStatus = async () => {
        try {
          if (!isWatching && !spinner) {
            spinner = ora('Fetching pruning status...').start();
          }
          const status = await api.getThumbnailPruningStatus();
          if (spinner) spinner.stop();

          if (program.opts().json) {
            console.log(JSON.stringify(status, null, 2));
          } else {
            if (isWatching) console.clear();
            console.log(chalk.bold('\nThumbnail Pruning Status:'));
            console.log(chalk.cyan(`• Currently Pruning: ${status.isPruning ? 'Yes' : 'No'}`));
            
            if (status.lastRun) {
              console.log(`• Last Run: ${new Date(status.lastRun.timestamp).toLocaleString()}`);
              console.log(`• Last Status: ${status.lastRun.status}`);
              console.log(`• Files Checked: ${status.lastRun.processedCount}`);
              console.log(`• Invalid Entries Removed: ${status.lastRun.removedCount}`);
              console.log(`• Duration: ${status.lastRun.duration}ms`);

              // Display detailed statistics if available
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
          if (spinner) spinner.fail('Failed to fetch status');
          else console.error(chalk.red('Error fetching status.'));
          logError(error, 'Thumbnail Pruning Status Command');
          if (program.opts().debug) {
            console.error(error);
          }
          if (isWatching) throw error;
          else process.exit(1);
        }
      };

      try {
        // First trigger the pruning
        const spinner = ora('Starting thumbnail pruning...').start();
        await api.startThumbnailPruning();
        spinner.succeed('Thumbnail pruning started');

        if (isWatching) {
          console.log(chalk.yellow('\nWatching pruning progress (Ctrl+C to stop)...'));
          let isPruning = true;
          while (isPruning) {
            isPruning = await checkStatus();
            if (isPruning) {
              await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
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
      const spinner = ora('Fetching thumbnail statistics...').start();
      try {
        const stats = await api.getThumbnailStats();
        spinner.stop();

        if (program.opts().json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          // Overall stats
          console.log(chalk.bold('\nOverall Thumbnail Statistics:'));
          const overall = stats.overall;
          console.log(`• Total Media Items: ${overall.total}`);
          console.log(`• With Thumbnails: ${overall.withThumbs} (${((overall.withThumbs / overall.total) * 100).toFixed(1)}%)`);
          console.log(`• Pending Generation: ${overall.pending}`);
          console.log(`• Failed (Max Attempts): ${overall.failed}`);
          console.log(`• Missing/Not Generated: ${overall.total - overall.withThumbs - overall.pending - overall.failed}`);

          // Stats by source
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
        spinner.fail('Failed to fetch thumbnail statistics');
        logError(error, 'Thumbnail Stats Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  // --- Deduplication commands ---
  const dedupe = admin.command('dedupe')
    .description('Manage media deduplication');

  dedupe
    .command('start')
    .description('Start the deduplication cleanup process')
    .action(async () => {
      const spinner = ora('Requesting deduplication start...').start();
      try {
        const result = await api.startDeduplication();
        spinner.succeed(`Deduplication process requested. Status: ${result.message}`);
      } catch (error) {
        spinner.fail('Failed to start deduplication');
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
      const spinner = ora('Fetching deduplication status...').start();
      try {
        const status = await api.getDeduplicationStatus();
        spinner.stop();

        if (program.opts().json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          console.log(chalk.bold('\nDeduplication Status:'));
          console.log(chalk.cyan(`• Currently Cleaning: ${status.isCleaning ? 'Yes' : 'No'}`));
          console.log(`• Last Run Status: ${status.status}`);
          if (status.startTime) {
            console.log(`• Last Run Started: ${new Date(status.startTime).toLocaleString()}`);
          }
          if (status.endTime) {
            console.log(`• Last Run Ended: ${new Date(status.endTime).toLocaleString()}`);
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
        spinner.fail('Failed to fetch deduplication status');
        logError(error, 'Deduplication Status Command');
        if (program.opts().debug) {
          console.error(error);
        }
        process.exit(1);
      }
    });
}