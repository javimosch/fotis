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
  - sources
    - list: List all configured sources
    - add: Add new source
      - --type: Source type (local or sftp)
      - --path: Path to media files
      - --host: SFTP host (for sftp type)
      - --port: SFTP port (default: 22, for sftp type)
      - --user: SFTP username (for sftp type)
      - --pass: SFTP password (for sftp type)
  - index: Control indexing operations
  - thumbnails: Manage thumbnail generation
    - status: Show generation status (--watch for live updates)
    - history: View generation history with filters
    - generate: Trigger thumbnail generation

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

## Example Commands

```bash
# Add local source
fotis admin sources add --type=local --path=/path/to/photos

# Add SFTP source with custom port
fotis admin sources add --type=sftp --host=sftp.example.com --port=2222 --user=username --pass=password --path=/remote/photos

# Check thumbnail generation status
fotis admin thumbnails status --watch

# View thumbnail generation history
fotis admin thumbnails history --status=failed --from=2024-01-01

# Trigger thumbnail generation for a source
fotis admin thumbnails generate --source-id=123
```