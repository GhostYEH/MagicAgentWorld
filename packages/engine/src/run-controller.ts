/**
 * RunController：分步循环与状态机。
 *
 * - 一步执行一项行动；支持开始、单步、连续、暂停、继续、取消。
 * - 暂停在行动边界生效；取消传递 AbortSignal，阻止后续行动与未提交写入。
 * - 已提交状态与迟到回执保留在原运行。
 * - 每次运行冻结任务、模型选择、输入与配置。
 * - 世界变更与事件原子提交。
 */

import type {
  Decision,
  HarnessConfig,
  ObservationEntry,
  RunInput,
  TaskDefinition,
  VisibleContext,
  WorldState,
} from './types';
import { cloneWorld, formatTime } from './world';
import { EventRecorder } from './event-recorder';
import { ContextBuilder } from './context-builder';
import { BudgetController } from './budget-controller';
import { ToolRegistry, type ToolExecutionRecord } from './tool-registry';
import { RecoveryPolicy } from './recovery-policy';
import { verifyTask } from './verifier';
import { SimulationModelAdapter, type ModelAdapter, type ModelResponse } from './model-adapter';
import { TOOL_BY_NAME } from './tools';

export type RunState = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface RunControllerOptions {
  now?: () => number;
  modelFactory?: (input: RunInput) => ModelAdapter;
}

export class RunController {
  readonly runId: string;
  readonly input: RunInput;
  readonly task: TaskDefinition;
  readonly recorder: EventRecorder;
  readonly world: WorldState;
  private contextBuilder: ContextBuilder;
  private toolRegistry: ToolRegistry;
  private budget: BudgetController;
  private recovery = new RecoveryPolicy();
  private model: ModelAdapter;
  private now: () => number;
  private abortController = new AbortController();
  private state: RunState = 'idle';
  private paused = false;
  private lastVisibleContext: VisibleContext | null = null;
  private lastModelResponse: ModelResponse | null = null;
  /** 旧运行的迟到回执计数（保留在原运行）。 */
  lateReceipts = 0;

  constructor(runId: string, input: RunInput, task: TaskDefinition, options: RunControllerOptions = {}) {
    this.runId = runId;
    this.input = input;
    this.task = task;
    this.now = options.now ?? (() => Date.now());
    this.world = cloneWorld(task.initialWorld);
    this.recorder = new EventRecorder(runId, this.now);
    this.contextBuilder = new ContextBuilder(task, input.harnessConfig);
    this.toolRegistry = new ToolRegistry(input.harnessConfig, TOOL_BY_NAME);
    this.budget = new BudgetController(
      {
        maxSteps: input.harnessConfig.maxSteps,
        maxModelRequests: input.harnessConfig.maxModelRequests,
        reservedOutputTokens: input.harnessConfig.reservedOutputTokens,
        deadlineMs: input.harnessConfig.deadlineMs,
      },
      this.now,
    );
    this.model = options.modelFactory
      ? options.modelFactory(input)
      : new SimulationModelAdapter();
    this.contextBuilder.seedFacts(this.world);
    for (const fact of task.initialFacts ?? []) {
      this.contextBuilder.addFact({ ...fact, taskVersion: task.taskVersion });
    }
  }

  get currentState(): RunState {
    return this.state;
  }

  get budgetSnapshot() {
    return this.budget.snapshot(this.now(), this.budget.actualUsageTokens);
  }

  get visibleContext(): VisibleContext | null {
    return this.lastVisibleContext;
  }

  get harnessConfig(): HarnessConfig {
    return this.input.harnessConfig;
  }

  /** 最近一次模型响应（供界面展示）。 */
  get lastModel(): ModelResponse | null {
    return this.lastModelResponse;
  }

  /** 冻结运行：记录 run.start 与配置快照。 */
  initialize(): void {
    this.recorder.record('run.start', {
      chapterId: this.input.chapterId,
      taskVersion: this.input.taskVersion,
      mode: this.input.mode,
      seed: this.input.seed,
      harnessConfig: this.input.harnessConfig,
    }, cloneWorld(this.world));
    this.recorder.record('budget.update', this.budgetSnapshot);
  }

  async start(): Promise<void> {
    if (this.state === 'completed' || this.state === 'cancelled') return;
    this.state = 'running';
    this.paused = false;
    await this.loop();
  }

