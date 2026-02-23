import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { MinimalMessage } from "../types.js";
import {
  deriveProjectName,
  extractUsage,
  extractUserTrigger,
  processJsonlFile,
  processJsonlForConversation,
} from "../scanner.js";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

describe("deriveProjectName", () => {
  test("extracts path after /Documents/", () => {
    expect(deriveProjectName("/Users/dev/Documents/my-project")).toBe("my-project");
  });

  test("extracts nested path after /Documents/", () => {
    expect(deriveProjectName("/Users/dev/Documents/org/my-project")).toBe("org/my-project");
  });

  test("returns full path when /Documents/ is absent", () => {
    expect(deriveProjectName("/var/data/my-project")).toBe("/var/data/my-project");
  });

  test("handles empty string", () => {
    expect(deriveProjectName("")).toBe("");
  });
});

describe("extractUserTrigger", () => {
  test("returns user message content from parent chain", () => {
    const msgs = new Map<string, MinimalMessage>();
    msgs.set("u1", {
      uuid: "u1",
      parentUuid: null,
      type: "user",
      timestamp: "2025-06-01T10:00:00Z",
      message: { role: "user", content: "please commit" },
    });
    msgs.set("a1", {
      uuid: "a1",
      parentUuid: "u1",
      type: "assistant",
      timestamp: "2025-06-01T10:00:01Z",
      message: { role: "assistant", content: "ok" },
    });

    expect(extractUserTrigger(msgs, "u1")).toBe("please commit");
  });

  test("traverses up to find user message", () => {
    const msgs = new Map<string, MinimalMessage>();
    msgs.set("u1", {
      uuid: "u1",
      parentUuid: null,
      type: "user",
      timestamp: "2025-06-01T10:00:00Z",
      message: { role: "user", content: "original trigger" },
    });
    msgs.set("a1", {
      uuid: "a1",
      parentUuid: "u1",
      type: "assistant",
      timestamp: "2025-06-01T10:00:01Z",
      message: { role: "assistant", content: "thinking..." },
    });

    expect(extractUserTrigger(msgs, "a1")).toBe("original trigger");
  });

  test("returns undefined when no user message found", () => {
    const msgs = new Map<string, MinimalMessage>();
    expect(extractUserTrigger(msgs, "nonexistent")).toBeUndefined();
  });

  test("truncates long messages to 200 chars", () => {
    const longContent = "x".repeat(300);
    const msgs = new Map<string, MinimalMessage>();
    msgs.set("u1", {
      uuid: "u1",
      parentUuid: null,
      type: "user",
      timestamp: "2025-06-01T10:00:00Z",
      message: { role: "user", content: longContent },
    });

    const result = extractUserTrigger(msgs, "u1");
    expect(result).toHaveLength(201); // 200 chars + "…"
    expect(result!.endsWith("…")).toBe(true);
  });
});

describe("extractUsage", () => {
  test("extracts token usage from message", () => {
    const msg: MinimalMessage = {
      uuid: "u1",
      parentUuid: null,
      type: "assistant",
      timestamp: "2025-06-01T10:00:00Z",
      message: {
        role: "assistant",
        content: "ok",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 10,
          cache_read_input_tokens: 20,
        },
      } as MinimalMessage["message"],
    };

    const usage = extractUsage(msg);
    expect(usage).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 20,
    });
  });

  test("returns undefined when no usage present", () => {
    const msg: MinimalMessage = {
      uuid: "u1",
      parentUuid: null,
      type: "assistant",
      timestamp: "2025-06-01T10:00:00Z",
      message: { role: "assistant", content: "ok" },
    };

    expect(extractUsage(msg)).toBeUndefined();
  });

  test("returns undefined when message is missing", () => {
    const msg: MinimalMessage = {
      uuid: "u1",
      parentUuid: null,
      type: "assistant",
      timestamp: "2025-06-01T10:00:00Z",
    };

    expect(extractUsage(msg)).toBeUndefined();
  });
});

describe("processJsonlFile", () => {
  test("extracts Skill tool_use calls", async () => {
    const calls = await processJsonlFile(join(FIXTURES_DIR, "skill-tooluse.jsonl"));
    expect(calls).toHaveLength(1);
    expect(calls[0].skillName).toBe("commit");
    expect(calls[0].args).toBe("-m 'fix bug'");
    expect(calls[0].sessionId).toBe("sess-1");
    expect(calls[0].projectPath).toBe("my-project");
    expect(calls[0].usage).toBeDefined();
    expect(calls[0].usage!.input_tokens).toBe(100);
  });

  test("extracts slash command calls", async () => {
    const calls = await processJsonlFile(join(FIXTURES_DIR, "slash-command.jsonl"));
    expect(calls).toHaveLength(1);
    expect(calls[0].skillName).toBe("review-pr");
    expect(calls[0].args).toBe("123");
    expect(calls[0].triggerMessage).toBe("/review-pr 123");
  });

  test("deduplicates when both tool_use and slash command present", async () => {
    const calls = await processJsonlFile(join(FIXTURES_DIR, "mixed.jsonl"));
    // Should keep slash command entry and discard tool_use duplicate
    expect(calls).toHaveLength(1);
    expect(calls[0].skillName).toBe("devg");
    expect(calls[0].triggerMessage).toBe("/devg help me debug");
  });

  test("filters out builtin commands", async () => {
    // Create a temporary fixture with builtin command
    const tmpDir = join(import.meta.dir, "fixtures");
    const tmpFile = join(tmpDir, "_test-builtin.jsonl");
    const content = `{"uuid":"u1","parentUuid":null,"type":"user","timestamp":"2025-06-01T10:00:00Z","cwd":"/tmp","sessionId":"sess-b","message":{"role":"user","content":"<command-name>/help</command-name>"}}`;
    await Bun.write(tmpFile, content);

    try {
      const calls = await processJsonlFile(tmpFile);
      expect(calls).toHaveLength(0);
    } finally {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpFile);
    }
  });
});

describe("processJsonlForConversation", () => {
  test("extracts conversation metadata", async () => {
    const conv = await processJsonlForConversation(join(FIXTURES_DIR, "skill-tooluse.jsonl"));
    expect(conv).not.toBeNull();
    expect(conv!.sessionId).toBe("skill-tooluse");
    expect(conv!.messageCount).toBe(2);
    expect(conv!.userMessageCount).toBe(1);
    expect(conv!.hasSkillCalls).toBe(true);
    expect(conv!.skillsUsed).toContain("commit");
  });

  test("detects slash command skills in conversations", async () => {
    const conv = await processJsonlForConversation(join(FIXTURES_DIR, "slash-command.jsonl"));
    expect(conv).not.toBeNull();
    expect(conv!.hasSkillCalls).toBe(true);
    expect(conv!.skillsUsed).toContain("review-pr");
  });

  test("collects user messages", async () => {
    const conv = await processJsonlForConversation(join(FIXTURES_DIR, "skill-tooluse.jsonl"));
    expect(conv).not.toBeNull();
    expect(conv!.userMessages).toHaveLength(1);
    expect(conv!.userMessages[0].content).toBe("Please commit the changes");
  });

  test("returns null for empty file", async () => {
    const tmpFile = join(FIXTURES_DIR, "_test-empty.jsonl");
    await Bun.write(tmpFile, "");
    try {
      const conv = await processJsonlForConversation(tmpFile);
      expect(conv).toBeNull();
    } finally {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpFile);
    }
  });
});
