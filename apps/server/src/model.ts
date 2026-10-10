/**
 * 真实模型适配器（OpenAI 兼容 Chat Completions）。
 *
 * - 密钥仅在服务端；浏览器提交的“成功”不能代替服务端核验。
 * - 缺少 API Key 时返回 NEEDS_KEY，真实调用列为待验收；模拟模式继续完整交付。
 * - 只有确认完整、参数有效的工具调用才执行；截断或异常响应留作诊断。
 * - 供应商 usage 缺失时标注为未知（null）。
 */

import type { Decision, ModelAdapter, ModelRequest, ModelResponse, VisibleContext } from '@agentcraft/engine';
import { countTokens } from '@agentcraft/engine';

export interface RealModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export class MissingKeyError extends Error {
  code = 'NEEDS_KEY';
  constructor() {
    super('缺少 MODEL_API_KEY，真实调用未验收。');
  }
}

function buildPrompt(ctx: VisibleContext): { system: string; user: string } {
  const system = [
    '你是一个校园助手，必须只依据提供的可见信息行动。',
    '每步只输出一个 JSON 对象，格式为 {"kind":"tool","tool":"<工具名>","args":{...},"rationale":"..."} 或 {"kind":"finish","rationale":"..."}。',
    '可用工具：',
    ...ctx.tools.map((t) => `- ${t.name}: ${t.description}`),
    '规则：',
    ...ctx.rules,
  ].join('\n');
  const user = [
    `目标：${ctx.goal}`,
    `当前位置：${ctx.self.position}，时间：${ctx.self.timeText}`,
    '已知事实：',
    ...ctx.facts.map((f) => `- ${f.text}`),
    '近期观察：',
    ...ctx.observations.map((o) => `- [${o.ok ? '成功' : '失败'}] ${o.tool}: ${o.summary}`),
    '请给出下一步。',
  ].join('\n');
  return { system, user };
}

export class RealModelAdapter implements ModelAdapter {
  readonly simulated = false;
  private config: RealModelConfig;

  constructor(config: RealModelConfig) {
    this.config = config;
  }

  async complete(request: ModelRequest, signal: AbortSignal): Promise<ModelResponse> {
    if (!this.config.apiKey) throw new MissingKeyError();
    const { system, user } = buildPrompt(request.visibleContext);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    signal.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0,
          max_tokens: request.reservedOutputTokens,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`模型请求失败（${res.status}）：${text.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = data.choices?.[0];
      const finish = choice?.finish_reason;
      const content = choice?.message?.content ?? '';
      const truncated = finish === 'length';
      let decision: Decision = { kind: 'finish', rationale: '模型未给出可解析的工具调用。' };
      if (!truncated && content) {
        try {
          const parsed = JSON.parse(content) as Decision;
          if (parsed.kind === 'tool' && typeof (parsed as { tool?: string }).tool === 'string') {
            decision = { kind: 'tool', tool: (parsed as { tool: string }).tool, args: (parsed as { args?: Record<string, unknown> }).args ?? {}, rationale: (parsed as { rationale?: string }).rationale ?? '' };
          } else if (parsed.kind === 'finish') {
            decision = { kind: 'finish', rationale: parsed.rationale ?? '' };
          }
        } catch {
          // 解析失败：保留为诊断，不执行工具。
        }
      }
      const usage = data.usage
        ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 }
        : null;
      return {
        decision,
        inputTokens: usage?.promptTokens ?? countTokens(system + user),
        outputTokens: usage?.completionTokens ?? countTokens(content),
        truncated,
        simulated: false,
        usage,
        raw: content,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function realModelConfigFromEnv(env: NodeJS.ProcessEnv): RealModelConfig {
  return {
    baseUrl: env.MODEL_BASE_URL ?? 'https://api.deepseek.com/v1',
    model: env.MODEL_NAME ?? 'deepseek-chat',
    apiKey: env.MODEL_API_KEY ?? '',
    timeoutMs: Number(env.MODEL_REQUEST_TIMEOUT_MS ?? 60000),
  };
}
