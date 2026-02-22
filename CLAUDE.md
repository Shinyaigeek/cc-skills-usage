# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-skills-usage is a Claude Code skill usage analytics tool. It scans Claude Code's JSONL project history (`~/.claude/projects/`), detects skill invocations (both direct Skill tool_use calls and slash command triggers like `/devg`), aggregates statistics, and renders results as either a terminal report or an interactive web dashboard.

## Commands

```bash
# Run the analyzer
bun src/index.ts

# Run in watch mode during development
bun --watch src/index.ts

# CLI options
bun src/index.ts --web              # Launch web dashboard (default: terminal)
bun src/index.ts --from 2025-01-01  # Filter by start date
bun src/index.ts --to 2025-12-31    # Filter by end date
bun src/index.ts --project foo      # Filter by project name
bun src/index.ts --skill review-pr  # Filter by skill name
bun src/index.ts --port 8080        # Custom port for web server
bun src/index.ts --claude-dir /path # Custom Claude directory
```

No build step is required — Bun executes TypeScript directly. There are no tests or linting configured.

## Architecture

The codebase follows a **pipeline architecture** with four stages:

1. **Skills Registry** (`src/skills.ts`) — Reads registered skills from `~/.claude/skills/` directory (supports symlinks)
2. **Scanner** (`src/scanner.ts`) — Parses JSONL message files, detects skill calls via two mechanisms: Skill tool_use in assistant messages and `<command-name>` tags in user messages. Uses `grep` pre-filtering for performance. Filters out 26 builtin CLI commands. Deduplicates when the same skill is detected by both mechanisms.
3. **Analyzer** (`src/analyzer.ts`) — Aggregates statistics by skill, project, date, and token usage. Applies CLI filters.
4. **Renderers** (`src/renderers/`) — Terminal renderer for CLI output; Web renderer serves an HTML dashboard with embedded Chart.js visualizations and auto-opens the browser.

Data flows: `index.ts` → `skills.ts` → `scanner.ts` → `analyzer.ts` → `renderers/`

## Key Types

Defined in `src/types.ts`:
- `MinimalMessage` — Parsed JSONL message with UUID ancestry, content, tool use, and token usage
- `SkillCall` — Extracted skill invocation with metadata (skill name, args, project, session, trigger text, tokens)
- `AnalysisResult` — Complete aggregated output consumed by renderers

## Runtime

- **Bun** is the runtime (not Node.js). Uses `bun-types` for type definitions.
- **Zero npm dependencies** — relies on Node.js built-ins (`node:os`, `node:path`, `node:fs/promises`, `node:child_process`, `node:util`) and Bun APIs.
- ES modules only (`"type": "module"` in package.json).
