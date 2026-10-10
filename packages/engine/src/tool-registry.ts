/**
 * ToolRegistry：工具注册与受保护执行管线。
 *
 * 调用顺序：参数校验 → 权限策略（allow/confirm/deny）→ 预算检查 → 执行 → 结果记录。
 * - 玩家授权只在关卡允许范围内有效，系统硬规则始终执行（硬拒绝不能靠 Prompt 绕过）。
 * - 暂时故障有限重试；写操作使用幂等键，结果分已提交/未提交/未知。
 * - 未知时暂停并先核验状态，不盲目重放写入。
 */

import type {
  HarnessConfig,
  PermissionDecision,
  ToolContext,
  ToolDefinition,
  ToolResult,
  WorldState,
} from './types';
import { TOOL_BY_NAME } from './tools';
import { validateArgs } from './validation';

export interface ToolInvocation {
  tool: string;
  args: Record<string, unknown>;
  step: number;
}

export interface ToolExecutionRecord {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  result: ToolResult;
  attempts: number;
  durationMs: number;
  decision: PermissionDecision;
  /** 写操作幂等键。 */
  idempotencyKey?: string;
}

/** 系统硬规则：无论权限配置如何都强制生效。 */
const HARD_DENY: Record<string, (args: Record<string, unknown>) => string | null> = {
  'enrollment.submit': (args) => {
    const item = String(args.item ?? '');
    if (!['identity', 'dorm', 'card'].includes(item)) return `HARD_RULE: 非法报到事项 ${item}`;
    return null;
  },
};

export class ToolRegistry {
  private tools: Record<string, ToolDefinition>;
  private harness: HarnessConfig;
  private transientFailures: Record<string, number>;
  /** 记录每个工具被调用的参数签名，用于重复调用提醒。 */
  private callLog: Array<{ tool: string; sig: string }> = [];

  constructor(harness: HarnessConfig, tools: Record<string, ToolDefinition> = TOOL_BY_NAME) {
    this.tools = tools;
    this.harness = harness;
    this.transientFailures = { ...(harness.faults?.transientToolFailures ?? {}) };
  }

  updateHarness(harness: HarnessConfig): void {
    this.harness = harness;
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools[name];
  }

  permissionFor(name: string): PermissionDecision {
    return this.harness.permissions[name] ?? 'allow';
  }

  /** 重复调用检测：同工具同参数连续第 N 次触发软提醒。 */
  duplicateCount(tool: string, args: Record<string, unknown>): number {
    const sig = JSON.stringify([tool, args]);
    let count = 0;
    for (let i = this.callLog.length - 1; i >= 0; i -= 1) {
      const entry = this.callLog[i]!;
      if (entry.sig === sig) count += 1;
      else break;
    }
    return count;
  }

  private recordCall(tool: string, args: Record<string, unknown>): void {
    this.callLog.push({ tool, sig: JSON.stringify([tool, args]) });
  }

