import { execSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import type {
  Conversation,
  ConversationMessage,
  MessageUsage,
  MinimalMessage,
  SkillCall,
} from "./types.js";

// Built-in CLI commands that are NOT skills
const BUILTIN_COMMANDS = new Set([
  "/clear",
  "/compact",
  "/config",
  "/cost",
  "/doctor",
  "/help",
  "/init",
  "/login",
  "/logout",
  "/memory",
  "/model",
  "/permissions",
  "/plugin",
  "/resume",
  "/skills",
  "/status",
  "/terminal-setup",
  "/vim",
]);

function deriveProjectName(cwd: string): string {
  const docsIdx = cwd.indexOf("/Documents/");
  if (docsIdx !== -1) return cwd.slice(docsIdx + "/Documents/".length);
  return cwd;
}

function extractUserTrigger(
  msgs: Map<string, MinimalMessage>,
  parentUuid: string | null,
): string | undefined {
  let current = parentUuid;
  for (let i = 0; i < 20 && current; i++) {
    const m = msgs.get(current);
    if (!m) break;
    if (m.type === "user" && m.message) {
      const content = m.message.content;
      if (typeof content === "string" && content.length > 0) {
        return content.length > 200 ? `${content.slice(0, 200)}…` : content;
      }
    }
    current = m.parentUuid;
  }
  return undefined;
}

function extractUsage(msg: MinimalMessage): MessageUsage | undefined {
  const usage = (msg.message as Record<string, unknown>)?.usage as
    | Record<string, unknown>
    | undefined;
  if (!usage) return undefined;
  return {
    input_tokens: (usage.input_tokens as number) ?? 0,
    output_tokens: (usage.output_tokens as number) ?? 0,
    cache_creation_input_tokens:
      (usage.cache_creation_input_tokens as number) ?? 0,
    cache_read_input_tokens: (usage.cache_read_input_tokens as number) ?? 0,
  };
}

export async function scanSkillCalls(claudeDir: string): Promise<SkillCall[]> {
  const projectsDir = join(claudeDir, "projects");
  const allCalls: SkillCall[] = [];

  // Get all project directories
  let _projectDirs: string[];
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    _projectDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => join(projectsDir, e.name));
  } catch {
    return [];
  }

  // Pre-filter: use grep to find JSONL files containing Skill tool_use or slash command invocations
  const candidateFiles = new Set<string>();
  try {
    const grepResult = execSync(
      `grep -rl -e '"name":"Skill"' -e '<command-name>' ${projectsDir}/*/*.jsonl 2>/dev/null`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );
    for (const line of grepResult.trim().split("\n")) {
      if (line) candidateFiles.add(line);
    }
  } catch {
    // grep found nothing or error — fall through
  }

  if (candidateFiles.size === 0) return [];

  // Process each candidate file
  for (const filePath of candidateFiles) {
    const calls = await processJsonlFile(filePath);
    allCalls.push(...calls);
  }

  // Sort by timestamp descending
  allCalls.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return allCalls;
}

