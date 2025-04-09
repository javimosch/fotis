# Fotis CLI

Command-line interface for interacting with the Fotis POC backend API.

## Installation

```bash
cd backend/cli
npm install
npm link  # Makes the CLI globally available as 'fotis'
```

## Usage

### Media Commands

List media with pagination:
```bash
fotis media list [--offset=0] [--limit=50] [--year=2024] [--month=1]
```

Get thumbnail for a specific media item:
```bash
fotis media thumb <hash> [--output=./thumb.jpg]
```

### Admin Commands

Sources management:
```bash
# List all sources
fotis admin sources list

# Add a local source
fotis admin sources add --type=local --path=/path/to/media

# Add an SFTP source
fotis admin sources add --type=sftp --host=example.com --user=user --pass=pass --path=/remote/path
```

Indexing:
```bash
# Start indexing
fotis admin index start --source-id=123

# Check indexing status
fotis admin index status --source-id=123

# Watch indexing progress
fotis admin index status --source-id=123 --watch
```

### Global Options

- `--json`: Output in JSON format
- `--quiet`: Minimal output
- `--debug`: Show debug information

## Configuration

The CLI stores its configuration in:
- Linux: `~/.config/fotis-cli/config.json`
- macOS: `~/Library/Preferences/fotis-cli/config.json`
- Windows: `%APPDATA%/fotis-cli/Config/config.json`

Default configuration:
- API endpoint: `http://localhost:3001`
- Output directory: `~/fotis-thumbnails`