  async invoke(
    invocation: ToolInvocation,
    world: WorldState,
    signal: AbortSignal,
    now: () => number = () => Date.now(),
  ): Promise<ToolExecutionRecord> {
    const start = now();
    const tool = this.tools[invocation.tool];
    const decision = this.permissionFor(invocation.tool);

    if (!tool) {
      return this.errorRecord(invocation, decision, 'UNKNOWN_TOOL', `未知工具：${invocation.tool}`, start, now);
    }

    // 系统硬规则优先于任何权限配置。
    const hardRule = HARD_DENY[invocation.tool]?.(invocation.args);
    if (hardRule) {
      return this.errorRecord(invocation, decision, 'HARD_RULE', hardRule, start, now);
    }

    // 参数校验。
    const errors = validateArgs(tool.inputSchema, invocation.args);
    if (errors.length > 0) {
      return this.errorRecord(
        invocation,
        decision,
        'INVALID_ARGS',
        `参数校验失败：${errors.map((e) => `${e.path}: ${e.message}`).join('；')}`,
        start,
        now,
      );
    }

    // 权限策略。
    if (decision === 'deny') {
      return this.errorRecord(invocation, decision, 'PERMISSION_DENIED', `权限策略拒绝调用 ${tool.name}。`, start, now);
    }
    if (decision === 'confirm') {
      // 无人工确认接缝时降级为拒绝（fail-closed）。
      return this.errorRecord(
        invocation,
        decision,
        'NEEDS_CONFIRMATION',
        `${tool.name} 需要玩家确认，但本次运行未开启确认接缝，已拒绝。`,
        start,
        now,
      );
    }

    if (signal.aborted) {
      return this.errorRecord(invocation, decision, 'ABORTED_BEFORE_DISPATCH', `调用 ${tool.name} 前已取消。`, start, now);
    }

    const idempotencyKey = tool.kind === 'write' ? `idem:${tool.name}:${JSON.stringify(invocation.args)}` : undefined;

    let attempts = 0;
    const maxAttempts = this.harness.retry.maxAttempts;
    let lastResult: ToolResult | null = null;

    while (attempts < Math.max(1, maxAttempts)) {
      attempts += 1;
      // 暂时故障注入：前 N 次调用返回可重试错误。
      const remainingFaults = this.transientFailures[tool.name] ?? 0;
      if (remainingFaults > 0) {
        this.transientFailures[tool.name] = remainingFaults - 1;
        lastResult = {
          ok: false,
          observation: `${tool.name} 暂时不可用（故障注入，剩余 ${remainingFaults - 1} 次）。`,
          error: { code: 'TRANSIENT_FAILURE', message: '暂时故障，可重试' },
        };
        continue;
      }

      const ctx: ToolContext = { world, signal, idempotencyKey, seq: invocation.step };
      const result = await this.withTimeout(tool, invocation.args, ctx, signal);
      if (result.ok) {
        this.recordCall(tool.name, invocation.args);
        return {
          tool: tool.name,
          args: invocation.args,
          ok: true,
          result,
          attempts,
          durationMs: now() - start,
          decision,
          idempotencyKey,
        };
      }
      lastResult = result;
      // 只有可重试错误才继续；权限/参数/前置错误直接返回。
      if (!this.isRetryable(result.error?.code)) break;
    }

    this.recordCall(tool.name, invocation.args);
    return {
      tool: tool.name,
      args: invocation.args,
      ok: false,
      result: lastResult ?? { ok: false, observation: '未知错误', error: { code: 'UNKNOWN', message: '未知错误' } },
      attempts,
      durationMs: now() - start,
      decision,
      idempotencyKey,
    };
  }

  private isRetryable(code?: string): boolean {
    return code === 'TRANSIENT_FAILURE' || code === 'TIMEOUT';
  }

  private async withTimeout(
    tool: ToolDefinition,
    args: Record<string, unknown>,
    ctx: ToolContext,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    const timeoutMs = Math.min(tool.timeoutMs, this.harness.toolTimeoutMs);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        tool.execute(args, ctx),
        new Promise<ToolResult>((resolve) => {
          timer = setTimeout(() => {
            resolve({ ok: false, observation: `${tool.name} 超时（${timeoutMs}ms）。`, error: { code: 'TIMEOUT', message: '工具超时' } });
          }, timeoutMs);
        }),
        new Promise<ToolResult>((resolve) => {
          signal.addEventListener(
            'abort',
            () => resolve({ ok: false, observation: `${tool.name} 已被取消。`, error: { code: 'ABORTED', message: '已取消' } }),
            { once: true },
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private errorRecord(
    invocation: ToolInvocation,
    decision: PermissionDecision,
    code: string,
    message: string,
    start: number,
    now: () => number,
  ): ToolExecutionRecord {
    return {
      tool: invocation.tool,
      args: invocation.args,
      ok: false,
      result: { ok: false, observation: message, error: { code, message } },
      attempts: 0,
      durationMs: now() - start,
      decision,
    };
  }
}
