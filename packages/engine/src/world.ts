/**
 * 世界状态：校园地点、时间、报到记录、凭据、路线。
 *
 * 世界是唯一的“真实状态”，由运行引擎维护；模型只能通过装配后的可见上下文看到部分信息。
 * 世界核验器独立读取真实状态，模型声明不能代替核验。
 */

import type { LocationDef, WorldState } from './types';

export function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

export function formatTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function parseTime(text: string): number {
  const [h, m] = text.split(':').map((n) => Number.parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isOpen(loc: LocationDef | undefined, time: number): boolean {
  if (!loc || !loc.open) return true;
  return time >= loc.open[0] && time <= loc.open[1];
}

/** 基于邻接表的最短路径（Dijkstra），返回腿列表与总分钟数。 */
export function planRoute(
  world: WorldState,
  from: string,
  to: string,
): { legs: Array<{ from: string; to: string; minutes: number }>; totalMinutes: number } | null {
  if (from === to) return { legs: [], totalMinutes: 0 };
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();
  for (const id of Object.keys(world.locations)) dist[id] = Number.POSITIVE_INFINITY;
  dist[from] = 0;
  prev[from] = null;
  while (true) {
    let current: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const id of Object.keys(dist)) {
      if (!visited.has(id) && dist[id]! < best) {
        best = dist[id]!;
        current = id;
      }
    }
    if (current === null) break;
    if (current === to) break;
    visited.add(current);
    const loc = world.locations[current];
    if (!loc) continue;
    for (const [next, minutes] of Object.entries(loc.neighbors)) {
      const alt = dist[current]! + minutes;
      if (alt < (dist[next] ?? Number.POSITIVE_INFINITY)) {
        dist[next] = alt;
        prev[next] = current;
      }
    }
  }
  if (dist[to] === undefined || !Number.isFinite(dist[to])) return null;
  const path: string[] = [];
  let node: string | null = to;
  while (node) {
    path.unshift(node);
    node = prev[node] ?? null;
  }
  const legs: Array<{ from: string; to: string; minutes: number }> = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i]!;
    const b = path[i + 1]!;
    legs.push({ from: a, to: b, minutes: world.locations[a]!.neighbors[b]! });
  }
  return { legs, totalMinutes: dist[to]! };
}

/** 受限数值表达式求值器：仅支持数字、+ - * / ( ) 和空白。 */
export function evaluateExpression(expr: string): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = expr.replace(/\s+/g, '');
  if (cleaned.length === 0) return { ok: false, error: 'EMPTY_EXPRESSION' };
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) {
    return { ok: false, error: 'UNSUPPORTED_CHARACTER' };
  }
  let pos = 0;
  const peek = (): string | undefined => cleaned[pos];
  const parseNumber = (): number => {
    const start = pos;
    while (pos < cleaned.length && /[0-9.]/.test(cleaned[pos]!)) pos += 1;
    if (start === pos) throw new Error('EXPECTED_NUMBER');
    const value = Number(cleaned.slice(start, pos));
    if (!Number.isFinite(value)) throw new Error('INVALID_NUMBER');
    return value;
  };
  const parseFactor = (): number => {
    if (peek() === '(') {
      pos += 1;
      const value = parseExpr();
      if (peek() !== ')') throw new Error('EXPECTED_CLOSE_PAREN');
      pos += 1;
      return value;
    }
    if (peek() === '-') {
      pos += 1;
      return -parseFactor();
    }
    return parseNumber();
  };
  const parseTerm = (): number => {
    let value = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = peek();
      pos += 1;
      const rhs = parseFactor();
      if (op === '*') value *= rhs;
      else {
        if (rhs === 0) throw new Error('DIVISION_BY_ZERO');
        value /= rhs;
      }
    }
    return value;
  };
  const parseExpr = (): number => {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = peek();
      pos += 1;
      const rhs = parseTerm();
      if (op === '+') value += rhs;
      else value -= rhs;
    }
    return value;
  };
  try {
    const value = parseExpr();
    if (pos !== cleaned.length) return { ok: false, error: 'TRAILING_INPUT' };
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'PARSE_ERROR' };
  }
}
