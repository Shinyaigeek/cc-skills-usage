#!/usr/bin/env bun
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { CliOptions } from "@cc-skills-usage/core";
import { getRegisteredSkills, scanSkillCalls, scanConversations, analyze } from "@cc-skills-usage/core";
import { renderTerminal } from "./terminal.js";

function printHelp(): void {
  console.log(`
cc-skills-usage — Analyze Claude Code skill usage

Usage: bun src/index.ts [options]

Options:
  --output, -o <mode>     "terminal" (default) or "web"
  --from <date>           Start date filter (YYYY-MM-DD)
  --to <date>             End date filter (YYYY-MM-DD)
  --project, -p <name>    Project path partial match filter
  --skill, -s <name>      Skill name filter
  --port <number>         Web server port (default: 3939)
  --claude-dir <path>     Override ~/.claude location
  --limit, -n <number>    Number of recent calls to show (default: 50)
  --conversations         Include all conversation data (not just skill calls)
  --help, -h              Show this help
`);
}

function parseCli(): CliOptions {
  const { values } = parseArgs({
    options: {
      output: { type: "string", short: "o", default: "terminal" },
      from: { type: "string" },
      to: { type: "string" },
      project: { type: "string", short: "p" },
      skill: { type: "string", short: "s" },
      port: { type: "string", default: "3939" },
      "claude-dir": { type: "string" },
      limit: { type: "string", short: "n", default: "50" },
      conversations: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const output = values.output as string;
  if (output !== "terminal" && output !== "web") {
    console.error(`Invalid output mode: ${output}. Use "terminal" or "web".`);
    process.exit(1);
  }

  return {
    output: output as "terminal" | "web",
    from: values.from as string | undefined,
    to: values.to as string | undefined,
    project: values.project as string | undefined,
    skill: values.skill as string | undefined,
    port: parseInt(values.port as string, 10),
    claudeDir: (values["claude-dir"] as string) ?? join(homedir(), ".claude"),
    limit: parseInt(values.limit as string, 10),
    conversations: !!values.conversations,
  };
}

async function main(): Promise<void> {
  const opts = parseCli();

  console.log("\x1b[2mScanning skill calls...\x1b[0m");

  const [skills, calls] = await Promise.all([
    getRegisteredSkills(opts.claudeDir),
    scanSkillCalls(opts.claudeDir),
  ]);

  console.log(
    `\x1b[2mFound ${calls.length} skill calls across ${new Set(calls.map((c) => c.sessionId)).size} sessions\x1b[0m`,
  );

  let conversations;
  if (opts.conversations) {
    console.log("\x1b[2mScanning all conversations...\x1b[0m");
    conversations = await scanConversations(opts.claudeDir);
    console.log(`\x1b[2mFound ${conversations.length} total sessions\x1b[0m`);
  }

  const result = analyze(calls, skills, opts, conversations);

  if (opts.output === "terminal") {
    renderTerminal(result);
  } else {
    const { renderWeb } = await import("@cc-skills-usage/web");
    await renderWeb(result, opts.port);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
