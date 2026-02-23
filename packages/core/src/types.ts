// ── CLI Options ──

export interface CliOptions {
  output: "terminal" | "web";
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  project?: string; // partial match on project path
  skill?: string; // skill name filter
  port: number;
  claudeDir: string;
  limit: number;
  conversations: boolean;
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

// ── Conversation types ──

export interface ConversationMessage {
  timestamp: string;
  content: string; // user message text (truncated to 500 chars)
}

export interface Conversation {
  sessionId: string;
  projectDir: string;
  projectPath: string;
  firstTimestamp: string;
  lastTimestamp: string;
  messageCount: number;
  userMessageCount: number;
  userMessages: ConversationMessage[];
  skillsUsed: string[]; // skill names used in this session
  hasSkillCalls: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface ConversationStats {
  totalSessions: number;
  sessionsWithSkills: number;
  sessionsWithoutSkills: number;
  projectBreakdown: Array<{
    projectName: string;
    totalSessions: number;
    sessionsWithSkills: number;
    sessionsWithoutSkills: number;
  }>;
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

export interface DailyStats {
  date: string; // YYYY-MM-DD
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
  dailyStats: DailyStats[];
  tokenStats: TokenStats[];
  unusedSkills: string[];
  recentCalls: SkillCall[];
  dateRange: { from: string; to: string };
  conversations?: Conversation[];
  conversationStats?: ConversationStats;
}
