// ── CLI Options ──

export type Period = "day" | "week" | "month";

export interface CliOptions {
  output: "terminal" | "web";
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  project?: string; // partial match on project path
  skill?: string; // skill name filter
  period: Period;
  port: number;
  claudeDir: string;
  limit: number;
}

// ── JSONL message types ──

export interface MinimalMessage {
  uuid: string;
  parentUuid: string | null;
  type: "user" | "assistant";
  timestamp: string;
  cwd?: string;
  sessionId?: string;
  message?: {
    role: string;
    content: unknown;
    model?: string;
  };
  toolUseResult?: {
    success: boolean;
    commandName?: string;
  };
  usage?: MessageUsage;
}

export interface MessageUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// ── Extracted skill call ──

export interface SkillCall {
  skillName: string;
  args?: string;
  timestamp: string; // ISO string
  sessionId: string;
  projectPath: string; // derived project name
  projectDir: string; // raw project directory name
  cwd: string;
  triggerMessage?: string; // user message that triggered the skill
  usage?: MessageUsage;
}

// ── Registered skill ──

export interface RegisteredSkill {
  name: string;
  dirPath: string;
}

// ── Analysis results ──

export interface SkillStats {
  name: string;
  count: number;
}

export interface ProjectSkillStats {
  projectName: string;
  skills: SkillStats[];
  totalCalls: number;
}

export interface PeriodStats {
  date: string; // YYYY-MM-DD (period start date)
  skills: Record<string, number>;
  total: number;
}

export interface TokenStats {
  skillName: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  callCount: number;
}

export interface AnalysisResult {
  totalCalls: number;
  skillStats: SkillStats[];
  projectStats: ProjectSkillStats[];
  periodStats: PeriodStats[];
  period: Period;
  tokenStats: TokenStats[];
  unusedSkills: string[];
  recentCalls: SkillCall[];
  dateRange: { from: string; to: string };
}
