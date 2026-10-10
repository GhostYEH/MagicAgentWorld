/**
 * 六章任务配置：目标、规则、初始世界、启用工具与独立核验条件。
 *
 * 关卡内容全部放在任务配置中；报到时序与工具名按规划落实。
 */

import type { HarnessConfig, TaskDefinition, WorldState } from '@agentcraft/engine';
import { CAMPUS_DATA, CAMPUS_LOCATIONS } from './campus';
import { AGENT_LESSON_DATA } from './lessons';

function baseWorld(overrides: Partial<WorldState> = {}): WorldState {
  return {
    time: 8 * 60 + 50,
    position: 'east_gate',
    locations: CAMPUS_LOCATIONS,
    records: {
      identity: { status: 'pending' },
      dorm: { status: 'pending' },
      card: { status: 'pending' },
    },
    credentials: [],
    reservations: [],
    submitted: {},
    campus: CAMPUS_DATA,
    hiddenAnnouncementIds: [],
    flags: {},
    ...overrides,
  };
}

const C3_GOAL = '完成新生报到：身份核验、宿舍登记与校园卡领取。';
const C3_RULES = [
  '先完成身份核验，才能进行宿舍登记；宿舍登记后凭凭据领取校园卡。',
  '只能在对应地点办理对应事项。',
  '每项事务处理 5 分钟。',
];

