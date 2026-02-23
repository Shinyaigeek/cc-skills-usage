import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getRegisteredSkills } from "../skills.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "skills-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("getRegisteredSkills", () => {
  test("reads skill directories", async () => {
    const skillsDir = join(tmpDir, "skills");
    await mkdir(skillsDir);
    await mkdir(join(skillsDir, "commit"));
    await mkdir(join(skillsDir, "review-pr"));

    const skills = await getRegisteredSkills(tmpDir);
    expect(skills).toHaveLength(2);

    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(["commit", "review-pr"]);
  });

  test("filters out dotfiles", async () => {
    const skillsDir = join(tmpDir, "skills");
    await mkdir(skillsDir);
    await mkdir(join(skillsDir, "commit"));
    await mkdir(join(skillsDir, ".hidden"));

    const skills = await getRegisteredSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("commit");
  });

  test("ignores non-directory entries", async () => {
    const skillsDir = join(tmpDir, "skills");
    await mkdir(skillsDir);
    await mkdir(join(skillsDir, "commit"));
    await writeFile(join(skillsDir, "not-a-dir.txt"), "hello");

    const skills = await getRegisteredSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("commit");
  });

  test("returns empty array when skills directory does not exist", async () => {
    const skills = await getRegisteredSkills(tmpDir);
    expect(skills).toEqual([]);
  });

  test("includes dirPath for each skill", async () => {
    const skillsDir = join(tmpDir, "skills");
    await mkdir(skillsDir);
    await mkdir(join(skillsDir, "my-skill"));

    const skills = await getRegisteredSkills(tmpDir);
    expect(skills[0].dirPath).toBe(join(skillsDir, "my-skill"));
  });
});