async function processJsonlFile(filePath: string): Promise<SkillCall[]> {
  const calls: SkillCall[] = [];
  const messageMap = new Map<string, MinimalMessage>();
  const seenSlashCmds = new Set<string>();

  // Derive project dir from file path
  const dirName = basename(join(filePath, ".."));
  const sessionId = basename(filePath).replace(".jsonl", "");

  const file = Bun.file(filePath);
  const text = await file.text();

  for (const line of text.split("\n")) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (!entry.uuid) continue;

      const msg: MinimalMessage = {
        uuid: entry.uuid as string,
        parentUuid: (entry.parentUuid as string) ?? null,
        type: entry.type as "user" | "assistant",
        timestamp: entry.timestamp as string,
        cwd: entry.cwd as string | undefined,
        sessionId: entry.sessionId as string | undefined,
        message: entry.message as MinimalMessage["message"],
        toolUseResult: entry.toolUseResult as MinimalMessage["toolUseResult"],
      };

      messageMap.set(msg.uuid, msg);

      // Check for Skill tool_use in assistant messages
      if (msg.type === "assistant" && msg.message?.content) {
        const content = msg.message.content;
        if (!Array.isArray(content)) continue;

        for (const block of content) {
          if (
            typeof block === "object" &&
            block !== null &&
            (block as Record<string, unknown>).type === "tool_use" &&
            (block as Record<string, unknown>).name === "Skill"
          ) {
            const input = (block as Record<string, unknown>).input as
              | Record<string, unknown>
              | undefined;
            if (!input?.skill) continue;

            const cwd = (msg.cwd ?? "") as string;
            const call: SkillCall = {
              skillName: input.skill as string,
              args: input.args as string | undefined,
              timestamp: msg.timestamp,
              sessionId: msg.sessionId ?? sessionId,
              projectDir: dirName,
              projectPath: deriveProjectName(cwd),
              cwd,
              triggerMessage: extractUserTrigger(messageMap, msg.parentUuid),
              usage: extractUsage(msg),
            };
            calls.push(call);
          }
        }
      }

      // Check for slash command skill invocations (e.g. /devg, /review-pr)
      if (msg.type === "user" && msg.message?.content) {
        const content = msg.message.content;
        const texts: string[] = [];
        if (typeof content === "string") {
          texts.push(content);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (
              typeof block === "object" &&
              block !== null &&
              typeof (block as Record<string, unknown>).text === "string"
            ) {
              texts.push((block as Record<string, unknown>).text as string);
            }
          }
        }

        for (const text of texts) {
          const cmdMatch = text.match(
            /<command-name>(\/[^<]+)<\/command-name>/,
          );
          if (!cmdMatch) continue;
          const cmd = cmdMatch[1]; // e.g. "/devg"
          if (BUILTIN_COMMANDS.has(cmd)) continue;

          // This is a skill slash command
          const skillName = cmd.slice(1); // remove leading "/"
          // Avoid duplicates: skip if we already recorded this via Skill tool_use
          // (the Skill tool_use and command-name can appear in the same session
          //  but the command-name is the user-initiated entry point)
          if (seenSlashCmds.has(`${msg.uuid}:${skillName}`)) continue;
          seenSlashCmds.add(`${msg.uuid}:${skillName}`);

          // Extract args from <command-message> if present
          let args: string | undefined;
          for (const t of texts) {
            const argsMatch = t.match(
              /<command-message>(.*?)<\/command-message>/s,
            );
            if (argsMatch && argsMatch[1] !== skillName) {
              args = argsMatch[1].trim() || undefined;
            }
          }

          const cwd = (msg.cwd ?? "") as string;
          const call: SkillCall = {
            skillName,
            args,
            timestamp: msg.timestamp,
            sessionId: msg.sessionId ?? sessionId,
            projectDir: dirName,
            projectPath: deriveProjectName(cwd),
            cwd,
            triggerMessage: `/${skillName}${args ? ` ${args}` : ""}`,
          };
          calls.push(call);
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Clear map to free memory
  messageMap.clear();

  // Deduplicate: if a skill was invoked via both slash command and Skill tool_use
  // within a short window in the same session, keep only the slash command entry
  // (it's the user-initiated action; the tool_use is the system response).
  const deduped: SkillCall[] = [];
  const toolUseCalls = calls.filter((c) => !c.triggerMessage?.startsWith("/"));
  const slashCalls = calls.filter((c) => c.triggerMessage?.startsWith("/"));

  const slashKeys = new Set(
    slashCalls.map((c) => `${c.sessionId}:${c.skillName}`),
  );

  for (const c of toolUseCalls) {
    const key = `${c.sessionId}:${c.skillName}`;
    if (slashKeys.has(key)) continue; // already covered by slash command entry
    deduped.push(c);
  }
  deduped.push(...slashCalls);

  return deduped;
}

// ── Conversation scanner ──

const BATCH_SIZE = 20;

export async function scanConversations(
  claudeDir: string,
): Promise<Conversation[]> {
  const projectsDir = join(claudeDir, "projects");
  const conversations: Conversation[] = [];

  let projectDirs: string[];
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    projectDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => join(projectsDir, e.name));
  } catch {
    return [];
  }

  // Collect all JSONL files
  const allFiles: string[] = [];
  for (const dir of projectDirs) {
    try {
      const files = await readdir(dir);
      for (const f of files) {
        if (f.endsWith(".jsonl")) {
          allFiles.push(join(dir, f));
        }
      }
    } catch {
      // skip inaccessible dirs
    }
  }

  // Process in batches
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(processJsonlForConversation));
    for (const conv of results) {
      if (conv) conversations.push(conv);
    }
  }

  // Sort by lastTimestamp descending
  conversations.sort(
    (a, b) =>
      new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime(),
  );

  return conversations;
}

