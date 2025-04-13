# CLI Admin Commands Refactoring Plan

## Current Issues
- `admin.js` is over 1000 lines long
- Multiple command groups mixed in one file
- Complex command logic not separated by domain
- Difficult to maintain and extend

## Modularization Strategy

### 1. Create Command Group Modules

Split into domain-specific command modules:
- `commands/admin/sources.js`: Source management commands
- `commands/admin/indexing.js`: Indexing related commands
- `commands/admin/thumbnails.js`: Thumbnail management commands
- `commands/admin/deduplication.js`: Deduplication commands

### 2. Create Shared Utilities

Extract common functionality:
- `commands/admin/utils/spinners.js`: Spinner management
- `commands/admin/utils/formatters.js`: Output formatting
- `commands/admin/utils/prompts.js`: Interactive prompts

### 3. Implementation Steps

1. **Create Base Structure**
   ```
   backend/cli/src/commands/admin/
   ├── index.js           # Main entry point
   ├── sources.js         # Source commands
   ├── indexing.js        # Indexing commands
   ├── thumbnails.js      # Thumbnail commands
   ├── deduplication.js   # Deduplication commands
   └── utils/
       ├── spinners.js    # Spinner utilities
       ├── formatters.js  # Output formatting
       └── prompts.js     # Interactive prompts
   ```

2. **Move Commands**
   - Move source commands (list, add, edit, remove, test) to `sources.js`
   - Move indexing commands (start, status, history) to `indexing.js`
   - Move thumbnail commands (status, history, generate, prune, stats) to `thumbnails.js`
   - Move deduplication commands (start, status) to `deduplication.js`

3. **Extract Common Utilities**
   - Create spinner wrapper with consistent messaging
   - Extract formatters for bytes, dates, and status colors
   - Create reusable prompt configurations

4. **Update Main Entry Point**
   - Create new `index.js` that imports and registers all command groups
   - Maintain backward compatibility
   - Add proper error handling and logging

### 4. File Size Guidelines

Each file should:
- Not exceed 300 lines
- Focus on a single domain/feature
- Extract complex logic into utilities
- Use composition over inheritance

## Migration Plan

1. **Phase 1: Setup Structure**
   - Create new directory structure
   - Add placeholder files
   - Setup utility modules

2. **Phase 2: Move Commands**
   - Move source commands first (most used)
   - Move indexing commands
   - Move thumbnail commands
   - Move deduplication commands
   - Test each group after moving

3. **Phase 3: Cleanup**
   - Remove old admin.js
   - Update imports
   - Add documentation
   - Verify all commands work

4. **Phase 4: Testing**
   - Test all commands in isolation
   - Test command combinations
   - Verify error handling
   - Check output formatting

## Success Criteria

- All files under 300 lines
- Each file has single responsibility
- Commands work exactly as before
- Error handling remains consistent
- Documentation is updated