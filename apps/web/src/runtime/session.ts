/**
 * 运行适配接口：模拟在浏览器执行，真实模式在服务端执行，两者共用规则与事件语义。
 *
 * 界面只通过该接口操作运行；切换运行后忽略旧运行事件并清理监听器。
 */

import {
  DEFAULT_HARNESS_CONFIG,
  generate as engineGenerate,
  mergeHarnessConfig,
  RunController,
  type BudgetSnapshot,
  type ChapterId,
  type GenerationOutput,
  type HarnessConfig,
  type Mode,
  type RunEvent,
  type RunState,
  type ToolExecutionRecord,
  type VerificationResult,
  type VisibleContext,
  type WorldState,
  type ToolExecutionRecord as ToolExecRecord,
} from '@agentcraft/engine';
import { getTask } from '@agentcraft/content';

export interface SessionSnapshot {
  runId: string;
  chapterId: ChapterId;
  mode: Mode;
  status: RunState;
  events: RunEvent[];
  budget: BudgetSnapshot;
  visibleContext: VisibleContext | null;
  world: WorldState;
  verification: VerificationResult;
}

export interface RunSession {
  readonly runId: string;
  readonly chapterId: ChapterId;
  readonly mode: Mode;
  start(): Promise<void>;
  step(): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  cancel(): void;
  invoke(tool: string, args: Record<string, unknown>): Promise<ToolExecutionRecord>;
  generate(prompt: string, visibleAnnouncementIds: string[]): GenerationOutput;
  snapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

let runCounter = 0;

export class SimulationSession implements RunSession {
  readonly runId: string;
  readonly chapterId: ChapterId;
  readonly mode: Mode;
  private controller: RunController;
  private listeners = new Set<() => void>();
  private unsub: () => void;
  private disposed = false;

  constructor(chapterId: ChapterId, mode: Mode, seed: number, harnessOverride?: Partial<HarnessConfig>) {
    this.chapterId = chapterId;
    this.mode = mode;
    const task = getTask(chapterId);
    const harness = mergeHarnessConfig(
      mergeHarnessConfig(DEFAULT_HARNESS_CONFIG, task.defaultHarness),
      harnessOverride,
    );
    runCounter += 1;
    this.runId = `${chapterId}-${Date.now()}-${runCounter}`;
    this.controller = new RunController(
      this.runId,
      { chapterId, taskVersion: task.taskVersion, mode, seed, harnessConfig: harness },
      task,
    );
    this.controller.initialize();
    this.unsub = this.controller.recorder.subscribe(() => this.emit());
  }

  private emit(): void {
    if (this.disposed) return;
    for (const l of this.listeners) l();
  }

  async start(): Promise<void> {
    await this.controller.start();
    this.emit();
  }

  async step(): Promise<void> {
    await this.controller.step();
    this.emit();
  }

  pause(): void {
    this.controller.pause();
    this.emit();
  }

  async resume(): Promise<void> {
    await this.controller.resume();
    this.emit();
  }

  cancel(): void {
    this.controller.cancel();
    this.emit();
  }

  async invoke(tool: string, args: Record<string, unknown>): Promise<ToolExecutionRecord> {
    const record = await this.controller.manualInvoke(tool, args);
    this.emit();
    return record;
  }

  generate(prompt: string, visibleAnnouncementIds: string[]): GenerationOutput {
    // The generator uses source order. The comparison key must identify the same
    // context regardless of Set insertion order, duplicate IDs or unknown IDs.
    const contextIds = this.controller.world.campus.announcements.filter(a => visibleAnnouncementIds.includes(a.id)).map(a => a.id);
    const output = engineGenerate({
      prompt,
      visibleAnnouncementIds: contextIds,
      world: this.controller.world,
      mode: this.mode,
    });
    this.controller.recorder.record('model.request', {
      step: this.controller.budgetSnapshot.steps,
      prompt,
      visibleAnnouncementIds: contextIds,
    });
    this.controller.recorder.record('model.response', {
      step: this.controller.budgetSnapshot.steps,
      answer: output.answer,
      evidence: output.evidence,
      grounded: output.grounded,
      simulated: output.simulated,
      tokens: output.tokens,
    });
    this.controller.recordGenerationExperiment({
      grounded: output.grounded,
      acknowledgesUnknown: output.acknowledgesUnknown,
      variantKey: JSON.stringify([prompt, contextIds]),
    });
    this.emit();
    return output;
  }

