import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AnalysisResult } from "@cc-skills-usage/core";
import { bar, renderTerminal } from "../terminal.js";

describe("bar", () => {
  test("returns empty string when max is 0", () => {
    expect(bar(5, 0)).toBe("");
  });

  test("returns full bar when value equals max", () => {
    const result = bar(10, 10);
    // Should be 30 full block characters (MAX_BAR_WIDTH)
    expect(result).toBe("█".repeat(30));
  });

  test("returns empty string when value is 0", () => {
    expect(bar(0, 10)).toBe("");
  });

  test("returns partial bar for intermediate values", () => {
    const result = bar(5, 10);
    // ratio = 0.5, fullBlocks = 15
    expect(result).toBe("█".repeat(15));
  });

  test("includes partial block characters", () => {
    // ratio = 1/30, fullBlocks = 1, remainder should produce a partial char
    const result = bar(1, 30);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe("renderTerminal", () => {
  const originalLog = console.log;
  let logOutput: string[];

  beforeEach(() => {
    logOutput = [];
    console.log = mock((...args: unknown[]) => {
      logOutput.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    console.log = originalLog;
  });

  function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
    return {
      totalCalls: 0,
      skillStats: [],
      projectStats: [],
      dailyStats: [],
      tokenStats: [],
      unusedSkills: [],
      recentCalls: [],
      dateRange: { from: "", to: "" },
      ...overrides,
    };
  }

  test("renders summary section", () => {
    renderTerminal(makeResult({ totalCalls: 42 }));
    const output = logOutput.join("\n");
    expect(output).toContain("Summary");
    expect(output).toContain("42");
  });

  test("renders skill usage section", () => {
    renderTerminal(
      makeResult({
        skillStats: [
          { name: "commit", count: 10 },
          { name: "review-pr", count: 5 },
        ],
      }),
    );
    const output = logOutput.join("\n");
    expect(output).toContain("Skill Usage");
    expect(output).toContain("commit");
    expect(output).toContain("review-pr");
  });

  test("renders project breakdown section", () => {
    renderTerminal(
      makeResult({
        projectStats: [
          {
            projectName: "my-project",
            skills: [{ name: "commit", count: 3 }],
            totalCalls: 3,
          },
        ],
      }),
    );
    const output = logOutput.join("\n");
    expect(output).toContain("Project Breakdown");
    expect(output).toContain("my-project");
  });

  test("renders unused skills section", () => {
    renderTerminal(
      makeResult({
        unusedSkills: ["devg", "lint-fix"],
      }),
    );
    const output = logOutput.join("\n");
    expect(output).toContain("Unused Skills");
    expect(output).toContain("devg");
    expect(output).toContain("lint-fix");
  });

  test("renders daily timeline section", () => {
    renderTerminal(
      makeResult({
        dailyStats: [{ date: "2025-06-15", skills: { commit: 3 }, total: 3 }],
      }),
    );
    const output = logOutput.join("\n");
    expect(output).toContain("Daily Timeline");
    expect(output).toContain("2025-06-15");
  });

  test("renders token usage section", () => {
    renderTerminal(
      makeResult({
        tokenStats: [
          {
            skillName: "commit",
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreateTokens: 100,
            cacheReadTokens: 200,
            callCount: 5,
          },
        ],
      }),
    );
    const output = logOutput.join("\n");
    expect(output).toContain("Token Usage");
    expect(output).toContain("commit");
  });

  test("renders conversation overview when present", () => {
    renderTerminal(
      makeResult({
        conversationStats: {
          totalSessions: 10,
          sessionsWithSkills: 3,
          sessionsWithoutSkills: 7,
          projectBreakdown: [],
        },
      }),
    );
    const output = logOutput.join("\n");
    expect(output).toContain("Conversation Overview");
    expect(output).toContain("10");
  });

  test("skips sections with no data", () => {
    renderTerminal(makeResult());
    const output = logOutput.join("\n");
    expect(output).toContain("Summary");
    expect(output).not.toContain("Skill Usage");
    expect(output).not.toContain("Project Breakdown");
    expect(output).not.toContain("Daily Timeline");
    expect(output).not.toContain("Token Usage");
    expect(output).not.toContain("Unused Skills");
  });
});
