# cc-skills-usage

A CLI tool for analyzing and visualizing Claude Code skill usage.

Scans JSONL conversation history stored in `~/.claude/projects/`, and aggregates skill invocation counts, per-project usage, token consumption, daily trends, and more.

## Requirements

- [Bun](https://bun.sh/)

## Usage

```bash
bunx cc-skills-usage@latest
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
bunx cc-skills-usage@latest

# Display as web dashboard (automatically opens browser)
bunx cc-skills-usage@latest --output web

# Filter by date range and skill name
bunx cc-skills-usage@latest --from 2025-06-01 --to 2025-06-30 --skill review-pr

# Check usage for a specific project
bunx cc-skills-usage@latest --project my-app
```

## Claude Code Skills

This package ships two Claude Code skills that can be invoked as slash commands.

| Skill | Command | Description |
|---|---|---|
| **cc-skills-usage** | `/cc-skills-usage` | Run the analyzer and display skill usage stats directly in your Claude Code session |
| **analyze-skill** | `/analyze-skill <name>` | Analyze a specific skill's usage data, identify missed triggers, and suggest improvements to its SKILL.md |

### Install

```bash
bunx skills add shinyaigeek/cc-skills-usage/skills/cc-skills-usage
bunx skills add shinyaigeek/cc-skills-usage/skills/analyze-skill
```

## Skill Detection

Skill invocations are detected through two mechanisms:

1. **Skill tool_use** — `tool_use` blocks (`name: "Skill"`) in assistant messages
2. **Slash commands** — `<command-name>` tags in user messages (e.g., `/example-skill`, `/review-pr`)

Built-in CLI commands (`/help`, `/clear`, etc.) are excluded. When the same skill is detected by both mechanisms, duplicates are removed.