  snapshot(): SessionSnapshot {
    return {
      runId: this.runId,
      chapterId: this.chapterId,
      mode: this.mode,
      status: this.controller.currentState,
      events: this.controller.recorder.list(),
      budget: this.controller.budgetSnapshot,
      visibleContext: this.controller.visibleContext,
      world: this.controller.world,
      verification: this.controller.finalVerification,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    this.unsub();
    this.listeners.clear();
  }
}

/**
 * 真实模式运行：在服务端执行，通过 SSE 接收事件。
 * 缺少 API Key 时，创建运行会返回 NEEDS_KEY，界面标记为“待验收”。
 */
export class RemoteSession implements RunSession {
  readonly chapterId: ChapterId;
  readonly mode: Mode = 'real';
  runId = '';
  private source: EventSource | null = null;
  private listeners = new Set<() => void>();
  private state: SessionSnapshot;
  private baseUrl: string;

  constructor(chapterId: ChapterId, baseUrl = '') {
    this.chapterId = chapterId;
    this.baseUrl = baseUrl;
    const task = getTask(chapterId);
    this.state = {
      runId: '',
      chapterId,
      mode: 'real',
      status: 'idle',
      events: [],
      budget: {
        steps: 0,
        maxSteps: 0,
        modelRequests: 0,
        maxModelRequests: 0,
        reservedOutputTokens: 0,
        maxReservedOutputTokens: 0,
        toolRetries: 0,
        elapsedMs: 0,
        deadlineMs: 0,
        gameEnergy: 100,
        experimentalTokens: 0,
        actualUsageTokens: null,
      },
      visibleContext: null,
      world: task.initialWorld,
      verification: { passed: false, checks: [] },
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  private async post(path: string, body?: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async start(): Promise<void> {
    const res = await this.post('/api/runs', { chapterId: this.chapterId, mode: 'real' });
    if (!res.ok) {
      const text = await res.text();
      this.state.status = 'error';
      this.state.events = [
        ...this.state.events,
        {
          runId: this.runId || 'remote',
          seq: this.state.events.length + 1,
          step: 0,
          type: 'error',
          at: Date.now(),
          payload: { code: 'REAL_MODE_UNAVAILABLE', message: text },
        },
      ];
      this.emit();
      return;
    }
    const data = (await res.json()) as { runId: string };
    this.runId = data.runId;
    this.state.runId = data.runId;
    this.state.status = 'running';
    this.openStream();
    await this.post(`/api/runs/${this.runId}/control`, { action: 'start' });
    this.emit();
  }

  private openStream(): void {
    this.closeStream();
    this.source = new EventSource(`${this.baseUrl}/api/runs/${this.runId}/events`);
    this.source.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data) as RunEvent;
        if (event.runId !== this.runId) return; // 忽略旧运行事件
        if (this.state.events.some((e) => e.seq === event.seq)) return; // 按序去重
        this.state.events = [...this.state.events, event];
        this.emit();
      } catch {
        // 忽略解析失败
      }
    };
    this.source.onerror = () => {
      // 断线后浏览器会自动重连并按 seq 补取（服务端支持 since 参数）。
    };
  }

  private closeStream(): void {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
  }

  async step(): Promise<void> {
    await this.post(`/api/runs/${this.runId}/control`, { action: 'step' });
  }

  pause(): void {
    void this.post(`/api/runs/${this.runId}/control`, { action: 'pause' });
  }

  async resume(): Promise<void> {
    await this.post(`/api/runs/${this.runId}/control`, { action: 'resume' });
  }

  cancel(): void {
    void this.post(`/api/runs/${this.runId}/control`, { action: 'cancel' });
  }

  async invoke(tool: string, args: Record<string, unknown>): Promise<ToolExecRecord> {
    const res = await this.post(`/api/runs/${this.runId}/invoke`, { tool, args });
    return (await res.json()) as ToolExecRecord;
  }

  generate(prompt: string, visibleAnnouncementIds: string[]): GenerationOutput {
    // C1 生成在服务端进行；此处返回占位并提示需联网。
    return engineGenerate({ prompt, visibleAnnouncementIds, world: this.state.world, mode: 'real' });
  }

  snapshot(): SessionSnapshot {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.closeStream();
    this.listeners.clear();
  }
}