  /** 单步执行一项行动。 */
  async step(): Promise<void> {
    if (this.state === 'completed' || this.state === 'cancelled') return;
    this.state = 'running';
    await this.executeStep();
    if (this.state === 'running') this.state = 'paused';
  }

  /** 连续运行直到暂停/完成/预算耗尽。 */
  private async loop(): Promise<void> {
    while (this.state === 'running' && !this.paused && !this.abortController.signal.aborted) {
      const done = await this.executeStep();
      if (done) break;
    }
  }

  pause(): void {
    if (this.state === 'running') {
      this.paused = true;
      this.state = 'paused';
      this.recorder.record('run.end', { reason: 'paused' });
    }
  }

  async resume(): Promise<void> {
    if (this.state === 'paused') {
      this.state = 'running';
      this.paused = false;
      await this.loop();
    }
  }

  cancel(reason = 'user'): void {
    if (this.state === 'completed' || this.state === 'cancelled') return;
    this.abortController.abort(reason);
    this.state = 'cancelled';
    this.recorder.record('run.end', { reason: 'cancelled', message: reason });
  }

  /** 执行一步：装配上下文 → 模型决策 → 工具执行 → 核验。返回是否终止。 */
  private async executeStep(): Promise<boolean> {
    if (this.abortController.signal.aborted) return true;
    if (!this.budget.canStartStep()) {
      this.state = 'error';
      this.recorder.record('error', { code: 'STEP_BUDGET_EXHAUSTED', message: '步数预算耗尽' });
      this.recorder.record('run.end', { reason: 'budget', message: '步数预算耗尽' });
      return true;
    }
    if (this.budget.isDeadlineExceeded(this.now())) {
      this.state = 'error';
      this.recorder.record('error', { code: 'DEADLINE_EXCEEDED', message: '运行截止时间已到' });
      this.recorder.record('run.end', { reason: 'deadline', message: '运行截止时间已到' });
      return true;
    }
    if (!this.budget.canRequestModel()) {
      this.state = 'error';
      this.recorder.record('error', { code: 'REQUEST_BUDGET_EXHAUSTED', message: '模型请求预算耗尽' });
      this.recorder.record('run.end', { reason: 'budget', message: '模型请求预算耗尽' });
      return true;
    }

    this.budget.consumeStep();
    const step = this.budget.steps;
    this.recorder.setStep(step);
    this.recorder.record('step.start', { step });

    const visible = this.contextBuilder.build(this.world, step);
    this.lastVisibleContext = visible;
    this.recorder.record('context.snapshot', {
      goal: visible.goal,
      facts: visible.facts,
      observations: visible.observations,
      omitted: visible.omitted,
    });

    // 模型请求。
    const reserved = this.input.harnessConfig.reservedOutputTokens;
    this.recorder.record('model.request', {
      step,
      visibleContext: visible,
      reservedOutputTokens: reserved,
    });
    this.budget.consumeModelRequest(reserved);

    let response: ModelResponse;
    try {
      response = await this.withRequestTimeout(
        this.model.complete({ step, visibleContext: visible, reservedOutputTokens: reserved }, this.abortController.signal),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.abortController.signal.aborted) {
        this.recorder.record('run.end', { reason: 'cancelled', message });
        return true;
      }
      this.state = 'error';
      this.recorder.record('error', { code: 'MODEL_ERROR', message });
      this.recorder.record('run.end', { reason: 'error', message });
      return true;
    }

    this.lastModelResponse = response;
    if (response.usage) {
      this.budget.actualUsageTokens =
        (this.budget.actualUsageTokens ?? 0) + response.usage.promptTokens + response.usage.completionTokens;
    }
    this.recorder.record('model.response', {
      step,
      decision: response.decision,
      truncated: response.truncated,
      simulated: response.simulated,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      usage: response.usage,
    });

    if (response.truncated) {
      this.recorder.record('error', { code: 'TRUNCATED_RESPONSE', message: '模型响应被截断，未执行工具。' });
      this.recorder.record('step.end', { step, terminated: false });
      return false;
    }

    const decision: Decision = response.decision;
    if (decision.kind === 'finish') {
      await this.finalize();
      return true;
    }

    // 工具执行。
    const duplicate = this.toolRegistry.duplicateCount(decision.tool, decision.args);
    if (duplicate >= 2) {
      this.recorder.record('guard.reminder', {
        tool: decision.tool,
        count: duplicate + 1,
        message: `工具 ${decision.tool} 以相同参数连续调用 ${duplicate + 1} 次，请注意是否无进展。`,
      });
    }

    const exec = await this.toolRegistry.invoke(
      { tool: decision.tool, args: decision.args, step },
      this.world,
      this.abortController.signal,
      this.now,
    );

    if (exec.attempts > 1) this.budget.consumeRetry();

    const recovery = this.recovery.decide(exec.result, this.toolRegistry.get(decision.tool)?.kind === 'write');
    this.recorder.record('tool.call', { step, tool: decision.tool, args: decision.args, rationale: decision.rationale });
    this.recorder.record('tool.result', {
      tool: decision.tool,
      ok: exec.ok,
      observation: exec.result.observation,
      commitState: exec.result.commitState,
      errorCode: exec.result.error?.code,
      attempts: exec.attempts,
      durationMs: exec.durationMs,
      recovery: recovery.action,
    });

    const observation: ObservationEntry = {
      seq: this.recorder.lastSeq,
      step,
      tool: decision.tool,
      args: decision.args,
      ok: exec.ok,
      summary: exec.result.observation,
      effects: exec.result.effects ?? (exec.result.value as Record<string, unknown> | undefined),
    };
    this.contextBuilder.addObservation(observation);

    // 成功写入时，将新凭据加入事实记忆（模型可继续使用）。
    const effects = exec.result.effects ?? (exec.result.value as Record<string, unknown> | undefined);
    if (exec.ok && effects && typeof effects.credential === 'string' && typeof effects.item === 'string') {
      this.contextBuilder.addFact({
        id: `fact.enrollment.${effects.item}.credential`,
        text: `${effects.item} 提交凭据：${effects.credential}`,
        value: { credential: effects.credential },
        sourceEventSeq: this.recorder.lastSeq,
        taskVersion: this.task.taskVersion,
      });
    }

    this.world.lastAction = { tool: decision.tool, ok: exec.ok, at: this.world.time };
    // 世界变更与事件原子提交。
    this.recorder.record('world.change', {
      path: 'world',
      before: null,
      after: { time: this.world.time, position: this.world.position, records: this.world.records },
    }, cloneWorld(this.world));
    this.recorder.record('budget.update', this.budgetSnapshot);

    const verification = verifyTask(this.task, this.world);
    this.recorder.record('verification', {
      passed: verification.passed,
      checks: verification.checks,
    });

    this.recorder.record('step.end', { step, terminated: false });

    if (verification.passed) {
      await this.finalize();
      return true;
    }
    return false;
  }

