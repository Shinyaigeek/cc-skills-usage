import type {
  AnalysisResult,
  CliOptions,
  Conversation,
  ConversationStats,
  DailyStats,
  ProjectSkillStats,
  RegisteredSkill,
  SkillCall,
  SkillStats,
  TokenStats,
} from "./types.js";

function toDateStr(ts: string): string {
  return ts.slice(0, 10); // YYYY-MM-DD from ISO string
}

export function analyze(
  calls: SkillCall[],
  registeredSkills: RegisteredSkill[],
  opts: CliOptions,
  conversations?: Conversation[],
): AnalysisResult {
  // ── Filter ──
  let filtered = calls;

  if (opts.from) {
    const from = opts.from;
    filtered = filtered.filter((c) => toDateStr(c.timestamp) >= from);
  }
  if (opts.to) {
    const to = opts.to;
    filtered = filtered.filter((c) => toDateStr(c.timestamp) <= to);
  }
  if (opts.project) {
    const p = opts.project.toLowerCase();
    filtered = filtered.filter(
      (c) => c.projectPath.toLowerCase().includes(p) || c.projectDir.toLowerCase().includes(p),
    );
  }
  if (opts.skill) {
    const s = opts.skill.toLowerCase();
    filtered = filtered.filter((c) => c.skillName.toLowerCase().includes(s));
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
    let skills = projectMap.get(c.projectPath);
    if (!skills) {
      skills = new Map();
      projectMap.set(c.projectPath, skills);
    }
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

  // ── Daily stats ──
  const dailyMap = new Map<string, Map<string, number>>();
  for (const c of filtered) {
    const date = toDateStr(c.timestamp);
    let skills = dailyMap.get(date);
    if (!skills) {
      skills = new Map();
      dailyMap.set(date, skills);
    }
    skills.set(c.skillName, (skills.get(c.skillName) ?? 0) + 1);
  }
  const dailyStats: DailyStats[] = [...dailyMap.entries()]
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
    let t = tokenMap.get(c.skillName);
    if (!t) {
      t = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreateTokens: 0,
        cacheReadTokens: 0,
        callCount: 0,
      };
      tokenMap.set(c.skillName, t);
    }
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

  // ── Conversations ──
  let filteredConversations: Conversation[] | undefined;
  let conversationStats: ConversationStats | undefined;

  if (conversations) {
    filteredConversations = conversations;

    // Apply from/to/project filters (but not --skill, since the point is to see sessions without skills)
    if (opts.from) {
      const from = opts.from;
      filteredConversations = filteredConversations.filter(
        (c) => toDateStr(c.firstTimestamp) >= from,
      );
    }
    if (opts.to) {
      const to = opts.to;
      filteredConversations = filteredConversations.filter((c) => toDateStr(c.lastTimestamp) <= to);
    }
    if (opts.project) {
      const p = opts.project.toLowerCase();
      filteredConversations = filteredConversations.filter(
        (c) => c.projectPath.toLowerCase().includes(p) || c.projectDir.toLowerCase().includes(p),
      );
    }

    // Compute stats
    const withSkills = filteredConversations.filter((c) => c.hasSkillCalls).length;
    const withoutSkills = filteredConversations.length - withSkills;

    // Project breakdown
    const projMap = new Map<string, { total: number; withSkills: number; withoutSkills: number }>();
    for (const c of filteredConversations) {
      const name = c.projectPath;
      let entry = projMap.get(name);
      if (!entry) {
        entry = { total: 0, withSkills: 0, withoutSkills: 0 };
        projMap.set(name, entry);
      }
      entry.total++;
      if (c.hasSkillCalls) entry.withSkills++;
      else entry.withoutSkills++;
    }
    const projectBreakdown = [...projMap.entries()]
      .map(([projectName, v]) => ({
        projectName,
        totalSessions: v.total,
        sessionsWithSkills: v.withSkills,
        sessionsWithoutSkills: v.withoutSkills,
      }))
      .sort((a, b) => b.totalSessions - a.totalSessions);

    conversationStats = {
      totalSessions: filteredConversations.length,
      sessionsWithSkills: withSkills,
      sessionsWithoutSkills: withoutSkills,
      projectBreakdown,
    };

    // Apply limit
    filteredConversations = filteredConversations.slice(0, opts.limit);
  }

  return {
    totalCalls: filtered.length,
    skillStats,
    projectStats,
    dailyStats,
    tokenStats,
    unusedSkills,
    recentCalls,
    dateRange: { from, to },
    conversations: filteredConversations,
    conversationStats,
  };
}
