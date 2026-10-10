/**
 * 实际分词器：AgentCraft-LiteTokenizer v1.0.0
 *
 * 说明（合规与诚实标注）：
 * - 这是一个**本地确定性近似分词器**，不是任何供应商的官方分词器。
 *   界面必须标注分词器名称/版本，并说明其为本地近似实现。
 * - 规则：CJK 字符按 1 字符 = 1 token；拉丁字母/数字串按 ≤4 字符切分为近似子词；
 *   标点各占 1 token；空白合并但不单独计 token。
 * - 该实现完全可复现，用于教学对比“字数 vs Token”。
 */

export const TOKENIZER_NAME = 'AgentCraft-LiteTokenizer';
export const TOKENIZER_VERSION = '1.0.0';

export interface Token {
  text: string;
  start: number;
  end: number;
  /** 'cjk' | 'latin' | 'digit' | 'punct' | 'other' */
  kind: string;
}

const CJK_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;
const LATIN_RE = /[A-Za-z]/;
const DIGIT_RE = /[0-9]/;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (CJK_RE.test(ch)) {
      tokens.push({ text: ch, start: i, end: i + 1, kind: 'cjk' });
      i += 1;
      continue;
    }
    if (LATIN_RE.test(ch) || DIGIT_RE.test(ch)) {
      const start = i;
      while (i < text.length && (LATIN_RE.test(text[i]!) || DIGIT_RE.test(text[i]!))) {
        i += 1;
      }
      const word = text.slice(start, i);
      const kind = LATIN_RE.test(word[0]!) ? 'latin' : 'digit';
      // 近似子词切分：每 4 字符一个 token（短词 1 token）。
      for (let j = 0; j < word.length; j += 4) {
        tokens.push({ text: word.slice(j, j + 4), start: start + j, end: start + Math.min(j + 4, word.length), kind });
      }
      continue;
    }
    tokens.push({ text: ch, start: i, end: i + 1, kind: 'punct' });
    i += 1;
  }
  return tokens;
}

export function countTokens(text: string): number {
  return tokenize(text).length;
}

export function tokenSummary(text: string): {
  chars: number;
  tokens: number;
  tokenizer: string;
  version: string;
  breakdown: Record<string, number>;
} {
  const tokens = tokenize(text);
  const breakdown: Record<string, number> = {};
  for (const t of tokens) {
    breakdown[t.kind] = (breakdown[t.kind] ?? 0) + 1;
  }
  return {
    chars: text.length,
    tokens: tokens.length,
    tokenizer: TOKENIZER_NAME,
    version: TOKENIZER_VERSION,
    breakdown,
  };
}