  private async finalize(): Promise<void> {
    const verification = verifyTask(this.task, this.world);
    this.recorder.record('verification', { passed: verification.passed, checks: verification.checks });
    if (verification.passed) {
      this.recorder.record('badge', {
        id: `badge.${this.task.chapterId}`,
        label: `${this.task.title} 通关`,
        evidence: verification.checks.map((c) => `${c.label}: ${c.passed ? '通过' : '未通过'}`),
      });
    }
    this.state = 'completed';
    this.recorder.record('run.end', {
      reason: 'completed',
      message: verification.passed ? '任务核验通过' : '模型结束，但任务未通过核验',
    }, cloneWorld(this.world));
  }

  /**
   * 记录一次 C1 输入实验：更新世界标志并触发核验。
   * variantKey 用于统计“比较了不同输入变化”。
   */
  recordGenerationExperiment(input: { grounded: boolean; acknowledgesUnknown: boolean; variantKey: string }): void {
    this.world.flags.c1Generated = true;
    if (input.grounded) this.world.flags.c1GroundedSeen = true;
    if (input.acknowledgesUnknown) this.world.flags.c1UnknownSeen = true;
    const seen = new Set<string>(Array.isArray(this.c1Variants) ? this.c1Variants : []);
    seen.add(input.variantKey);
    this.c1Variants = [...seen];
    this.world.flags.c1Variants = seen.size;
    this.recorder.record('world.change', { path: 'flags', before: null, after: this.world.flags }, cloneWorld(this.world));
    this.checkCompletion();
  }

  private c1Variants: string[] = [];

  /** 记录一次模型结束但未通过核验的情形（供 UI 展示）。 */
  get finalVerification() {
    return verifyTask(this.task, this.world);
  }

