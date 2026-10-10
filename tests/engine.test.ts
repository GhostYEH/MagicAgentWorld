import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HARNESS_CONFIG,
  RunController,
  mergeHarnessConfig,
  evaluateExpression,
  planRoute,
  validateArgs,
  type HarnessConfig,
  type RunInput,
  type TaskDefinition,
} from '@agentcraft/engine';
import { getTask } from '@agentcraft/content';

let controllerCounter = 0;

function makeController(chapterId: string, override?: Partial<HarnessConfig>): RunController {
  const task = getTask(chapterId);
  const harness = mergeHarnessConfig(mergeHarnessConfig(DEFAULT_HARNESS_CONFIG, task.defaultHarness), override);
  const input: RunInput = {
    chapterId: task.chapterId,
    taskVersion: task.taskVersion,
    mode: 'simulation',
    seed: 1,
    harnessConfig: harness,
  };
  controllerCounter += 1;
  const controller = new RunController(`test-${chapterId}-${controllerCounter}`, input, task);
  controller.initialize();
  return controller;
}

describe('分词器（实际运行）', () => {
  it('CJK 每字符 1 token，拉丁串按子词切分', async () => {
    const { countTokens, tokenize, TOKENIZER_NAME, TOKENIZER_VERSION } = await import('@agentcraft/engine');
    expect(countTokens('报到')).toBe(2);
    expect(countTokens('abcde')).toBe(2); // 4 + 1
    const tokens = tokenize('报到 09:50');
    expect(tokens.some((t) => t.kind === 'cjk')).toBe(true);
    expect(TOKENIZER_NAME).toBe('AgentCraft-LiteTokenizer');
    expect(TOKENIZER_VERSION).toBe('1.0.0');
  });
});

describe('受限表达式与路线规划', () => {
  it('计算器只接受受限数值表达式', () => {
    expect(evaluateExpression('10+15+20+5*3')).toEqual({ ok: true, value: 60 });
    expect(evaluateExpression('1/0').ok).toBe(false);
    expect(evaluateExpression('alert(1)').ok).toBe(false);
  });

  it('路线规划给出三段 10/15/20 分钟', () => {
    const task = getTask('C3');
    const route = planRoute(task.initialWorld, 'east_gate', 'card_center');
    expect(route?.totalMinutes).toBe(45);
    expect(route?.legs.map((l) => l.minutes)).toEqual([10, 15, 20]);
  });
});

describe('参数校验', () => {
  it('缺少必填参数被拒绝', () => {
    const errors = validateArgs(
      { type: 'object', properties: { keyword: { type: 'string', description: '' } }, required: ['keyword'] },
      {},
    );
    expect(errors).toHaveLength(1);
  });
});

describe('C3 自主循环（有效任务）', () => {
  it('连续执行后三项核验通过，并发放徽章', async () => {
    const controller = makeController('C3');
    await controller.start();
    expect(controller.currentState).toBe('completed');
    const v = controller.finalVerification;
    expect(v.passed).toBe(true);
    expect(v.checks.every((c) => c.passed)).toBe(true);
    const badge = controller.recorder.list().find((e) => e.type === 'badge');
    expect(badge).toBeTruthy();
  });

  it('报到时序：完成时间约 09:50，路线三段 10/15/20', async () => {
    const controller = makeController('C3');
    await controller.start();
    // 08:50 出发 + 10 + 5 + 15 + 5 + 20 + 5 = 09:50
    expect(controller.world.time).toBe(9 * 60 + 50);
  });
});

describe('权限与硬规则', () => {
  it('权限 deny 时提交被拒绝', async () => {
    const controller = makeController('C3', { permissions: { 'enrollment.submit': 'deny' } });
    await controller.start();
    expect(controller.finalVerification.passed).toBe(false);
    const denied = controller.recorder
      .list()
      .find((e) => e.type === 'tool.result' && (e.payload as { errorCode?: string }).errorCode === 'PERMISSION_DENIED');
    expect(denied).toBeTruthy();
  });

  it('硬规则：非法报到事项始终被拒绝', async () => {
    const controller = makeController('C3');
    const record = await controller.manualInvoke('enrollment.submit', { item: 'evil' });
    expect(record.ok).toBe(false);
    expect(record.result.error?.code).toBe('HARD_RULE');
  });
});

describe('步数与请求预算', () => {
  it('步数不足时任务失败并记录预算耗尽', async () => {
    const controller = makeController('C3', { maxSteps: 2 });
    await controller.start();
    expect(controller.finalVerification.passed).toBe(false);
    const err = controller.recorder.list().find((e) => e.type === 'error');
    expect(err).toBeTruthy();
  });

  it('模型请求预算耗尽时终止', async () => {
    const controller = makeController('C3', { maxModelRequests: 2, maxSteps: 20 });
    await controller.start();
    const err = controller.recorder
      .list()
      .find((e) => e.type === 'error' && (e.payload as { code?: string }).code === 'REQUEST_BUDGET_EXHAUSTED');
    expect(err).toBeTruthy();
  });
});

describe('有限重试', () => {
  it('暂时故障在重试预算内恢复并成功', async () => {
    const controller = makeController('C6', {
      faults: { transientToolFailures: { 'library.lookup': 1 } },
      retry: { maxAttempts: 3 },
    });
    await controller.start();
    expect(controller.finalVerification.passed).toBe(true);
    const retried = controller.recorder
      .list()
      .find((e) => e.type === 'tool.result' && (e.payload as { attempts?: number }).attempts! > 1);
    expect(retried).toBeTruthy();
  });

  it('重试预算用尽后仍失败', async () => {
    const controller = makeController('C6', {
      faults: { transientToolFailures: { 'library.lookup': 3 } },
      retry: { maxAttempts: 1 },
    });
    await controller.start();
    expect(controller.finalVerification.passed).toBe(false);
  });
});

