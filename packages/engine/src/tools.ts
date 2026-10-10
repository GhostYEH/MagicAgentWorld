/**
 * 工具集：所有工具只操作虚拟世界。
 *
 * 每个工具定义包含参数 Schema、读/写属性、超时与执行函数。
 * 执行管线（ToolRegistry）负责：参数校验 → 权限策略 → 预算检查 → 执行 → 记录。
 * 写操作使用幂等键，重试不会重复提交。
 */

import type { ToolContext, ToolDefinition, ToolResult } from './types';
import { evaluateExpression, formatTime, isOpen, planRoute } from './world';

function ok(observation: string, value?: Record<string, unknown>, extra?: Partial<ToolResult>): ToolResult {
  return { ok: true, observation, value, ...extra };
}

function fail(code: string, message: string, extra?: Partial<ToolResult>): ToolResult {
  return { ok: false, observation: message, error: { code, message }, ...extra };
}

export const scheduleLookup: ToolDefinition = {
  name: 'schedule.lookup',
  description: '查询虚构校园公告与日程（报到时间、地点开放时间等）。',
  kind: 'read',
  timeoutMs: 800,
  inputSchema: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '查询关键词，例如“报到”“宿舍”“校园卡”。' },
    },
    required: ['keyword'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const keyword = String(args.keyword ?? '');
    const anns = ctx.world.campus.announcements.filter(
      (a) => a.visibleByDefault && (a.title.includes(keyword) || a.body.includes(keyword)),
    );
    if (anns.length === 0) {
      return ok(`未找到与“${keyword}”相关的公告。`, { count: 0, items: [] });
    }
    const items = anns.map((a) => ({ id: a.id, title: a.title, body: a.body, at: formatTime(a.at) }));
    ctx.world.flags.scheduleQueried = true;
    return ok(
      `找到 ${items.length} 条公告：${items.map((i) => `${i.title}（${i.at}）`).join('；')}`,
      { count: items.length, items },
      { sources: anns.map((a) => ({ title: a.title, version: '公告-' + a.id })) },
    );
  },
};

export const calculatorEvaluate: ToolDefinition = {
  name: 'calculator.evaluate',
  description: '执行精确计算，只处理受限数值表达式（数字与 + - * / ( )）。',
  kind: 'read',
  timeoutMs: 200,
  inputSchema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: '数值表达式，例如 10+15+20+5*3。' },
    },
    required: ['expression'],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const expr = String(args.expression ?? '');
    const result = evaluateExpression(expr);
    if (!result.ok) {
      return fail('INVALID_EXPRESSION', `无法计算表达式“${expr}”：${result.error}`);
    }
    ctx.world.lastCalc = result.value;
    ctx.world.flags.calcChecked = true;
    return ok(`${expr} = ${result.value}`, { expression: expr, value: result.value }, { effects: { value: result.value } });
  },
};

export const documentsRetrieve: ToolDefinition = {
  name: 'documents.retrieve',
  description: '检索虚构资料，返回来源与版本。',
  kind: 'read',
  timeoutMs: 900,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '检索主题关键词。' },
    },
    required: ['query'],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const query = String(args.query ?? '');
    const docs = ctx.world.campus.documents.filter(
      (d) => d.title.includes(query) || d.topics.some((t) => t.includes(query)) || d.summary.includes(query),
    );
    if (docs.length === 0) {
      return ok(`未检索到与“${query}”相关的资料。`, { count: 0, items: [] });
    }
    const items = docs.map((d) => ({ id: d.id, title: d.title, version: d.version, year: d.year, summary: d.summary }));
    ctx.world.flags.retrieved = true;
    if (docs.some(d => d.id === 'guide.tool-call')) ctx.world.flags.toolGuideRetrieved = true;
    return ok(
      `检索到 ${items.length} 份资料：${items.map((i) => `${i.title}（${i.version}）`).join('；')}`,
      { count: items.length, items },
      { sources: docs.map((d) => ({ title: d.title, version: d.version })) },
    );
  },
};

export const runtimeInspect: ToolDefinition = {
  name: 'runtime.inspect',
  description: '读取本次教学实验的运行预算配置；这些值是模拟运行配置，不是供应商模型规格。',
  kind: 'read',
  timeoutMs: 300,
  inputSchema: { type: 'object', properties: { field: { type: 'string', description: '可查询 tokenBudget。' } }, required: ['field'] },
  async execute(args, ctx): Promise<ToolResult> {
    if (args.field !== 'tokenBudget') return fail('UNKNOWN_FIELD', '没有这个运行字段，请查询 tokenBudget。');
    const { contextLimit, inputTokens, reservedOutput } = ctx.world.flags;
    if (![contextLimit, inputTokens, reservedOutput].every(v => typeof v === 'number' && Number.isFinite(v))) return fail('NO_BUDGET_CONFIG', '本次运行没有可查询的预算配置。');
    ctx.world.flags.budgetInspected = true;
    return ok(`窗口 ${contextLimit} Token · 已用输入 ${inputTokens} · 预留输出 ${reservedOutput}`, { contextLimit, inputTokens, reservedOutput }, { sources: [{ title: '本次实验运行配置', version: 'c2.v2' }] });
  },
};

