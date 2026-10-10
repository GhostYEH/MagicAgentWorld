/**
 * 世界核验器：独立读取真实世界状态判定任务是否通过。
 * 模型声明完成不足以通过；核验结果用于发放徽章。
 */

import type { TaskDefinition, WorldState } from './types';

export interface CheckResult {
  id: string;
  label: string;
  passed: boolean;
}

export interface VerificationResult {
  passed: boolean;
  checks: CheckResult[];
}

export function verifyTask(task: TaskDefinition, world: WorldState): VerificationResult {
  const checks = task.requiredOutcomes.map((o) => ({
    id: o.id,
    label: o.label,
    passed: o.check(world),
  }));
  return { passed: checks.every((c) => c.passed), checks };
}
