import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import type { SkillCall, MinimalMessage, MessageUsage } from "./types.js";

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
        return content.length > 200 ? content.slice(0, 200) + "…" : content;
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
  let projectDirs: string[];
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    projectDirs = entries
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
  const sessionId =
    basename(filePath).replace(".jsonl", "");

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
          const cmdMatch = text.match(/<command-name>(\/[^<]+)<\/command-name>/);
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
            triggerMessage: `/${skillName}${args ? " " + args : ""}`,
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
