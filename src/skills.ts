import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { RegisteredSkill } from "./types.js";

export async function getRegisteredSkills(
  claudeDir: string,
): Promise<RegisteredSkill[]> {
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
