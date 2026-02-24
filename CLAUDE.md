# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-skills-usage is a Claude Code skill usage analytics tool. It scans Claude Code's JSONL project history (`~/.claude/projects/`), detects skill invocations (both direct Skill tool_use calls and slash command triggers like `/example-skill`), aggregates statistics, and renders results as either a terminal report or an interactive web dashboard.

## Commands

```bash
# Run the analyzer
bun run start
# or directly:
bunx cc-skills-usage

# Run in watch mode during development
bun run dev

# CLI options
bun run start -- --output web       # Launch web dashboard (default: terminal)
bun run start -- --from 2025-01-01  # Filter by start date
bun run start -- --to 2025-12-31    # Filter by end date
bun run start -- --project foo      # Filter by project name
bun run start -- --skill review-pr  # Filter by skill name
bun run start -- --port 8080        # Custom port for web server
bun run start -- --claude-dir /path # Custom Claude directory
```

No build step is required — Bun executes TypeScript directly. Tests are run with `bun test`. No linting is configured.

## Architecture

The project uses **Bun workspaces** with three packages following a **pipeline architecture**:

### Packages

- **`@cc-skills-usage/core`** (`packages/core/`) — Types, skills registry, JSONL scanner, and analyzer
- **`@cc-skills-usage/cli`** (`packages/cli/`) — CLI entry point and terminal renderer
- **`@cc-skills-usage/web`** (`packages/web/`) — Web server and HTML dashboard

### Dependencies

```
cli → core (types, skills, scanner, analyzer)
cli → web  (dynamic import for --output web)
web → core (types)
```

### Pipeline stages

1. **Skills Registry** (`packages/core/src/skills.ts`) — Reads registered skills from `~/.claude/skills/` directory (supports symlinks)
2. **Scanner** (`packages/core/src/scanner.ts`) — Parses JSONL message files, detects skill calls via two mechanisms: Skill tool_use in assistant messages and `<command-name>` tags in user messages. Uses `grep` pre-filtering for performance. Slash commands are matched against the registered skills allowlist (from step 1). Deduplicates when the same skill is detected by both mechanisms.
3. **Analyzer** (`packages/core/src/analyzer.ts`) — Aggregates statistics by skill, project, date, and token usage. Applies CLI filters.
4. **Renderers** — Terminal renderer (`packages/cli/src/terminal.ts`) for CLI output; Web renderer (`packages/web/src/server.ts`) serves an HTML dashboard with embedded Chart.js visualizations and auto-opens the browser.

Data flows: `cli/src/index.ts` → `core` (skills registry → scanner(with registered skill names) → analyzer) → `cli/terminal.ts` or `web/server.ts`

## Key Types

Defined in `packages/core/src/types.ts` (re-exported from `@cc-skills-usage/core`):
- `MinimalMessage` — Parsed JSONL message with UUID ancestry, content, tool use, and token usage
- `SkillCall` — Extracted skill invocation with metadata (skill name, args, project, session, trigger text, tokens)
- `AnalysisResult` — Complete aggregated output consumed by renderers

## Runtime

- **Bun** is the runtime (not Node.js). Uses `bun-types` for type definitions.
- **Zero npm dependencies** — relies on Node.js built-ins (`node:os`, `node:path`, `node:fs/promises`, `node:child_process`, `node:util`) and Bun APIs.
- ES modules only (`"type": "module"` in package.json).
- **Bun workspaces** for monorepo package management (`workspace:*` protocol).
