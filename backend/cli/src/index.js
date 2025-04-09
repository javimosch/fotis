#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { mediaCommands } from './commands/media.js';
import { adminCommands } from './commands/admin.js';
import { loadConfig } from './lib/config.js';
import { logError } from './utils/logger.js';

const program = new Command();

// Load configuration
const config = loadConfig();

// Setup basic program information
program
  .name('fotis')
  .description('CLI for interacting with Fotis POC backend')
  .version('1.0.0');

// Add all commands
mediaCommands(program);
adminCommands(program);

// Global options
program
  .option('--json', 'Output in JSON format')
  .option('--quiet', 'Minimal output')
  .option('--debug', 'Show debug information');

// Error handling
program.showHelpAfterError();

// Parse arguments
try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(chalk.red('Error:'), error.message);
  logError(error, 'CLI Main Process');
  if (program.opts().debug) {
    console.error(error);
  }
  process.exit(1);
}