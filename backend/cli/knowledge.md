# Fotis CLI Knowledge

## Project Overview
- Command-line interface for Fotis backend API
- Built with Commander.js
- ES modules (type: "module")
- Global installation via npm link as 'fotis'

## Key Components
- **Commands**: Organized in media.js and admin.js
- **Configuration**: Uses 'conf' package for persistent settings
- **API Client**: Axios-based client in api.js
- **Logger**: Custom error logging to stderr.log

## Configuration Storage
- Linux: ~/.config/fotis-cli/config.json
- macOS: ~/Library/Preferences/fotis-cli/config.json
- Windows: %APPDATA%/fotis-cli/Config/config.json

## Default Settings
- API URL: http://localhost:3001
- Output Directory: ~/fotis-thumbnails

## Command Structure
- media
  - list: Paginated media listing
  - thumb: Download thumbnails
- admin
  - sources: Manage media sources
  - index: Control indexing operations

## Development Guidelines
- Use ora for progress spinners
- Use chalk for colored output
- Include --json option for machine-readable output
- Log errors to stderr.log with context
- Use inquirer for interactive prompts
- Always provide --help documentation

## Error Handling
- Log detailed error info for API failures
- Include Axios error details when available
- Use exit code 1 for failures
- Show debug info with --debug flag

## Dependencies
- commander: CLI framework
- axios: API client
- chalk: Terminal styling
- ora: Spinners
- conf: Configuration
- inquirer: Interactive prompts