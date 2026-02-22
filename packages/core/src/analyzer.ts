import type {
  CliOptions,
  Period,
  SkillCall,
  RegisteredSkill,
  AnalysisResult,
  SkillStats,
  ProjectSkillStats,
  PeriodStats,
  TokenStats,
} from "./types.js";

function toDateStr(ts: string): string {
  return ts.slice(0, 10); // YYYY-MM-DD from ISO string
}

function toPeriodKey(ts: string, period: Period): string {
  const date = ts.slice(0, 10); // YYYY-MM-DD
  if (period === "day") return date;
  if (period === "month") return date.slice(0, 7) + "-01";
  // week: round to ISO week Monday
  const d = new Date(date + "T00:00:00");
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // offset to Monday
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function analyze(
  calls: SkillCall[],
  registeredSkills: RegisteredSkill[],
  opts: CliOptions,
): AnalysisResult {
  // ── Filter ──
  let filtered = calls;

  if (opts.from) {
    filtered = filtered.filter((c) => toDateStr(c.timestamp) >= opts.from!);
  }
  if (opts.to) {
    filtered = filtered.filter((c) => toDateStr(c.timestamp) <= opts.to!);
  }
  if (opts.project) {
    const p = opts.project.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.projectPath.toLowerCase().includes(p) ||
        c.projectDir.toLowerCase().includes(p),
    );
  }
  if (opts.skill) {
    const s = opts.skill.toLowerCase();
    filtered = filtered.filter((c) =>
      c.skillName.toLowerCase().includes(s),
    );
  }

  // ── Skill stats ──
  const skillCountMap = new Map<string, number>();
  for (const c of filtered) {
    skillCountMap.set(c.skillName, (skillCountMap.get(c.skillName) ?? 0) + 1);
  }
  const skillStats: SkillStats[] = [...skillCountMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ── Project stats ──
  const projectMap = new Map<string, Map<string, number>>();
  for (const c of filtered) {
    if (!projectMap.has(c.projectPath)) {
      projectMap.set(c.projectPath, new Map());
    }
    const skills = projectMap.get(c.projectPath)!;
    skills.set(c.skillName, (skills.get(c.skillName) ?? 0) + 1);
  }
  const projectStats: ProjectSkillStats[] = [...projectMap.entries()]
    .map(([projectName, skills]) => {
      const skillList = [...skills.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      return {
        projectName,
        skills: skillList,
        totalCalls: skillList.reduce((s, x) => s + x.count, 0),
      };
    })
    .sort((a, b) => b.totalCalls - a.totalCalls);

  // ── Period stats ──
  const period = opts.period ?? "day";
  const periodMap = new Map<string, Map<string, number>>();
  for (const c of filtered) {
    const key = toPeriodKey(c.timestamp, period);
    if (!periodMap.has(key)) periodMap.set(key, new Map());
    const skills = periodMap.get(key)!;
    skills.set(c.skillName, (skills.get(c.skillName) ?? 0) + 1);
  }
  const periodStats: PeriodStats[] = [...periodMap.entries()]
    .map(([date, skills]) => {
      const skillObj: Record<string, number> = {};
      let total = 0;
      for (const [name, count] of skills) {
        skillObj[name] = count;
        total += count;
      }
      return { date, skills: skillObj, total };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Token stats ──
  const tokenMap = new Map<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheCreateTokens: number;
      cacheReadTokens: number;
      callCount: number;
    }
  >();
  for (const c of filtered) {
    if (!c.usage) continue;
    if (!tokenMap.has(c.skillName)) {
      tokenMap.set(c.skillName, {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreateTokens: 0,
        cacheReadTokens: 0,
        callCount: 0,
      });
    }
    const t = tokenMap.get(c.skillName)!;
    t.inputTokens += c.usage.input_tokens ?? 0;
    t.outputTokens += c.usage.output_tokens ?? 0;
    t.cacheCreateTokens += c.usage.cache_creation_input_tokens ?? 0;
    t.cacheReadTokens += c.usage.cache_read_input_tokens ?? 0;
    t.callCount += 1;
  }
  const tokenStats: TokenStats[] = [...tokenMap.entries()]
    .map(([skillName, t]) => ({ skillName, ...t }))
    .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));

  // ── Unused skills ──
  const usedSkillNames = new Set(filtered.map((c) => c.skillName));
  const unusedSkills = registeredSkills
    .map((s) => s.name)
    .filter((name) => !usedSkillNames.has(name))
    .sort();

  // ── Recent calls ──
  const recentCalls = filtered.slice(0, opts.limit);

  // ── Date range ──
  const timestamps = filtered.map((c) => c.timestamp);
  const from = timestamps.length ? toDateStr(timestamps[timestamps.length - 1]) : "";
  const to = timestamps.length ? toDateStr(timestamps[0]) : "";

  return {
    totalCalls: filtered.length,
    skillStats,
    projectStats,
    periodStats,
    period,
    tokenStats,
    unusedSkills,
    recentCalls,
    dateRange: { from, to },
  };
}
