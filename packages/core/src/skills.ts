import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { RegisteredSkill } from "./types.js";

export async function getRegisteredSkills(claudeDir: string): Promise<RegisteredSkill[]> {
  const skillsDir = join(claudeDir, "skills");
  try {
    const entries = await readdir(skillsDir);
    const results: RegisteredSkill[] = [];
    for (const name of entries) {
      if (name.startsWith(".")) continue;
      const fullPath = join(skillsDir, name);
      try {
        // stat follows symlinks, unlike lstat
        const s = await stat(fullPath);
        if (s.isDirectory()) {
          results.push({ name, dirPath: fullPath });
        }
      } catch {
        // broken symlink — skip
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function readSkillsFromDir(skillsDir: string): Promise<RegisteredSkill[]> {
  const entries = await readdir(skillsDir).catch(() => []);
  const results: RegisteredSkill[] = [];
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const fullPath = join(skillsDir, name);
    try {
      const s = await stat(fullPath);
      if (s.isDirectory()) {
        results.push({ name, dirPath: fullPath });
      }
    } catch {
      // broken symlink — skip
    }
  }
  return results;
}

async function getProjectPathsFromHistory(claudeDir: string): Promise<string[]> {
  const historyPath = join(claudeDir, "history.jsonl");
  let content: string;
  try {
    content = await readFile(historyPath, "utf-8");
  } catch {
    return [];
  }

  const paths = new Set<string>();
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.project && typeof entry.project === "string") {
        paths.add(entry.project);
      }
    } catch {
      // malformed line — skip
    }
  }
  return [...paths];
}

export async function discoverAllSkills(): Promise<RegisteredSkill[]> {
  const home = homedir();
  const claudeDir = join(home, ".claude");
  const globalSkillsDir = join(claudeDir, "skills");

  // Collect candidate .claude/skills directories
  const skillsDirs: string[] = [globalSkillsDir];

  const projectPaths = await getProjectPathsFromHistory(claudeDir);
  for (const projectPath of projectPaths) {
    const candidateDir = join(projectPath, ".claude", "skills");
    if (candidateDir !== globalSkillsDir) {
      skillsDirs.push(candidateDir);
    }
  }

  // Global skills first, then deduplicate by name
  const seen = new Set<string>();
  const results: RegisteredSkill[] = [];

  for (const dir of skillsDirs) {
    const skills = await readSkillsFromDir(dir);
    for (const skill of skills) {
      if (seen.has(skill.name)) continue;
      seen.add(skill.name);
      results.push(skill);
    }
  }

  return results;
}
