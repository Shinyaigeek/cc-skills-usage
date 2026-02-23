import type { AnalysisResult } from "@cc-skills-usage/core";

const BAR_CHARS = ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
const MAX_BAR_WIDTH = 30;

function bar(value: number, max: number): string {
  if (max === 0) return "";
  const ratio = value / max;
  const fullBlocks = Math.floor(ratio * MAX_BAR_WIDTH);
  const remainder = (ratio * MAX_BAR_WIDTH - fullBlocks) * 8;
  const partialChar =
    remainder > 0 ? (BAR_CHARS[Math.floor(remainder) - 1] ?? "") : "";
  return "█".repeat(fullBlocks) + partialChar;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function header(title: string): void {
  console.log();
  console.log(`\x1b[1;36m── ${title} ──\x1b[0m`);
  console.log();
}

function dim(s: string): string {
  return `\x1b[2m${s}\x1b[0m`;
}

function bold(s: string): string {
  return `\x1b[1m${s}\x1b[0m`;
}

function cyan(s: string): string {
  return `\x1b[36m${s}\x1b[0m`;
}

function yellow(s: string): string {
  return `\x1b[33m${s}\x1b[0m`;
}

export function renderTerminal(result: AnalysisResult): void {
  // ── Summary ──
  header("Summary");
  console.log(
    `  Total skill calls: ${bold(fmt(result.totalCalls))}    ` +
      `Period: ${cyan(result.dateRange.from || "N/A")} → ${cyan(result.dateRange.to || "N/A")}`,
  );
  console.log(
    `  Unique skills used: ${bold(String(result.skillStats.length))}    ` +
      `Projects: ${bold(String(result.projectStats.length))}`,
  );

  // ── Skill usage ──
  if (result.skillStats.length > 0) {
    header("Skill Usage");
    const maxCount = result.skillStats[0].count;
    const nameWidth = Math.max(
      ...result.skillStats.map((s) => s.name.length),
      10,
    );
    for (const s of result.skillStats) {
      const name = s.name.padEnd(nameWidth);
      const count = String(s.count).padStart(4);
      const b = bar(s.count, maxCount);
      console.log(`  ${cyan(name)}  ${count}  ${b}`);
    }
  }

  // ── Project breakdown ──
  if (result.projectStats.length > 0) {
    header("Project Breakdown");
    for (const p of result.projectStats) {
      console.log(`  ${bold(p.projectName)} (${p.totalCalls} calls)`);
      for (const s of p.skills) {
        console.log(`    ${s.name.padEnd(25)} ${String(s.count).padStart(4)}`);
      }
    }
  }

  // ── Daily timeline ──
  if (result.dailyStats.length > 0) {
    header("Daily Timeline");
    const maxDaily = Math.max(...result.dailyStats.map((d) => d.total));
    for (const d of result.dailyStats) {
      const skills = Object.entries(d.skills)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name}:${count}`)
        .join(", ");
      const b = bar(d.total, maxDaily);
      console.log(
        `  ${dim(d.date)}  ${String(d.total).padStart(3)}  ${b}  ${dim(skills)}`,
      );
    }
  }

  // ── Token usage ──
  if (result.tokenStats.length > 0) {
    header("Token Usage (per skill)");
    const cols = {
      name: Math.max(...result.tokenStats.map((t) => t.skillName.length), 10),
    };
    console.log(
      `  ${"Skill".padEnd(cols.name)}  ${"Calls".padStart(5)}  ${"Input".padStart(10)}  ${"Output".padStart(10)}  ${"Cache Create".padStart(12)}  ${"Cache Read".padStart(12)}`,
    );
    console.log(`  ${"─".repeat(cols.name + 5 + 10 + 10 + 12 + 12 + 10)}`);
    for (const t of result.tokenStats) {
      console.log(
        `  ${t.skillName.padEnd(cols.name)}  ${String(t.callCount).padStart(5)}  ${fmt(t.inputTokens).padStart(10)}  ${fmt(t.outputTokens).padStart(10)}  ${fmt(t.cacheCreateTokens).padStart(12)}  ${fmt(t.cacheReadTokens).padStart(12)}`,
      );
    }
  }

  // ── Unused skills ──
  if (result.unusedSkills.length > 0) {
    header("Unused Skills (registered but never called)");
    for (const name of result.unusedSkills) {
      console.log(`  ${yellow("○")} ${name}`);
    }
  }

  // ── Recent calls ──
  if (result.recentCalls.length > 0) {
    header(`Recent Calls (last ${result.recentCalls.length})`);
    for (const c of result.recentCalls) {
      const ts = c.timestamp.replace("T", " ").slice(0, 19);
      const args = c.args ? dim(` args="${c.args.slice(0, 60)}"`) : "";
      const trigger = c.triggerMessage
        ? dim(` ← "${c.triggerMessage.slice(0, 80)}"`)
        : "";
      console.log(
        `  ${dim(ts)}  ${cyan(c.skillName.padEnd(22))}  ${c.projectPath}${args}${trigger}`,
      );
    }
  }

  // ── Conversation Overview ──
  if (result.conversationStats) {
    const cs = result.conversationStats;
    const rate =
      cs.totalSessions > 0
        ? ((cs.sessionsWithSkills / cs.totalSessions) * 100).toFixed(1)
        : "0.0";

    header("Conversation Overview");
    console.log(
      `  Total sessions: ${bold(fmt(cs.totalSessions))}    ` +
        `With skills: ${bold(fmt(cs.sessionsWithSkills))}    ` +
        `Without skills: ${bold(fmt(cs.sessionsWithoutSkills))}    ` +
        `Adoption rate: ${bold(`${rate}%`)}`,
    );

    if (cs.projectBreakdown.length > 0) {
      console.log();
      const nameWidth = Math.max(
        ...cs.projectBreakdown.map((p) => p.projectName.length),
        10,
      );
      console.log(
        `  ${"Project".padEnd(nameWidth)}  ${"Total".padStart(6)}  ${"Skills".padStart(6)}  ${"No Skills".padStart(9)}  ${"Rate".padStart(6)}`,
      );
      console.log(`  ${"─".repeat(nameWidth + 6 + 6 + 9 + 6 + 8)}`);
      for (const p of cs.projectBreakdown) {
        const pRate =
          p.totalSessions > 0
            ? `${((p.sessionsWithSkills / p.totalSessions) * 100).toFixed(0)}%`
            : "0%";
        console.log(
          `  ${p.projectName.padEnd(nameWidth)}  ${String(p.totalSessions).padStart(6)}  ${String(p.sessionsWithSkills).padStart(6)}  ${String(p.sessionsWithoutSkills).padStart(9)}  ${pRate.padStart(6)}`,
        );
      }
    }
  }

  // ── Recent Sessions Without Skills ──
  if (result.conversations) {
    const noSkills = result.conversations.filter((c) => !c.hasSkillCalls);
    if (noSkills.length > 0) {
      header(`Recent Sessions Without Skills (${noSkills.length})`);
      for (const c of noSkills) {
        const ts = c.lastTimestamp.replace("T", " ").slice(0, 19);
        const preview =
          c.userMessages.length > 0
            ? c.userMessages[0].content.slice(0, 80).replace(/\n/g, " ")
            : "";
        console.log(
          `  ${dim(ts)}  ${c.projectPath.padEnd(30)}  ${dim(`${String(c.userMessageCount)} msgs`)}  ${dim(preview ? `"${preview}"` : "")}`,
        );
      }
    }
  }

  console.log();
}
