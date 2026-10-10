/**
 * C1 单轮生成：输入实验台。
 *
 * 修改 Prompt / 可见公告后，比较回答、实际分词与事实依据。
 * - 分词器实际运行（tokenizer.ts），标注名称与版本。
 * - 模拟输出与真实输出分别标注；事实不足时说明未知（不编造）。
 */

import type { WorldState } from './types';
import { tokenSummary, TOKENIZER_NAME, TOKENIZER_VERSION } from './tokenizer';

export interface GenerationInput {
  prompt: string;
  visibleAnnouncementIds: string[];
  world: WorldState;
  mode: 'simulation' | 'real';
}

export interface GenerationOutput {
  answer: string;
  /** 回答中引用的事实依据；无依据时为空。 */
  evidence: Array<{ title: string; version: string }>;
  grounded: boolean;
  /** 是否声明了未知（事实不足时的正确行为）。 */
  acknowledgesUnknown: boolean;
  simulated: boolean;
  tokens: {
    prompt: ReturnType<typeof tokenSummary>;
    answer: ReturnType<typeof tokenSummary>;
    context: ReturnType<typeof tokenSummary>;
  };
  tokenizer: { name: string; version: string };
}

/** 关键词意图识别（模拟语义）。 */
function detectIntent(prompt: string): 'identity' | 'boundary' | 'tools' | 'unknown' {
  if (/你是谁|身份|名字|介绍自己/.test(prompt)) return 'identity';
  if (/幻觉|编造|未知|回答边界|信息不足/.test(prompt)) return 'boundary';
  if (/工具|计算|检索|查询/.test(prompt)) return 'tools';
  return 'unknown';
}

export function generate(input: GenerationInput): GenerationOutput {
  const { prompt, visibleAnnouncementIds, world, mode } = input;
  const intent = detectIntent(prompt);
  const visible = world.campus.announcements.filter((a) => visibleAnnouncementIds.includes(a.id));

  const evidence: Array<{ title: string; version: string }> = [];
  let answer = '';
  let acknowledgesUnknown = false;

  const ids = { identity: 'memory.identity', boundary: 'memory.boundary', tools: 'memory.tools' };
  const ann = intent === 'unknown' ? undefined : visible.find(a => a.id === ids[intent]);
  if (ann) {
    answer = `依据《${ann.title}》：${ann.body}`;
    evidence.push({ title: ann.title, version: `记忆-${ann.id}` });
  } else {
    answer = intent === 'unknown'
      ? '当前上下文没有这项事实，我无法确认。请提供相关信息，或在工具工坊通过实际查询获得结果。'
      : `当前上下文缺少${intent === 'identity' ? '身份记忆' : intent === 'tools' ? '工具协议' : '回答边界'}，我无法确认这项事实。请装入相关记忆后再问。`;
    acknowledgesUnknown = true;
  }

  const contextText = visible.map((a) => `${a.title}\n${a.body}`).join('\n');
  return {
    answer,
    evidence,
    grounded: evidence.length > 0,
    acknowledgesUnknown,
    simulated: mode === 'simulation',
    tokens: {
      prompt: tokenSummary(prompt),
      answer: tokenSummary(answer),
      context: tokenSummary(contextText),
    },
    tokenizer: { name: TOKENIZER_NAME, version: TOKENIZER_VERSION },
  };
}
