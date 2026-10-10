/**
 * 事件模型：每次运行的事件都带 runId / seq / step / type / payload，
 * 世界变更与事件原子提交，界面按 seq 去重。
 */

import type { BudgetSnapshot, CommitState, Mode, ChapterId } from './types';

export type RunEventType =
  | 'run.start'
  | 'run.end'
  | 'step.start'
  | 'step.end'
  | 'context.snapshot'
  | 'model.request'
  | 'model.response'
  | 'tool.call'
  | 'tool.result'
  | 'tool.error'
  | 'guard.reminder'
  | 'budget.update'
  | 'world.change'
  | 'verification'
  | 'badge'
  | 'error';

export interface RunEvent<T = Record<string, unknown>> {
  runId: string;
  seq: number;
  step: number;
  type: RunEventType;
  at: number;
  payload: T;
}

export interface RunStartPayload {
  chapterId: ChapterId;
  taskVersion: string;
  mode: Mode;
  seed: number;
  harnessConfig: unknown;
}

export interface RunEndPayload {
  reason: 'completed' | 'cancelled' | 'budget' | 'deadline' | 'error' | 'paused';
  message?: string;
}

export interface ToolResultPayload {
  tool: string;
  ok: boolean;
  observation: string;
  commitState?: CommitState;
  errorCode?: string;
  attempts: number;
  durationMs: number;
}

export interface VerificationPayload {
  passed: boolean;
  checks: Array<{ id: string; label: string; passed: boolean }>;
}

export interface BadgePayload {
  id: string;
  label: string;
  evidence: string[];
}

export interface ModelRequestPayload {
  step: number;
  visibleContext: unknown;
  reservedOutputTokens: number;
}

export interface ModelResponsePayload {
  step: number;
  decision: unknown;
  truncated: boolean;
  simulated: boolean;
}

export interface BudgetUpdatePayload extends BudgetSnapshot {}

export interface WorldChangePayload {
  path: string;
  before: unknown;
  after: unknown;
}

export function makeEvent<T>(
  runId: string,
  seq: number,
  step: number,
  type: RunEventType,
  payload: T,
  at: number,
): RunEvent<T> {
  return { runId, seq, step, type, payload, at };
}
