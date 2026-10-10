/**
 * 实验运行：以指定配置在模拟模式下跑完一章，返回可对比的指标。
 * 两套配置使用相同任务版本、seed 与故障条件，报告分母为实际测试数。
 */

import type { ChapterId, HarnessConfig } from '@agentcraft/engine';
import { SimulationSession } from './session';
import { getTask } from '@agentcraft/content';

export interface ExperimentResult {
  configName: string;
  condition: string;
  passed: number;
  total: number;
  steps: number;
  energy: number;
  status: string;
  runId: string;
}

const CONDITIONS: Record<string, Partial<HarnessConfig>> = {
  normal: {},
  'transient-failure': { faults: { transientToolFailures: { 'enrollment.submit': 1 } }, retry: { maxAttempts: 3 } },
  'limited-context': { faults: { contextObservationLimit: 0 }, context: { includeFacts: true, includeObservations: 0, enableRetrieval: false } },
};

export async function runExperiment(
  chapterId: ChapterId,
  configName: string,
  condition: keyof typeof CONDITIONS | string,
  harnessOverride: Partial<HarnessConfig> = {},
): Promise<ExperimentResult> {
  const task = getTask(chapterId);
  const conditionPatch = CONDITIONS[condition] ?? {};
  const merged: Partial<HarnessConfig> = {
    ...harnessOverride,
    ...conditionPatch,
    faults: { ...(harnessOverride.faults ?? {}), ...(conditionPatch.faults ?? {}) },
    context: { ...(harnessOverride.context ?? {}), ...(conditionPatch.context ?? {}) } as HarnessConfig['context'],
    retry: { ...(harnessOverride.retry ?? {}), ...(conditionPatch.retry ?? {}) } as HarnessConfig['retry'],
  };
  const session = new SimulationSession(chapterId, 'simulation', 1, merged);
  try {
    await session.start();
    const snap = session.snapshot();
    const checks = snap.verification.checks;
    return {
      configName,
      condition,
      passed: checks.filter((c) => c.passed).length,
      total: checks.length,
      steps: snap.budget.steps,
      energy: snap.budget.gameEnergy,
      status: snap.status,
      runId: snap.runId,
    };
  } finally {
    session.dispose();
  }
  void task;
}
