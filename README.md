# cc-skills-usage

A CLI tool for analyzing and visualizing Claude Code skill usage.

Scans JSONL conversation history stored in `~/.claude/projects/`, and aggregates skill invocation counts, per-project usage, token consumption, daily trends, and more.

## Requirements

- [Bun](https://bun.sh/)

## Usage

```bash
bun src/index.ts
```

### Options

| Flag | Short | Description |
|---|---|---|
| `--output <mode>` | `-o` | Output mode: `terminal` (default) or `web` |
| `--from <date>` | | Start date filter (YYYY-MM-DD) |
| `--to <date>` | | End date filter (YYYY-MM-DD) |
| `--project <name>` | `-p` | Filter by project name (partial match) |
| `--skill <name>` | `-s` | Filter by skill name |
| `--port <number>` | | Web server port (default: 3939) |
| `--claude-dir <path>` | | Override `~/.claude` path |
| `--limit <number>` | `-n` | Number of recent invocations to display (default: 50) |
| `--help` | `-h` | Show help |

### Examples

```bash
# Display in terminal
bun src/index.ts

# Display as web dashboard (automatically opens browser)
bun src/index.ts --output web

# Filter by date range and skill name
bun src/index.ts --from 2025-06-01 --to 2025-06-30 --skill review-pr

# Check usage for a specific project
bun src/index.ts --project my-app
```

## Skill Detection

Skill invocations are detected through two mechanisms:

1. **Skill tool_use** — `tool_use` blocks (`name: "Skill"`) in assistant messages
2. **Slash commands** — `<command-name>` tags in user messages (e.g., `/example-skill`, `/review-pr`)

Built-in CLI commands (`/help`, `/clear`, etc.) are excluded. When the same skill is detected by both mechanisms, duplicates are removed.