  /**
   * 手动触发核验与徽章（用于 C1 单轮生成等非循环章节）。
   * 返回核验结果；通过时记录 verification 与 badge 事件。
   */
  checkCompletion(): ReturnType<typeof verifyTask> {
    const verification = verifyTask(this.task, this.world);
    this.recorder.record('verification', { passed: verification.passed, checks: verification.checks });
    if (verification.passed && this.state !== 'completed') {
      this.recorder.record('badge', {
        id: `badge.${this.task.chapterId}`,
        label: `${this.task.title} 通关`,
        evidence: verification.checks.map((c) => `${c.label}: ${c.passed ? '通过' : '未通过'}`),
      }, cloneWorld(this.world));
      this.state = 'completed';
    }
    return verification;
  }

  get worldSummary() {
    return {
      time: formatTime(this.world.time),
      position: this.world.position,
      records: this.world.records,
      reservations: this.world.reservations,
    };
  }

  private async withRequestTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeoutMs = this.input.harnessConfig.requestTimeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`模型请求超时（${timeoutMs}ms）`)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** 注入一个迟到回执（属于本运行，但晚于取消）。 */
  noteLateReceipt(): void {
    this.lateReceipts += 1;
  }

  /**
   * 手动调用工具（C2 玩家手动选择工具）。
   * 复用同一套校验/权限/预算/记录管线，并做独立核验。
   */
  async manualInvoke(tool: string, args: Record<string, unknown>): Promise<ToolExecutionRecord> {
    if (this.state === 'cancelled') {
      return {
        tool,
        args,
        ok: false,
        result: { ok: false, observation: '运行已取消。', error: { code: 'CANCELLED', message: '运行已取消' } },
        attempts: 0,
        durationMs: 0,
        decision: 'allow',
      };
    }
    if (!this.budget.canStartStep()) {
      this.recorder.record('error', { code: 'STEP_BUDGET_EXHAUSTED', message: '步数预算耗尽，无法继续手动调用' });
      return {
        tool,
        args,
        ok: false,
        result: { ok: false, observation: '步数预算耗尽。', error: { code: 'STEP_BUDGET_EXHAUSTED', message: '预算耗尽' } },
        attempts: 0,
        durationMs: 0,
        decision: 'allow',
      };
    }
    this.budget.consumeStep();
    const step = this.budget.steps;
    this.recorder.setStep(step);
    this.recorder.record('step.start', { step, manual: true });
    const visible = this.contextBuilder.build(this.world, step);
    this.lastVisibleContext = visible;

    const duplicate = this.toolRegistry.duplicateCount(tool, args);
    if (duplicate >= 2) {
      this.recorder.record('guard.reminder', {
        tool,
        count: duplicate + 1,
        message: `工具 ${tool} 以相同参数连续调用 ${duplicate + 1} 次，请注意是否无进展。`,
      });
    }

    const exec = await this.toolRegistry.invoke({ tool, args, step }, this.world, this.abortController.signal, this.now);
    if (exec.attempts > 1) this.budget.consumeRetry();

    this.recorder.record('tool.call', { step, tool, args, rationale: '玩家手动调用' });
    this.recorder.record('tool.result', {
      tool,
      ok: exec.ok,
      observation: exec.result.observation,
      commitState: exec.result.commitState,
      errorCode: exec.result.error?.code,
      attempts: exec.attempts,
      durationMs: exec.durationMs,
    });

    this.contextBuilder.addObservation({
      seq: this.recorder.lastSeq,
      step,
      tool,
      args,
      ok: exec.ok,
      summary: exec.result.observation,
      effects: exec.result.effects ?? (exec.result.value as Record<string, unknown> | undefined),
    });

    this.world.lastAction = { tool, ok: exec.ok, at: this.world.time };
    this.recorder.record('world.change', {
      path: 'world',
      before: null,
      after: { time: this.world.time, position: this.world.position, records: this.world.records },
    }, cloneWorld(this.world));
    this.recorder.record('budget.update', this.budgetSnapshot);

    const verification = verifyTask(this.task, this.world);
    this.recorder.record('verification', { passed: verification.passed, checks: verification.checks });
    this.recorder.record('step.end', { step, manual: true, terminated: false });

    if (verification.passed) {
      await this.finalize();
    }
    return exec;
  }
}
