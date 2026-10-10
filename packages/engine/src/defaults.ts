/**
 * 默认 Harness 配置与合并工具。
 */

import type { HarnessConfig } from './types';

export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  maxSteps: 16,
  maxModelRequests: 16,
  reservedOutputTokens: 1024,
  requestTimeoutMs: 60_000,
  toolTimeoutMs: 2_000,
  deadlineMs: 300_000,
  permissions: {},
  context: {
    includeFacts: true,
    includeObservations: 8,
    enableRetrieval: true,
  },
  retry: {
    maxAttempts: 3,
  },
  autoRecover: true,
};

export function mergeHarnessConfig(base: HarnessConfig, override?: Partial<HarnessConfig>): HarnessConfig {
  if (!override) return { ...base, context: { ...base.context }, retry: { ...base.retry }, permissions: { ...base.permissions } };
  return {
    ...base,
    ...override,
    context: { ...base.context, ...(override.context ?? {}) },
    retry: { ...base.retry, ...(override.retry ?? {}) },
    permissions: { ...base.permissions, ...(override.permissions ?? {}) },
    faults: override.faults ?? base.faults,
  };
}