export const CHAPTER_TASKS: Record<string, TaskDefinition> = {
  C1: {
    chapterId: 'C1',
    taskVersion: 'c1.v2',
    title: '第一章：模型觉醒',
    goal: '改变 Prompt 与上下文，理解模型的回答边界、Token 和幻觉。',
    rules: ['模型只能依据当前装入的记忆片段作答。', '事实不足时应说明未知，不得编造。'],
    interaction: 'generation',
    initialWorld: baseWorld({ campus: AGENT_LESSON_DATA }),
    tools: [],
    objectives: [],
    requiredOutcomes: [
      { id: 'c1.generate', label: '已生成回答', check: (w) => w.flags.c1Generated === true },
      {
        id: 'c1.compare',
        label: '已比较至少三种输入与上下文组合',
        check: (w) => Number(w.flags.c1Variants ?? 0) >= 3,
      },
      {
        id: 'c1.evidence',
        label: '能区分有依据与无依据的结论',
        check: (w) => w.flags.c1GroundedSeen === true && w.flags.c1UnknownSeen === true,
      },
    ],
    defaultHarness: {},
    promptHints: ['先问“你是谁”，再移出“身份记忆”。比较回答和依据，再问“你现在能调用工具吗”。'],
  },

  C2: {
    chapterId: 'C2',
    taskVersion: 'c2.v2',
    title: '第二章：工具解锁',
    goal: '给 AC–01 安装工具，读取运行配置、计算剩余 Token 预算并检索调用规约。',
    rules: [
      '查询读取运行事实；计算处理精确数值；检索返回资料与来源。',
      '计算工具只处理受限数值表达式。',
    ],
    interaction: 'manual-tools',
    initialWorld: baseWorld({ campus: AGENT_LESSON_DATA, flags: { contextLimit: 8192, inputTokens: 2048, reservedOutput: 1024 } }),
    tools: ['runtime.inspect', 'calculator.evaluate', 'documents.retrieve'],
    objectives: [],
    requiredOutcomes: [
      { id: 'c2.inspect', label: '读取到运行预算配置', check: (w) => w.flags.budgetInspected === true },
      { id: 'c2.calc', label: '算出剩余预算 5120 Token', check: (w) => w.lastCalc === 5120 },
      { id: 'c2.source', label: '找到工具调用规约与来源', check: (w) => w.flags.toolGuideRetrieved === true },
    ],
    defaultHarness: { maxSteps: 24 },
  },

  C3: {
    chapterId: 'C3',
    taskVersion: 'c3.v1',
    title: '第三章：Agent 诞生',
    goal: C3_GOAL,
    rules: C3_RULES,
    interaction: 'autonomous',
    initialWorld: baseWorld(),
    tools: ['route.plan', 'campus.move', 'enrollment.status', 'enrollment.submit'],
    objectives: [],
    requiredOutcomes: [
      { id: 'c3.identity', label: '身份核验完成', check: (w) => w.records.identity!.status !== 'pending' },
      { id: 'c3.dorm', label: '宿舍登记完成', check: (w) => w.records.dorm!.status !== 'pending' },
      { id: 'c3.card', label: '校园卡领取完成', check: (w) => w.records.card!.status !== 'pending' },
    ],
    defaultHarness: { maxSteps: 16 },
  },

  C4: {
    chapterId: 'C4',
    taskVersion: 'c4.v1',
    title: '第四章：Harness 工坊',
    goal: C3_GOAL,
    rules: C3_RULES,
    interaction: 'autonomous',
    initialWorld: baseWorld(),
    tools: ['route.plan', 'campus.move', 'enrollment.status', 'enrollment.submit'],
    objectives: [],
    requiredOutcomes: [
      { id: 'c4.identity', label: '身份核验完成', check: (w) => w.records.identity!.status !== 'pending' },
      { id: 'c4.dorm', label: '宿舍登记完成', check: (w) => w.records.dorm!.status !== 'pending' },
      { id: 'c4.card', label: '校园卡领取完成', check: (w) => w.records.card!.status !== 'pending' },
    ],
    defaultHarness: { maxSteps: 16, retry: { maxAttempts: 3 }, context: { includeFacts: true, includeObservations: 8, enableRetrieval: true } },
  },

  C5: {
    chapterId: 'C5',
    taskVersion: 'c5.v1',
    title: '第五章：失控与修复',
    goal: C3_GOAL,
    rules: [...C3_RULES, '身份核验已提前完成，但宿舍提交可能缺少凭据。'],
    interaction: 'autonomous',
    initialWorld: baseWorld({
      records: {
        identity: { status: 'verified', credential: 'ID-IDENTITY', at: 8 * 60 + 50 },
        dorm: { status: 'pending' },
        card: { status: 'pending' },
      },
      credentials: ['ID-IDENTITY'],
    }),
    // 故障运行：不提供状态查询工具，凭据被移出可见事实。
    tools: ['route.plan', 'campus.move', 'enrollment.submit'],
    objectives: [],
    requiredOutcomes: [
      { id: 'c5.dorm', label: '宿舍登记完成', check: (w) => w.records.dorm!.status !== 'pending' },
      { id: 'c5.card', label: '校园卡领取完成', check: (w) => w.records.card!.status !== 'pending' },
    ],
    defaultHarness: {
      maxSteps: 10,
      autoRecover: false,
      faults: { dropFactIds: ['fact.identity.credential'] },
    },
  },

  C6: {
    chapterId: 'C6',
    taskVersion: 'c6.v1',
    title: '最终章：智能体挑战赛',
    goal: '查询满足主题“人工智能”与年份 2024 的资料，并预约指定时段。',
    rules: ['必须先查询到匹配资料，才能预约。', '预约时段限定为公告中的可用时段。'],
    interaction: 'autonomous',
    initialWorld: baseWorld(),
    tools: ['library.lookup', 'library.reserve'],
    objectives: [],
    initialFacts: [
      {
        id: 'fact.reserve.slot',
        text: '预约目标时段：14:00-15:00',
        value: { slot: '14:00-15:00' },
        taskVersion: 'c6.v1',
      },
    ],
    requiredOutcomes: [
      { id: 'c6.lookup', label: '查询到匹配资料', check: (w) => w.flags.lookupFound === true },
      {
        id: 'c6.reserve',
        label: '预约成功（14:00-15:00）',
        check: (w) => w.reservations.some((r) => r.slot === '14:00-15:00'),
      },
    ],
    defaultHarness: { maxSteps: 10 },
  },
};

export function getTask(chapterId: string): TaskDefinition {
  const task = CHAPTER_TASKS[chapterId];
  if (!task) throw new Error(`未知章节：${chapterId}`);
  return task;
}

/** C5 的修复方案：恢复可见凭据并启用状态查询工具。 */
export function c5FixedHarness(): Partial<HarnessConfig> {
  return {
    maxSteps: 16,
    autoRecover: true,
    faults: {},
  };
}
