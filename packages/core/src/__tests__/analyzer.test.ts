import { describe, expect, test } from "bun:test";
import { analyze } from "../analyzer.js";
import type { CliOptions, Conversation, RegisteredSkill, SkillCall } from "../types.js";

function makeOpts(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    output: "terminal",
    port: 3000,
    claudeDir: "/tmp/.claude",
    limit: 50,
    conversations: false,
    ...overrides,
  };
}

function makeCall(overrides: Partial<SkillCall> = {}): SkillCall {
  return {
    skillName: "commit",
    timestamp: "2025-06-15T10:00:00Z",
    sessionId: "sess-1",
    projectPath: "my-project",
    projectDir: "-Users-dev-Documents-my-project",
    cwd: "/Users/dev/Documents/my-project",
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    sessionId: "sess-1",
    projectDir: "-Users-dev-Documents-my-project",
    projectPath: "my-project",
    firstTimestamp: "2025-06-15T10:00:00Z",
    lastTimestamp: "2025-06-15T10:30:00Z",
    messageCount: 10,
    userMessageCount: 5,
    userMessages: [],
    skillsUsed: ["commit"],
    hasSkillCalls: true,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    ...overrides,
  };
}

describe("analyze", () => {
  describe("filtering", () => {
    test("filters by from date", () => {
      const calls = [
        makeCall({ timestamp: "2025-06-10T10:00:00Z" }),
        makeCall({ timestamp: "2025-06-20T10:00:00Z" }),
      ];
      const result = analyze(calls, [], makeOpts({ from: "2025-06-15" }));
      expect(result.totalCalls).toBe(1);
      expect(result.recentCalls[0].timestamp).toBe("2025-06-20T10:00:00Z");
    });

    test("filters by to date", () => {
      const calls = [
        makeCall({ timestamp: "2025-06-10T10:00:00Z" }),
        makeCall({ timestamp: "2025-06-20T10:00:00Z" }),
      ];
      const result = analyze(calls, [], makeOpts({ to: "2025-06-15" }));
      expect(result.totalCalls).toBe(1);
      expect(result.recentCalls[0].timestamp).toBe("2025-06-10T10:00:00Z");
    });

    test("filters by project name (partial match)", () => {
      const calls = [
        makeCall({ projectPath: "my-project", projectDir: "-my-project" }),
        makeCall({ projectPath: "other-project", projectDir: "-other-project" }),
      ];
      const result = analyze(calls, [], makeOpts({ project: "my-proj" }));
      expect(result.totalCalls).toBe(1);
    });

    test("filters by project name case-insensitively", () => {
      const calls = [makeCall({ projectPath: "My-Project" })];
      const result = analyze(calls, [], makeOpts({ project: "my-project" }));
      expect(result.totalCalls).toBe(1);
    });

    test("filters by skill name (partial match)", () => {
      const calls = [makeCall({ skillName: "commit" }), makeCall({ skillName: "review-pr" })];
      const result = analyze(calls, [], makeOpts({ skill: "comm" }));
      expect(result.totalCalls).toBe(1);
      expect(result.skillStats[0].name).toBe("commit");
    });

    test("combines from and to filters", () => {
      const calls = [
        makeCall({ timestamp: "2025-06-01T10:00:00Z" }),
        makeCall({ timestamp: "2025-06-15T10:00:00Z" }),
        makeCall({ timestamp: "2025-06-30T10:00:00Z" }),
      ];
      const result = analyze(calls, [], makeOpts({ from: "2025-06-10", to: "2025-06-20" }));
      expect(result.totalCalls).toBe(1);
    });
  });

  describe("skillStats aggregation", () => {
    test("aggregates call counts by skill", () => {
      const calls = [
        makeCall({ skillName: "commit" }),
        makeCall({ skillName: "commit" }),
        makeCall({ skillName: "review-pr" }),
      ];
      const result = analyze(calls, [], makeOpts());
      expect(result.skillStats).toEqual([
        { name: "commit", count: 2 },
        { name: "review-pr", count: 1 },
      ]);
    });

    test("sorts skills by count descending", () => {
      const calls = [
        makeCall({ skillName: "a" }),
        makeCall({ skillName: "b" }),
        makeCall({ skillName: "b" }),
        makeCall({ skillName: "c" }),
        makeCall({ skillName: "c" }),
        makeCall({ skillName: "c" }),
      ];
      const result = analyze(calls, [], makeOpts());
      expect(result.skillStats.map((s) => s.name)).toEqual(["c", "b", "a"]);
    });
  });

  describe("projectStats aggregation", () => {
    test("groups calls by project and skill", () => {
      const calls = [
        makeCall({ projectPath: "proj-a", skillName: "commit" }),
        makeCall({ projectPath: "proj-a", skillName: "commit" }),
        makeCall({ projectPath: "proj-b", skillName: "review-pr" }),
      ];
      const result = analyze(calls, [], makeOpts());
      expect(result.projectStats).toHaveLength(2);
      expect(result.projectStats[0].projectName).toBe("proj-a");
      expect(result.projectStats[0].totalCalls).toBe(2);
      expect(result.projectStats[1].projectName).toBe("proj-b");
      expect(result.projectStats[1].totalCalls).toBe(1);
    });
  });

  describe("dailyStats aggregation", () => {
    test("groups calls by date", () => {
      const calls = [
        makeCall({ timestamp: "2025-06-15T10:00:00Z", skillName: "commit" }),
        makeCall({ timestamp: "2025-06-15T14:00:00Z", skillName: "commit" }),
        makeCall({
          timestamp: "2025-06-16T10:00:00Z",
          skillName: "review-pr",
        }),
      ];
      const result = analyze(calls, [], makeOpts());
      expect(result.dailyStats).toHaveLength(2);
      expect(result.dailyStats[0].date).toBe("2025-06-15");
      expect(result.dailyStats[0].total).toBe(2);
      expect(result.dailyStats[1].date).toBe("2025-06-16");
      expect(result.dailyStats[1].total).toBe(1);
    });

    test("sorts daily stats chronologically", () => {
      const calls = [
        makeCall({ timestamp: "2025-06-20T10:00:00Z" }),
        makeCall({ timestamp: "2025-06-10T10:00:00Z" }),
      ];
      const result = analyze(calls, [], makeOpts());
      expect(result.dailyStats[0].date).toBe("2025-06-10");
      expect(result.dailyStats[1].date).toBe("2025-06-20");
    });
  });

  describe("tokenStats aggregation", () => {
    test("aggregates token usage by skill", () => {
      const calls = [
        makeCall({
          skillName: "commit",
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 10,
            cache_read_input_tokens: 20,
          },
        }),
        makeCall({
          skillName: "commit",
          usage: {
            input_tokens: 200,
            output_tokens: 100,
            cache_creation_input_tokens: 30,
            cache_read_input_tokens: 40,
          },
        }),
      ];
      const result = analyze(calls, [], makeOpts());
      expect(result.tokenStats).toHaveLength(1);
      expect(result.tokenStats[0]).toEqual({
        skillName: "commit",
        inputTokens: 300,
        outputTokens: 150,
        cacheCreateTokens: 40,
        cacheReadTokens: 60,
        callCount: 2,
      });
    });

    test("skips calls without usage data", () => {
      const calls = [makeCall({ skillName: "commit" })];
      const result = analyze(calls, [], makeOpts());
      expect(result.tokenStats).toHaveLength(0);
    });
  });

  describe("unusedSkills", () => {
    test("detects registered skills not in calls", () => {
      const calls = [makeCall({ skillName: "commit" })];
      const skills: RegisteredSkill[] = [
        { name: "commit", dirPath: "/skills/commit" },
        { name: "review-pr", dirPath: "/skills/review-pr" },
        { name: "example-skill", dirPath: "/skills/example-skill" },
      ];
      const result = analyze(calls, skills, makeOpts());
      expect(result.unusedSkills).toEqual(["example-skill", "review-pr"]);
    });

    test("returns empty when all skills are used", () => {
      const calls = [makeCall({ skillName: "commit" })];
      const skills: RegisteredSkill[] = [{ name: "commit", dirPath: "/skills/commit" }];
      const result = analyze(calls, skills, makeOpts());
      expect(result.unusedSkills).toEqual([]);
    });
  });

  describe("recentCalls", () => {
    test("limits recent calls to opts.limit", () => {
      const calls = Array.from({ length: 10 }, (_, i) =>
        makeCall({ timestamp: `2025-06-${String(i + 1).padStart(2, "0")}T10:00:00Z` }),
      );
      const result = analyze(calls, [], makeOpts({ limit: 3 }));
      expect(result.recentCalls).toHaveLength(3);
    });
  });

  describe("dateRange", () => {
    test("computes date range from filtered calls (sorted descending)", () => {
      // analyze() expects calls pre-sorted descending by timestamp
      const calls = [
        makeCall({ timestamp: "2025-06-30T10:00:00Z" }),
        makeCall({ timestamp: "2025-06-01T10:00:00Z" }),
      ];
      const result = analyze(calls, [], makeOpts());
      expect(result.dateRange).toEqual({
        from: "2025-06-01",
        to: "2025-06-30",
      });
    });

    test("returns empty strings when no calls", () => {
      const result = analyze([], [], makeOpts());
      expect(result.dateRange).toEqual({ from: "", to: "" });
    });
  });

  describe("conversationStats", () => {
    test("computes session breakdown", () => {
      const convs = [
        makeConversation({ hasSkillCalls: true }),
        makeConversation({
          sessionId: "sess-2",
          hasSkillCalls: false,
          skillsUsed: [],
        }),
        makeConversation({
          sessionId: "sess-3",
          hasSkillCalls: false,
          skillsUsed: [],
        }),
      ];
      const result = analyze([], [], makeOpts(), convs);
      expect(result.conversationStats).toBeDefined();
      expect(result.conversationStats!.totalSessions).toBe(3);
      expect(result.conversationStats!.sessionsWithSkills).toBe(1);
      expect(result.conversationStats!.sessionsWithoutSkills).toBe(2);
    });

    test("filters conversations by from/to", () => {
      const convs = [
        makeConversation({
          firstTimestamp: "2025-06-01T10:00:00Z",
          lastTimestamp: "2025-06-01T10:30:00Z",
        }),
        makeConversation({
          sessionId: "sess-2",
          firstTimestamp: "2025-06-20T10:00:00Z",
          lastTimestamp: "2025-06-20T10:30:00Z",
        }),
      ];
      const result = analyze([], [], makeOpts({ from: "2025-06-15" }), convs);
      expect(result.conversationStats!.totalSessions).toBe(1);
    });

    test("filters conversations by project", () => {
      const convs = [
        makeConversation({ projectPath: "my-project", projectDir: "-my-project" }),
        makeConversation({
          sessionId: "sess-2",
          projectPath: "other-project",
          projectDir: "-other-project",
        }),
      ];
      const result = analyze([], [], makeOpts({ project: "my-proj" }), convs);
      expect(result.conversationStats!.totalSessions).toBe(1);
    });

    test("computes project breakdown", () => {
      const convs = [
        makeConversation({
          projectPath: "proj-a",
          hasSkillCalls: true,
        }),
        makeConversation({
          sessionId: "sess-2",
          projectPath: "proj-a",
          hasSkillCalls: false,
          skillsUsed: [],
        }),
        makeConversation({
          sessionId: "sess-3",
          projectPath: "proj-b",
          hasSkillCalls: false,
          skillsUsed: [],
        }),
      ];
      const result = analyze([], [], makeOpts(), convs);
      const breakdown = result.conversationStats!.projectBreakdown;
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].projectName).toBe("proj-a");
      expect(breakdown[0].totalSessions).toBe(2);
      expect(breakdown[0].sessionsWithSkills).toBe(1);
    });
  });

  describe("edge cases", () => {
    test("handles empty calls array", () => {
      const result = analyze([], [], makeOpts());
      expect(result.totalCalls).toBe(0);
      expect(result.skillStats).toEqual([]);
      expect(result.projectStats).toEqual([]);
      expect(result.dailyStats).toEqual([]);
      expect(result.tokenStats).toEqual([]);
      expect(result.unusedSkills).toEqual([]);
      expect(result.recentCalls).toEqual([]);
    });

    test("handles filter that matches nothing", () => {
      const calls = [makeCall({ skillName: "commit" })];
      const result = analyze(calls, [], makeOpts({ skill: "nonexistent" }));
      expect(result.totalCalls).toBe(0);
      expect(result.skillStats).toEqual([]);
    });
  });
});