export const routePlan: ToolDefinition = {
  name: 'route.plan',
  description: '规划从当前位置到目标地点的最短路线，返回分段与总用时。',
  kind: 'read',
  timeoutMs: 400,
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: '目标地点 id，例如 dorm、card_center。' },
    },
    required: ['to'],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const to = String(args.to ?? '');
    if (!ctx.world.locations[to]) return fail('UNKNOWN_LOCATION', `未知地点：${to}`);
    const route = planRoute(ctx.world, ctx.world.position, to);
    if (!route) return fail('NO_ROUTE', `无法从 ${ctx.world.position} 到达 ${to}`);
    const legsText = route.legs.map((l) => `${l.from}→${l.to} ${l.minutes}分钟`).join('，');
    return ok(
      `路线：${legsText || '原地'}，合计 ${route.totalMinutes} 分钟。`,
      { from: ctx.world.position, to, legs: route.legs, totalMinutes: route.totalMinutes },
    );
  },
};

export const campusMove: ToolDefinition = {
  name: 'campus.move',
  description: '按规划路线移动，更新虚拟位置与时间。',
  kind: 'write',
  timeoutMs: 500,
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: '目标地点 id。' },
    },
    required: ['to'],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const to = String(args.to ?? '');
    if (!ctx.world.locations[to]) return fail('UNKNOWN_LOCATION', `未知地点：${to}`);
    const route = planRoute(ctx.world, ctx.world.position, to);
    if (!route) return fail('NO_ROUTE', `无法从 ${ctx.world.position} 到达 ${to}`);
    const arriveAt = ctx.world.time + route.totalMinutes;
    if (!isOpen(ctx.world.locations[to], arriveAt)) {
      return fail(
        'LOCATION_CLOSED',
        `${to} 在 ${formatTime(arriveAt)} 未开放（开放时间 ${ctx.world.locations[to]!.open?.map(formatTime).join('-')}）。`,
      );
    }
    ctx.world.time = arriveAt;
    ctx.world.position = to;
    ctx.world.route = { from: route.legs[0]?.from ?? to, to, legs: route.legs, totalMinutes: route.totalMinutes };
    return ok(`已到达 ${to}，当前时间 ${formatTime(ctx.world.time)}。`, {
      position: to,
      time: ctx.world.time,
      arrival: formatTime(ctx.world.time),
      minutes: route.totalMinutes,
    });
  },
};

export const enrollmentStatus: ToolDefinition = {
  name: 'enrollment.status',
  description: '查询报到事项当前状态（身份核验、宿舍登记、校园卡领取）。',
  kind: 'read',
  timeoutMs: 400,
  inputSchema: {
    type: 'object',
    properties: {
      item: { type: 'string', description: '事项：identity | dorm | card' },
    },
    required: ['item'],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const item = String(args.item ?? '');
    const rec = ctx.world.records[item];
    if (!rec) return fail('UNKNOWN_ITEM', `未知报到事项：${item}`);
    return ok(`${item} 当前状态：${rec.status}${rec.credential ? `（凭据 ${rec.credential}）` : ''}`, {
      item,
      status: rec.status,
      credential: rec.credential,
    });
  },
};

interface SubmitRule {
  requires?: string;
  grants: 'verified' | 'registered' | 'issued';
  credentialPrefix: string;
  needsCredential: boolean;
}

const SUBMIT_RULES: Record<string, SubmitRule> = {
  identity: { grants: 'verified', credentialPrefix: 'ID', needsCredential: false },
  dorm: { requires: 'identity', grants: 'registered', credentialPrefix: 'DORM', needsCredential: true },
  card: { requires: 'dorm', grants: 'issued', credentialPrefix: 'CARD', needsCredential: true },
};

