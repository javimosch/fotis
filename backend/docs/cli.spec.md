# 🎮 Fotis POC CLI Specification

## Overview

Command-line interface for testing and interacting with the Fotis POC backend API. Located at `backend/cli`, this tool provides commands to test all available endpoints without needing the frontend.

## Installation

```bash
cd backend/cli
npm install
npm link # Makes the CLI globally available as 'fotis'
```

## Commands Structure

### Media Commands

```bash
# List media with pagination
fotis media list [--offset=0] [--limit=50] [--year=2024] [--month=1]

# Get thumbnail for a specific media item
fotis media thumb <hash> [--output=./thumb.jpg]
```

### Admin Commands

```bash
# Sources management
fotis admin sources list
fotis admin sources add --type=local --path=/path/to/media
fotis admin sources add --type=sftp --host=example.com --user=user --pass=pass --path=/remote/path

# Indexing
fotis admin index start --source-id=123
fotis admin index status --source-id=123
```

## Project Structure

```
backend/cli/
├── package.json
├── src/
│   ├── index.js        # CLI entry point
│   ├── commands/       # Command implementations
│   │   ├── media.js
│   │   └── admin.js
│   ├── lib/           # Shared utilities
│   │   ├── api.js     # API client
│   │   └── config.js  # CLI configuration
│   └── utils/         # Helper functions
└── README.md
```

## Dependencies

```json
{
  "dependencies": {
    "commander": "^11.0.0",    // CLI framework
    "axios": "^1.6.2",         // HTTP client
    "chalk": "^5.3.0",         // Terminal colors
    "ora": "^7.0.1",          // Spinner animations
    "conf": "^11.0.2",        // Configuration storage
    "inquirer": "^9.2.12"     // Interactive prompts
  }
}
```

## Configuration

The CLI will store its configuration in:
- Linux: `~/.config/fotis-cli/config.json`
- macOS: `~/Library/Preferences/fotis-cli/config.json`
- Windows: `%APPDATA%/fotis-cli/Config/config.json`

Configuration includes:
- API endpoint URL
- Default output directory for thumbnails
- Authentication tokens (if implemented)

## Features

1. **Interactive Mode**
   - When running commands without required parameters, prompt for input
   - Support for saving common parameters as defaults

2. **Output Formats**
   - Default: Human-readable formatted output
   - `--json` flag for machine-readable JSON output
   - `--quiet` flag for minimal output

3. **Error Handling**
   - Clear error messages with suggested fixes
   - Different exit codes for different error types
   - Debug mode with verbose logging (`--debug` flag)

4. **Progress Indicators**
   - Spinners for long-running operations
   - Progress bars for file operations
   - Clear success/failure indicators

## Example Usage Scenarios

```bash
# List recent media
fotis media list --limit=10

# Add a local source and start indexing
fotis admin sources add --type=local --path=/home/user/photos
fotis admin index start --source-id=123

# Monitor indexing progress
fotis admin index status --source-id=123 --watch

# Export all thumbnails from a specific year
fotis media list --year=2023 --json | \
  jq -r '.[].hash' | \
  xargs -I {} fotis media thumb {} --output=./thumbs/{}.jpg
```

## Development Guidelines

1. **Command Structure**
   - Use nested commands (e.g., `media list` instead of `list-media`)
   - Consistent parameter naming across commands
   - Support both flags and positional arguments where appropriate

2. **Testing**
   - Each command should have unit tests
   - Integration tests with mock API responses
   - End-to-end tests with actual API calls

3. **Documentation**
   - Built-in help for all commands (`--help`)
   - Examples in help text
   - Markdown documentation for each command group

4. **Error Codes**

| Code | Meaning |
|------|---------|
| 0    | Success |
| 1    | General error |
| 2    | Invalid arguments |
| 3    | API error |
| 4    | Network error |
| 5    | Configuration error |

## Future Enhancements

1. Command completion for shells
2. Watch mode for media listings
3. Batch operations support
4. Plugin system for custom commands
5. Authentication support
6. Offline mode with local caching