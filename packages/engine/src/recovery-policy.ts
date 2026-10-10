/**
 * RecoveryPolicy：暂时故障有限重试、写入结果未知时的处理、取消后的清理。
 *
 * - 暂时故障有限重试（由 ToolRegistry 在预算内执行）。
 * - 写入结果分已提交/未提交/未知；未知时暂停并先核验状态，不盲目重放写入。
 * - 取消传递 AbortSignal，阻止后续行动与未提交写入；已提交事务保留。
 */

import type { CommitState, ToolResult, WorldState } from './types';

export interface RecoveryDecision {
  action: 'retry' | 'verify' | 'stop' | 'continue';
  reason: string;
}

export class RecoveryPolicy {
  /** 判定一次工具结果后应采取的恢复动作。 */
  decide(result: ToolResult, isWrite: boolean): RecoveryDecision {
    if (result.ok) return { action: 'continue', reason: '调用成功' };
    const code = result.error?.code;
    if (code === 'TRANSIENT_FAILURE' || code === 'TIMEOUT') {
      return { action: 'retry', reason: '暂时故障，可在有限预算内重试' };
    }
    if (code === 'ABORTED' || code === 'ABORTED_BEFORE_DISPATCH') {
      return { action: 'stop', reason: '已取消，停止后续行动' };
    }
    if (isWrite && result.commitState === 'unknown') {
      return { action: 'verify', reason: '写入结果未知，先核验世界状态再决定' };
    }
    return { action: 'continue', reason: `不可重试错误：${code ?? 'UNKNOWN'}` };
  }

  /** 独立核验世界是否已提交某写操作（用于未知结果）。 */
  verifyCommit(world: WorldState, item: string): CommitState {
    const rec = world.records[item];
    if (!rec) return 'unknown';
    return rec.status !== 'pending' ? 'committed' : 'not_committed';
  }
}