export const enrollmentSubmit: ToolDefinition = {
  name: 'enrollment.submit',
  description: '执行带前置条件的报到提交（需要对应凭据）。',
  kind: 'write',
  timeoutMs: 700,
  inputSchema: {
    type: 'object',
    properties: {
      item: { type: 'string', description: '事项：identity | dorm | card' },
      credential: { type: 'string', description: '前置凭据（宿舍/校园卡提交需要）。' },
    },
    required: ['item'],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const item = String(args.item ?? '');
    const rule = SUBMIT_RULES[item];
    if (!rule) return fail('UNKNOWN_ITEM', `未知报到事项：${item}`);
    const rec = ctx.world.records[item];
    if (!rec) return fail('UNKNOWN_ITEM', `未知报到事项：${item}`);
    // 幂等：已提交则直接返回已提交状态，不重复写入。
    if (rec.status !== 'pending') {
      return ok(`${item} 已处于 ${rec.status}，无需重复提交。`, {
        item,
        status: rec.status,
        idempotent: true,
      });
    }
    if (rule.requires && ctx.world.records[rule.requires]?.status === 'pending') {
      return fail('PRECONDITION_FAILED', `前置事项 ${rule.requires} 尚未完成，无法提交 ${item}。`);
    }
    if (rule.needsCredential) {
      const credential = args.credential === undefined ? undefined : String(args.credential);
      if (!credential) {
        return fail('MISSING_CREDENTIAL', `提交 ${item} 需要凭据，但未提供。`);
      }
      const expected = rule.requires ? ctx.world.records[rule.requires]!.credential : undefined;
      if (!ctx.world.credentials.includes(credential) || (expected && credential !== expected)) {
        return fail('INVALID_CREDENTIAL', `凭据“${credential}”无效，无法提交 ${item}。`);
      }
    }
    const credential = `${rule.credentialPrefix}-${item.toUpperCase()}`;
    rec.status = rule.grants;
    rec.credential = credential;
    rec.at = ctx.world.time;
    // 每项事务处理 5 分钟。
    ctx.world.time += 5;
    if (!ctx.world.credentials.includes(credential)) ctx.world.credentials.push(credential);
    if (ctx.idempotencyKey) {
      ctx.world.submitted[item] = { at: ctx.world.time, key: ctx.idempotencyKey };
    }
    return ok(`${item} 提交成功，状态更新为 ${rec.status}，凭据 ${credential}。`, {
      item,
      status: rec.status,
      credential,
    }, { effects: { item, status: rec.status, credential } });
  },
};

export const libraryLookup: ToolDefinition = {
  name: 'library.lookup',
  description: '在资料库中按主题与年份查询资料。',
  kind: 'read',
  timeoutMs: 700,
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: '主题关键词。' },
      year: { type: 'integer', description: '年份。' },
    },
    required: ['topic', 'year'],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const topic = String(args.topic ?? '');
    const year = Number(args.year ?? 0);
    const docs = ctx.world.campus.documents.filter((d) => d.year === year && d.topics.includes(topic));
    if (docs.length === 0) {
      return ok(`未找到 ${year} 年主题为“${topic}”的资料。`, { count: 0, items: [] });
    }
    const items = docs.map((d) => ({ id: d.id, title: d.title, version: d.version, year: d.year }));
    ctx.world.flags.lookupFound = true;
    return ok(
      `找到 ${items.length} 份资料：${items.map((i) => `${i.title}（${i.version}）`).join('；')}`,
      { count: items.length, items },
      { sources: docs.map((d) => ({ title: d.title, version: d.version })) },
    );
  },
};

export const libraryReserve: ToolDefinition = {
  name: 'library.reserve',
  description: '预约指定时段，需要先查询到匹配资料。',
  kind: 'write',
  timeoutMs: 700,
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: '主题关键词。' },
      year: { type: 'integer', description: '年份。' },
      slot: { type: 'string', description: '预约时段，例如 14:00-15:00。' },
    },
    required: ['topic', 'year', 'slot'],
  },
  async execute(args, ctx): Promise<ToolResult> {
    const topic = String(args.topic ?? '');
    const year = Number(args.year ?? 0);
    const slot = String(args.slot ?? '');
    if (!ctx.world.campus.librarySlots.includes(slot)) {
      return fail('INVALID_SLOT', `无效时段：${slot}`);
    }
    const docs = ctx.world.campus.documents.filter((d) => d.year === year && d.topics.includes(topic));
    if (docs.length === 0) {
      return fail('NO_MATCHING_DOCUMENT', `未查询到 ${year} 年主题“${topic}”的资料，无法预约。`);
    }
    const existing = ctx.world.reservations.find((r) => r.slot === slot);
    if (existing) {
      return ok(`时段 ${slot} 已被预约（${existing.topic}），无需重复预约。`, {
        slot,
        topic: existing.topic,
        idempotent: true,
      });
    }
    ctx.world.reservations.push({ topic, year, slot, at: ctx.world.time });
    ctx.world.flags.reserved = true;
    return ok(`已预约 ${slot}，主题“${topic}”（${year} 年）。`, { slot, topic, year }, { effects: { slot, topic, year } });
  },
};

export const ALL_TOOLS: ToolDefinition[] = [
  runtimeInspect,
  scheduleLookup,
  calculatorEvaluate,
  documentsRetrieve,
  routePlan,
  campusMove,
  enrollmentStatus,
  enrollmentSubmit,
  libraryLookup,
  libraryReserve,
];

export const TOOL_BY_NAME: Record<string, ToolDefinition> = Object.fromEntries(
  ALL_TOOLS.map((t) => [t.name, t]),
);

export function describeTool(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    schema: tool.inputSchema,
    kind: tool.kind,
  };
}