describe('截断输出不执行工具', () => {
  it('截断响应被记录且不触发工具', async () => {
    const task = getTask('C6');
    const harness = mergeHarnessConfig(DEFAULT_HARNESS_CONFIG, task.defaultHarness);
    const controller = new RunController(
      'truncated',
      { chapterId: 'C6', taskVersion: task.taskVersion, mode: 'simulation', seed: 1, harnessConfig: harness },
      task,
      {
        modelFactory: () => ({
          simulated: true,
          async complete() {
            return {
              decision: { kind: 'tool', tool: 'library.lookup', args: { topic: '人工智能', year: 2024 }, rationale: '' },
              inputTokens: 1,
              outputTokens: 1,
              truncated: true,
              simulated: true,
              usage: null,
              raw: '',
            };
          },
        }),
      },
    );
    controller.initialize();
    await controller.start();
    const truncated = controller.recorder
      .list()
      .find((e) => e.type === 'error' && (e.payload as { code?: string }).code === 'TRUNCATED_RESPONSE');
    expect(truncated).toBeTruthy();
    const toolCall = controller.recorder.list().find((e) => e.type === 'tool.call');
    expect(toolCall).toBeUndefined();
  });
});

describe('写入幂等', () => {
  it('重复提交同一事项不会重复写入', async () => {
    const controller = makeController('C3');
    const first = await controller.manualInvoke('enrollment.submit', { item: 'identity' });
    expect(first.ok).toBe(true);
    const before = controller.world.time;
    const second = await controller.manualInvoke('enrollment.submit', { item: 'identity' });
    expect(second.ok).toBe(true);
    expect(second.result.value?.idempotent).toBe(true);
    expect(controller.world.time).toBe(before); // 幂等路径不再消耗处理时间
  });
});

describe('未知写入结果核验', () => {
  it('RecoveryPolicy 未知结果时先核验世界状态', async () => {
    const { RecoveryPolicy } = await import('@agentcraft/engine');
    const policy = new RecoveryPolicy();
    const decision = policy.decide(
      { ok: false, observation: 'x', error: { code: 'NETWORK', message: 'x' }, commitState: 'unknown' },
      true,
    );
    expect(decision.action).toBe('verify');
    const task = getTask('C3');
    expect(policy.verifyCommit(task.initialWorld, 'dorm')).toBe('not_committed');
  });
});

describe('取消（提交前后）', () => {
  it('取消后停止后续行动', async () => {
    const controller = makeController('C3');
    controller.cancel('test');
    await controller.step();
    expect(controller.currentState).toBe('cancelled');
    const toolCalls = controller.recorder.list().filter((e) => e.type === 'tool.call');
    expect(toolCalls).toHaveLength(0);
  });

  it('已提交状态在取消后保留', async () => {
    const controller = makeController('C3');
    await controller.manualInvoke('enrollment.submit', { item: 'identity' });
    expect(controller.world.records.identity!.status).not.toBe('pending');
    controller.cancel('after-commit');
    expect(controller.world.records.identity!.status).not.toBe('pending');
  });
});

describe('旧运行隔离', () => {
  it('两个运行的事件序号与 runId 独立', async () => {
    const a = makeController('C3');
    const b = makeController('C3');
    await a.step();
    expect(a.recorder.list()[0]!.runId).not.toBe(b.recorder.list()[0]!.runId);
    expect(b.recorder.list().every((e) => e.runId === b.runId)).toBe(true);
  });
});

describe('上下文遗漏与事实恢复（C5）', () => {
  it('故障运行：凭据被移出，宿舍提交失败', async () => {
    const controller = makeController('C5');
    await controller.start();
    const visible = controller.visibleContext!;
    expect(visible.omitted.some((o) => o.includes('身份核验凭据'))).toBe(true);
    expect(controller.finalVerification.passed).toBe(false);
  });

  it('修复运行：恢复事实后任务通过', async () => {
    const controller = makeController('C5', { autoRecover: true, faults: {}, maxSteps: 16 });
    await controller.start();
    expect(controller.finalVerification.passed).toBe(true);
  });
});

describe('独立评分', () => {
  it('核验器独立于模型声明（模型 finish 但世界未满足则不过关）', async () => {
    const task: TaskDefinition = getTask('C3');
    const controller = new RunController(
      'liar',
      {
        chapterId: 'C3',
        taskVersion: task.taskVersion,
        mode: 'simulation',
        seed: 1,
        harnessConfig: mergeHarnessConfig(DEFAULT_HARNESS_CONFIG, task.defaultHarness),
      },
      task,
      {
        modelFactory: () => ({
          simulated: true,
          async complete() {
            return {
              decision: { kind: 'finish', rationale: '我宣布任务完成！' },
              inputTokens: 1,
              outputTokens: 1,
              truncated: false,
              simulated: true,
              usage: null,
              raw: '',
            };
          },
        }),
      },
    );
    controller.initialize();
    await controller.start();
    expect(controller.finalVerification.passed).toBe(false);
    const badge = controller.recorder.list().find((e) => e.type === 'badge');
    expect(badge).toBeUndefined();
  });
});

describe('模拟复现', () => {
  it('相同条件两次运行结果一致', async () => {
    const a = makeController('C3');
    const b = makeController('C3');
    await a.start();
    await b.start();
    expect(a.finalVerification.passed).toBe(b.finalVerification.passed);
    expect(a.world.time).toBe(b.world.time);
    expect(a.recorder.list().length).toBe(b.recorder.list().length);
  });
});
