/**
 * 模型适配器：区分模拟与真实。
 *
 * - 模拟决策器：每步基于“模型可见目标、工具与观察”选择动作，结果随配置与故障变化。
 *   明确标注为规则行为，不冒充真实输出。
 * - 真实适配器：在服务端执行，密钥仅在服务端。缺少 API Key 时标记为“待验收”。
 */

import type { Decision, VisibleContext } from './types';
import { countTokens } from './tokenizer';

export interface ModelRequest {
  step: number;
  visibleContext: VisibleContext;
  reservedOutputTokens: number;
}

export interface ModelResponse {
  decision: Decision;
  /** 模型可见输入的 token 计数（实际分词器）。 */
  inputTokens: number;
  outputTokens: number;
  truncated: boolean;
  simulated: boolean;
  /** 实际供应商 usage；模拟模式为 null（未知计量标注为未知）。 */
  usage: { promptTokens: number; completionTokens: number } | null;
  raw: string;
}

export interface ModelAdapter {
  readonly simulated: boolean;
  complete(request: ModelRequest, signal: AbortSignal): Promise<ModelResponse>;
}

/** 从观察结果中提取凭据（取最近的）。 */
function findCredential(ctx: VisibleContext): string | undefined {
  for (let i = ctx.facts.length - 1; i >= 0; i -= 1) {
    const v = ctx.facts[i]!.value?.credential;
    if (typeof v === 'string') return v;
  }
  for (let i = ctx.observations.length - 1; i >= 0; i -= 1) {
    const eff = ctx.observations[i]!.effects;
    const v = eff?.credential;
    if (typeof v === 'string') return v;
  }
  return undefined;
}

function lastObservationFor(ctx: VisibleContext, tool: string) {
  for (let i = ctx.observations.length - 1; i >= 0; i -= 1) {
    if (ctx.observations[i]!.tool === tool) return ctx.observations[i]!;
  }
  return undefined;
}

/**
 * 模拟决策器：基于可见上下文中的任务目标与已启用工具进行规划。
 *
 * 目标由可见目标文本推导（不直接读世界真实状态），因此当凭据被移出上下文时，
 * 决策器无法获取凭据，会表现为“缺少凭据无法提交”——这正是 C5 要复现的故障。
 */
export class SimulationModelAdapter implements ModelAdapter {
  readonly simulated = true;

  async complete(request: ModelRequest, signal: AbortSignal): Promise<ModelResponse> {
    if (signal.aborted) throw new Error('aborted');
    const ctx = request.visibleContext;
    const decision = this.plan(ctx);
    const raw = JSON.stringify(decision);
    const inputTokens = countTokens(
      [ctx.goal, ...ctx.rules, ...ctx.facts.map((f) => f.text), ...ctx.observations.map((o) => o.summary)].join('\n'),
    );
    const outputTokens = countTokens(raw);
    // 模拟延迟，让“单步/暂停”可见。
    await new Promise((r) => setTimeout(r, 60));
    return {
      decision,
      inputTokens,
      outputTokens,
      truncated: false,
      simulated: true,
      usage: null,
      raw,
    };
  }

  private plan(ctx: VisibleContext): Decision {
    const tools = new Set(ctx.tools.map((t) => t.name));
    const goal = ctx.goal;

    const movedTo = (loc: string) =>
      ctx.observations.some((o) => o.tool === 'campus.move' && o.ok && (o.effects?.position === loc || o.args?.to === loc));
    const lastMoveTo = (): string | undefined => {
      for (let i = ctx.observations.length - 1; i >= 0; i -= 1) {
        const o = ctx.observations[i]!;
        if (o.tool === 'campus.move' && o.ok) return String(o.args?.to ?? o.effects?.position ?? '');
      }
      return undefined;
    };

    // C6：查询资料并预约。
    if (goal.includes('预约') && tools.has('library.reserve')) {
      const lookup = lastObservationFor(ctx, 'library.lookup');
      const reserved = ctx.observations.some((o) => o.tool === 'library.reserve' && o.ok);
      if (!lookup) {
        return {
          kind: 'tool',
          tool: 'library.lookup',
          args: { topic: '人工智能', year: 2024 },
          rationale: '先查询满足主题与年份的资料，取得可核验来源。',
        };
      }
      const slot = ctx.facts.find((f) => f.id === 'fact.reserve.slot')?.value?.slot;
      const slotText = typeof slot === 'string' ? slot : '14:00-15:00';
      if (!reserved) {
        return {
          kind: 'tool',
          tool: 'library.reserve',
          args: { topic: '人工智能', year: 2024, slot: slotText },
          rationale: '资料查询成功，按指定时段预约。',
        };
      }
      return { kind: 'finish', rationale: '已查询资料并完成预约。' };
    }

    // C2：手动工具 —— 决策器不主动执行，由玩家手动调用。
    if (goal.includes('工具') && !tools.has('enrollment.submit') && !tools.has('library.reserve')) {
      return { kind: 'finish', rationale: '本关由玩家手动选择工具调用。' };
    }

    // C3/C4/C5：多步报到（移动 → 身份 → 移动 → 宿舍 → 移动 → 校园卡）。
    if (goal.includes('报到') && tools.has('enrollment.submit')) {
      const submitted = (item: string) =>
        ctx.observations.some((o) => o.tool === 'enrollment.submit' && o.ok && o.effects?.item === item);

      const sequence: Array<{ item: string; location: string }> = [
        { item: 'identity', location: 'admin' },
        { item: 'dorm', location: 'dorm' },
        { item: 'card', location: 'card_center' },
      ];

      for (const step of sequence) {
        if (submitted(step.item)) continue;
        if (movedTo(step.location)) {
          const credential = findCredential(ctx);
          if (step.item !== 'identity' && !credential && tools.has('enrollment.status')) {
            const prereq = step.item === 'dorm' ? 'identity' : 'dorm';
            return {
              kind: 'tool',
              tool: 'enrollment.status',
              args: { item: prereq },
              rationale: `上下文中缺少 ${step.item} 所需凭据，先查询 ${prereq} 状态以取回凭据。`,
            };
          }
          const args: Record<string, unknown> = { item: step.item };
          if (step.item !== 'identity' && credential) args.credential = credential;
          return {
            kind: 'tool',
            tool: 'enrollment.submit',
            args,
            rationale: `在 ${step.location} 完成 ${step.item}。${
              step.item !== 'identity' && !credential ? '（注意：上下文中缺少凭据，可能失败）' : ''
            }`,
          };
        }
        // 尚未到达目标地点：先规划/移动。
        const last = lastMoveTo();
        if (last === step.location) {
          // 已移动但未成功（例如闭馆），尝试重新规划。
          return { kind: 'tool', tool: 'route.plan', args: { to: step.location }, rationale: '重新规划路线。' };
        }
        if (tools.has('campus.move')) {
          return {
            kind: 'tool',
            tool: 'campus.move',
            args: { to: step.location },
            rationale: `移动到 ${step.location} 以办理 ${step.item}。`,
          };
        }
        return { kind: 'tool', tool: 'route.plan', args: { to: step.location }, rationale: '规划前往办理地点的路线。' };
      }
      return { kind: 'finish', rationale: '三项报到事项均已完成。' };
    }

    return { kind: 'finish', rationale: '没有可执行的下一步。' };
  }
}