async function processJsonlForConversation(
  filePath: string,
): Promise<Conversation | null> {
  const dirName = basename(join(filePath, ".."));
  const sessionId = basename(filePath).replace(".jsonl", "");

  const file = Bun.file(filePath);
  let text: string;
  try {
    text = await file.text();
  } catch {
    return null;
  }

  if (!text.trim()) return null;

  let messageCount = 0;
  let userMessageCount = 0;
  let firstTimestamp = "";
  let lastTimestamp = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let cwd = "";
  const userMessages: ConversationMessage[] = [];
  const skillNames = new Set<string>();

  for (const line of text.split("\n")) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (!entry.uuid) continue;

      const timestamp = entry.timestamp as string;
      const type = entry.type as string;

      if (!timestamp) continue;

      messageCount++;

      if (!firstTimestamp || timestamp < firstTimestamp)
        firstTimestamp = timestamp;
      if (!lastTimestamp || timestamp > lastTimestamp)
        lastTimestamp = timestamp;

      if (!cwd && entry.cwd) cwd = entry.cwd as string;

      // Extract token usage
      const message = entry.message as Record<string, unknown> | undefined;
      if (message) {
        const usage = message.usage as Record<string, unknown> | undefined;
        if (usage) {
          totalInputTokens += (usage.input_tokens as number) ?? 0;
          totalOutputTokens += (usage.output_tokens as number) ?? 0;
        }
      }

      // Collect user messages
      if (type === "user" && message) {
        userMessageCount++;
        const content = message.content;
        let msgText = "";
        if (typeof content === "string") {
          msgText = content;
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (
              typeof block === "object" &&
              block !== null &&
              typeof (block as Record<string, unknown>).text === "string"
            ) {
              msgText += (block as Record<string, unknown>).text as string;
            }
          }
        }

        if (msgText && userMessages.length < 100) {
          userMessages.push({
            timestamp,
            content:
              msgText.length > 500 ? `${msgText.slice(0, 500)}…` : msgText,
          });
        }

        // Detect slash command skills in user messages
        if (msgText) {
          const cmdMatch = msgText.match(
            /<command-name>(\/[^<]+)<\/command-name>/,
          );
          if (cmdMatch) {
            const cmd = cmdMatch[1];
            if (!BUILTIN_COMMANDS.has(cmd)) {
              skillNames.add(cmd.slice(1));
            }
          }
        }
      }

      // Detect Skill tool_use in assistant messages
      if (type === "assistant" && message?.content) {
        const content = message.content;
        if (Array.isArray(content)) {
          for (const block of content as Record<string, unknown>[]) {
            if (block.type === "tool_use" && block.name === "Skill") {
              const input = block.input as Record<string, unknown> | undefined;
              if (input?.skill) {
                skillNames.add(input.skill as string);
              }
            }
          }
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  if (messageCount === 0) return null;

  const skillsUsed = [...skillNames].sort();

  return {
    sessionId,
    projectDir: dirName,
    projectPath: deriveProjectName(cwd || dirName),
    firstTimestamp,
    lastTimestamp,
    messageCount,
    userMessageCount,
    userMessages,
    skillsUsed,
    hasSkillCalls: skillsUsed.length > 0,
    totalInputTokens,
    totalOutputTokens,
  };
}
