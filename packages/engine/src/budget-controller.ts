/**
 * BudgetController：步数、模型请求次数、预留输出预算、超时与截止时间。
 *
 * - 失败和重试计入对应预算。
 * - 预留预算、游戏能量、实验 Token 与实际 API usage 分开显示。
 * - 硬步数与截止时间不可关闭。
 */

import type { BudgetSnapshot } from './types';

export interface BudgetInit {
  maxSteps: number;
  maxModelRequests: number;
  reservedOutputTokens: number;
  deadlineMs: number;
}

export class BudgetController {
  readonly maxSteps: number;
  readonly maxModelRequests: number;
  readonly maxReservedOutputTokens: number;
  readonly deadlineMs: number;
  steps = 0;
  modelRequests = 0;
  reservedOutputTokens = 0;
  toolRetries = 0;
  actualUsageTokens: number | null = null;
  gameEnergy = 100;
  startedAt: number;

  constructor(init: BudgetInit, now: () => number = () => Date.now()) {
    this.maxSteps = init.maxSteps;
    this.maxModelRequests = init.maxModelRequests;
    this.maxReservedOutputTokens = init.reservedOutputTokens;
    this.deadlineMs = init.deadlineMs;
    this.startedAt = now();
  }

  canStartStep(): boolean {
    return this.steps < this.maxSteps;
  }

  canRequestModel(): boolean {
    return this.modelRequests < this.maxModelRequests;
  }

  consumeStep(): void {
    this.steps += 1;
    this.gameEnergy = Math.max(0, this.gameEnergy - 5);
  }

  consumeModelRequest(reserved: number): void {
    this.modelRequests += 1;
    this.reservedOutputTokens += reserved;
  }

  consumeRetry(): void {
    this.toolRetries += 1;
    this.gameEnergy = Math.max(0, this.gameEnergy - 2);
  }

  isDeadlineExceeded(now: number): boolean {
    return now - this.startedAt >= this.deadlineMs;
  }

  snapshot(now: number, actualUsageTokens: number | null): BudgetSnapshot {
    return {
      steps: this.steps,
      maxSteps: this.maxSteps,
      modelRequests: this.modelRequests,
      maxModelRequests: this.maxModelRequests,
      reservedOutputTokens: this.reservedOutputTokens,
      maxReservedOutputTokens: this.maxReservedOutputTokens,
      toolRetries: this.toolRetries,
      elapsedMs: now - this.startedAt,
      deadlineMs: this.deadlineMs,
      gameEnergy: this.gameEnergy,
      experimentalTokens: this.reservedOutputTokens,
      actualUsageTokens,
    };
  }
}
