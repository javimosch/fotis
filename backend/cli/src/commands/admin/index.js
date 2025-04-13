import { sourceCommands } from './sources.js';
import { indexingCommands } from './indexing.js';
import { thumbnailCommands } from './thumbnails.js';
import { deduplicationCommands } from './deduplication.js';

export function adminCommands(program) {
  const admin = program.command('admin');

  // Initialize source commands
  const sources = admin.command('sources');
  sourceCommands(program, sources);

  // Initialize indexing commands
  const indexing = admin.command('index');
  indexingCommands(program, indexing);

  // Initialize thumbnail commands
  const thumbnails = admin.command('thumbnails')
    .description('Manage thumbnail generation');
  thumbnailCommands(program, thumbnails);

  // Initialize deduplication commands
  const dedupe = admin.command('dedupe')
    .description('Manage media deduplication');
  deduplicationCommands(program, dedupe);
}