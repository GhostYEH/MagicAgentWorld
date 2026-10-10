/**
 * ContextBuilder：分层上下文与事实记忆。
 *
 * 三层：目标/规则与选中的事实记忆、近期观察、按需检索。
 * - 事实记忆关联来源事件与任务版本，不修改模型参数。
 * - 故障注入（C5）可移出指定凭据；被移出内容记录在 omitted 中，供界面展示。
 * - 模拟决策器只能读取装配后的可见内容；世界核验器独立读取真实状态。
 */

import type {
  ContextConfig,
  FactEntry,
  ObservationEntry,
  TaskDefinition,
  ToolDescriptor,
  VisibleContext,
  WorldState,
  HarnessConfig,
} from './types';
import { describeTool, TOOL_BY_NAME } from './tools';
import { formatTime } from './world';

export class ContextBuilder {
  private facts: FactEntry[] = [];
  private observations: ObservationEntry[] = [];
  private omitted: string[] = [];
  private task: TaskDefinition;
  private harness: HarnessConfig;

  constructor(task: TaskDefinition, harness: HarnessConfig) {
    this.task = task;
    this.harness = harness;
  }

  updateHarness(harness: HarnessConfig): void {
    this.harness = harness;
  }

  get config(): ContextConfig {
    return this.harness.context;
  }

  addFact(fact: FactEntry): void {
    if (!this.facts.some((f) => f.id === fact.id)) this.facts.push(fact);
  }

  addObservation(obs: ObservationEntry): void {
    this.observations.push(obs);
    if (this.observations.length > 50) this.observations.shift();
  }

  get allFacts(): FactEntry[] {
    return [...this.facts];
  }

  get allObservations(): ObservationEntry[] {
    return [...this.observations];
  }

  /** 从世界提取默认可见事实（例如身份核验凭据）。 */
  seedFacts(world: WorldState): void {
    const identity = world.records.identity;
    if (identity?.credential) {
      this.addFact({
        id: `fact.identity.credential`,
        text: `身份核验凭据：${identity.credential}`,
        value: { credential: identity.credential },
        sourceEventSeq: 0,
        taskVersion: this.task.taskVersion,
      });
    }
  }

  build(world: WorldState, step: number): VisibleContext {
    const dropIds = new Set(this.harness.faults?.dropFactIds ?? []);
    const limit = this.harness.faults?.contextObservationLimit;
    const obsLimit =
      typeof limit === 'number'
        ? limit
        : this.harness.context.includeObservations;

    this.omitted = [];
    let facts: FactEntry[] = [];
    const autoRecover = this.harness.autoRecover;
    if (this.harness.context.includeFacts) {
      facts = this.facts.filter((f) => {
        if (dropIds.has(f.id)) {
          if (autoRecover) {
            this.omitted.push(`事实记忆曾被移出，已由恢复策略重新加入：${f.text}`);
            return true;
          }
          this.omitted.push(`事实记忆已移出：${f.text}`);
          return false;
        }
        return true;
      });
    } else {
      this.omitted.push('事实记忆未启用（context.includeFacts=false）');
    }

    const observations =
      obsLimit > 0 ? this.observations.slice(-obsLimit) : [];
    if (obsLimit > 0 && this.observations.length > obsLimit) {
      this.omitted.push(
        `较早的 ${this.observations.length - obsLimit} 条观察已移出上下文`,
      );
    }

    const tools: ToolDescriptor[] = this.task.tools
      .map((name) => TOOL_BY_NAME[name])
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map(describeTool);

    return {
      chapterId: this.task.chapterId,
      taskVersion: this.task.taskVersion,
      goal: this.task.goal,
      rules: this.task.rules,
      facts,
      observations,
      tools,
      step,
      self: { position: world.position, time: world.time, timeText: formatTime(world.time) },
      omitted: [...this.omitted],
    };
  }
}
