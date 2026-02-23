---
name: cc-skills-usage
description: Analyze Claude Code skill usage and display results in the terminal. View usage frequency, per-project statistics, token consumption, and more.
argument-hint: "[options]"
---

# cc-skills-usage

Run the CLI analyzer for Claude Code skill usage and display the results.

## How to Run

Execute the following command using the Bash tool:

```bash
bun /Users/shinobu.hayashi/Documents/s9k/cc-skills-usage/packages/cli/src/index.ts [user-specified options]
```

If the user provides arguments, pass them directly to the command. If no arguments are given, run without options.

## Available Options

| Option | Short | Description |
|---|---|---|
| `--from <date>` | | Start date filter (YYYY-MM-DD) |
| `--to <date>` | | End date filter (YYYY-MM-DD) |
| `--project <name>` | `-p` | Partial match filter on project path |
| `--skill <name>` | `-s` | Skill name filter |
| `--output <mode>` | `-o` | `terminal` (default) or `web` |
| `--limit <number>` | `-n` | Number of recent calls to display (default: 50) |
| `--port <number>` | | Web server port (default: 3939) |
| `--conversations` | | Include all session data |
| `--claude-dir <path>` | | Override ~/.claude location |

## Usage Examples

- `/cc-skills-usage` — Show usage stats for all skills
- `/cc-skills-usage --from 2025-06-01` — Usage since June 1st
- `/cc-skills-usage --skill devg` — Usage for the devg skill only
- `/cc-skills-usage --project myapp --from 2025-06-01` — Filter by project and date range
- `/cc-skills-usage --output web` — Open dashboard in browser
- `/cc-skills-usage --conversations` — Detailed analysis including all conversation data

## Notes

- Display the command output as-is to the user. Do not modify or summarize the output.
- When using `--output web`, the browser opens automatically.
