/**
 * AgentCraft 共享引擎：核心类型定义。
 *
 * 本模块不依赖 React、Phaser 或 Node 专有 API，可在浏览器与 Node 中运行。
 */

export type Mode = 'simulation' | 'real';
export type ChapterId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
export type PermissionDecision = 'allow' | 'confirm' | 'deny';
export type ToolKind = 'read' | 'write';
export type CommitState = 'committed' | 'not_committed' | 'unknown';

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolError {
  code: string;
  message: string;
}

export interface SourceRef {
  title: string;
  version: string;
}

export interface ToolResult {
  ok: boolean;
  /** 面向模型与日志的可读观察结果。 */
  observation: string;
  /** 结构化返回值（可写入世界或作为事实来源）。 */
  value?: Record<string, unknown>;
  error?: ToolError;
  commitState?: CommitState;
  sources?: SourceRef[];
  /** 供决策器判断进度使用的世界影响。 */
  effects?: Record<string, unknown>;
}

export interface ToolContext {
  world: WorldState;
  signal: AbortSignal;
  idempotencyKey?: string;
  /** 运行序号，用于写操作记录。 */
  seq: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  kind: ToolKind;
  inputSchema: JsonSchema;
  timeoutMs: number;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export interface LocationDef {
  id: string;
  name: string;
  /** 相邻地点 -> 步行分钟数。 */
  neighbors: Record<string, number>;
  /** 开放时间 [开始, 结束]，分钟计。 */
  open?: [number, number];
}

export interface EnrollmentRecord {
  status: 'pending' | 'verified' | 'registered' | 'issued';
  credential?: string;
  at?: number;
}

export interface Reservation {
  topic: string;
  year: number;
  slot: string;
  at: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  /** 发布时刻（分钟），用于“可见公告”实验。 */
  at: number;
  visibleByDefault: boolean;
}

export interface DocumentDef {
  id: string;
  title: string;
  year: number;
  topics: string[];
  version: string;
  summary: string;
}

export interface CampusData {
  announcements: Announcement[];
  documents: DocumentDef[];
  librarySlots: string[];
}

export interface WorldState {
  /** 虚拟时间：自 00:00 起的分钟数。 */
  time: number;
  position: string;
  locations: Record<string, LocationDef>;
  records: Record<string, EnrollmentRecord>;
  /** 世界真实持有的凭据（模型可见与否由上下文决定）。 */
  credentials: string[];
  reservations: Reservation[];
  /** 幂等键记录：防止重复提交。 */
  submitted: Record<string, { at: number; key: string }>;
  campus: CampusData;
  /** C1 中玩家显式隐藏的公告 id（仅影响可见上下文）。 */
  hiddenAnnouncementIds: string[];
  /** 世界级标志：由工具成功执行或章节控制器写入，供独立核验使用。 */
  flags: Record<string, boolean | number>;
  /** 最近一次计算器结果（供用时核对）。 */
  lastCalc?: number;
  route?: {
    from: string;
    to: string;
    legs: Array<{ from: string; to: string; minutes: number }>;
    totalMinutes: number;
  };
  /** 最近一次工具操作结果摘要，供地图反馈。 */
  lastAction?: { tool: string; ok: boolean; at: number };
}

export interface FactEntry {
  id: string;
  text: string;
  value?: Record<string, unknown>;
  sourceEventSeq?: number;
  taskVersion: string;
}

export interface ObservationEntry {
  seq: number;
  step: number;
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  summary: string;
  effects?: Record<string, unknown>;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  schema: JsonSchema;
  kind: ToolKind;
}

export interface VisibleContext {
  chapterId: ChapterId;
  taskVersion: string;
  goal: string;
  rules: string[];
  facts: FactEntry[];
  observations: ObservationEntry[];
  tools: ToolDescriptor[];
  step: number;
  /** 模型可见的自身状态（位置与时间）。 */
  self: { position: string; time: number; timeText: string };
  /** 被移出上下文的内容说明，供“模型当前可见内容”抽屉展示。 */
  omitted: string[];
}

export type Decision =
  | { kind: 'tool'; tool: string; args: Record<string, unknown>; rationale: string }
  | { kind: 'finish'; rationale: string };

export interface Objective {
  id: string;
  description: string;
  tool: string;
  args?: Record<string, unknown>;
  /** 需要从可见事实中读取的参数名（例如凭据）。 */
  credentialArg?: string;
  credentialFactId?: string;
  /** 完成判定：仅基于可见事实与观察构建的信念。 */
  doneWhen: (belief: Record<string, unknown>) => boolean;
}

export interface OutcomeCheck {
  id: string;
  label: string;
  check: (world: WorldState) => boolean;
}

export interface TaskDefinition {
  chapterId: ChapterId;
  taskVersion: string;
  title: string;
  goal: string;
  rules: string[];
  /** 交互形态：单轮生成 / 手动工具 / 自主循环。 */
  interaction: 'generation' | 'manual-tools' | 'autonomous';
  initialWorld: WorldState;
  /** 启用的工具名。 */
  tools: string[];
  objectives: Objective[];
  requiredOutcomes: OutcomeCheck[];
  defaultHarness: Partial<HarnessConfig>;
  /** 运行开始时注入的初始事实记忆（例如预约目标时段）。 */
  initialFacts?: FactEntry[];
  /** C1 等非循环章节使用的单轮生成说明。 */
  promptHints?: string[];
}

export interface ContextConfig {
  includeFacts: boolean;
  includeObservations: number;
  enableRetrieval: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
}

export interface FaultConfig {
  /** 工具名 -> 前 N 次调用注入暂时故障。 */
  transientToolFailures?: Record<string, number>;
  /** 从可见事实中移出的 fact id。 */
  dropFactIds?: string[];
  /** 覆盖上下文保留的近期观察条数（有限上下文）。 */
  contextObservationLimit?: number;
}

export interface HarnessConfig {
  maxSteps: number;
  maxModelRequests: number;
  reservedOutputTokens: number;
  requestTimeoutMs: number;
  toolTimeoutMs: number;
  deadlineMs: number;
  permissions: Record<string, PermissionDecision>;
  context: ContextConfig;
  retry: RetryConfig;
  /** 是否自动执行恢复策略（C5 关闭，交由玩家修复）。 */
  autoRecover: boolean;
  faults?: FaultConfig;
}

export interface RunInput {
  chapterId: ChapterId;
  taskVersion: string;
  mode: Mode;
  seed: number;
  prompt?: string;
  harnessConfig: HarnessConfig;
}

export interface BudgetSnapshot {
  steps: number;
  maxSteps: number;
  modelRequests: number;
  maxModelRequests: number;
  reservedOutputTokens: number;
  maxReservedOutputTokens: number;
  toolRetries: number;
  elapsedMs: number;
  deadlineMs: number;
  /** 游戏能量：与真实 token 分开显示。 */
  gameEnergy: number;
  experimentalTokens: number;
  actualUsageTokens: number | null;
}
