import { describe, expect, it } from 'vitest';
import { getTask } from '@agentcraft/content';
import { generate } from '@agentcraft/engine';
import { ToolLesson } from '../apps/web/src/runtime/ToolLesson';
import { GameState } from '../apps/web/src/game/GameState';

describe('Agent 教学事实与工具执行', () => {
  it('移出身份记忆后承认未知，未知问题不编造预算', () => {
    const world = getTask('C1').initialWorld;
    const visible = world.campus.announcements.map(a => a.id);
    const first = generate({ prompt: '你是谁？', visibleAnnouncementIds: visible, world, mode: 'simulation' });
    expect(first.grounded).toBe(true);
    expect(first.evidence[0]!.title).toBe('身份记忆');
    const second = generate({ prompt: '你是谁？', visibleAnnouncementIds: visible.filter(id => id !== 'memory.identity'), world, mode: 'simulation' });
    expect(second.grounded).toBe(false);
    expect(second.acknowledgesUnknown).toBe(true);
    expect(second.tokens.context.tokens).toBeLessThan(first.tokens.context.tokens);
    const unknown = generate({ prompt: '今天温度是多少？', visibleAnnouncementIds: visible, world, mode: 'simulation' });
    expect(unknown.evidence).toEqual([]);
    expect(unknown.acknowledgesUnknown).toBe(true);
  });

  it('第一章必须有三个不同组合及有依据/未知两种结果', () => {
    const game = new GameState();
    const ids = getTask('C1').initialWorld.campus.announcements.map(a => a.id);
    game.generate('你是谁？', ids);
    game.generate('你是谁？', ids.filter(id => id !== 'memory.identity'));
    expect(game.save.progress.C1?.passed).not.toBe(true);
    const restored = [...ids.filter(id => id !== 'memory.identity'), 'memory.identity'];
    game.generate('你是谁？', restored);
    expect(game.save.progress.C1?.passed).not.toBe(true);
    game.generate('你现在能调用工具吗？', ids);
    expect(game.save.progress.C1?.passed).toBe(true);
  });

  it('安装与第一章完成门控，不能仅点击按钮获得徽章', async () => {
    const game = new GameState();
    game.installTool('inspect');
    expect(game.toolLesson.installed.size).toBe(0);
    expect(await game.invokeTool('inspect', 'tokenBudget')).toBeNull();
    expect(game.reflectTools(true)).toBe(false);
    const lesson = new ToolLesson();
    expect(await lesson.invoke('inspect', 'tokenBudget')).toBeNull();
    expect(lesson.calls).toHaveLength(0);
    expect(lesson.passed).toBe(false);
    lesson.dispose();
  });

  it('错误参数、错误预算和空检索不能满足独立核验', async () => {
    const lesson = new ToolLesson();
    for (const id of ['inspect', 'calculate', 'retrieve'] as const) lesson.install(id);
    expect((await lesson.invoke('inspect', 'missing'))?.ok).toBe(false);
    expect((await lesson.invoke('calculate', '8192-2048'))?.result.value?.value).toBe(6144);
    expect((await lesson.invoke('retrieve', '不存在的资料'))?.result.value?.count).toBe(0);
    expect(lesson.verification.checks.every(check => !check.passed)).toBe(true);
    expect(lesson.passed).toBe(false);
    lesson.dispose();
  });

  it('核验真实工具结果后还要正确理解回执，才能获得第二章徽章', async () => {
    const game = new GameState();
    game.save.progress.C1 = { chapterId: 'C1', passed: true, updatedAt: 1 };
    for (const id of ['inspect', 'calculate', 'retrieve'] as const) game.installTool(id);
    await game.invokeTool('inspect', 'tokenBudget');
    await game.invokeTool('calculate', '8192-2048-1024');
    await game.invokeTool('retrieve', '工具调用');
    expect(game.toolLesson.verification.passed).toBe(true);
    expect(game.save.progress.C2?.passed).not.toBe(true);
    expect(game.reflectTools(false)).toBe(false);
    expect(game.reflectTools(true)).toBe(true);
    expect(game.save.progress.C2!.evidence).toContain('算出剩余预算 5120 Token');
    game.toolLesson.dispose();
  });

  it('刷新按调用日志重新执行，忽略伪造的保存结果', async () => {
    const lesson = new ToolLesson();
    await lesson.restore({ installed: ['inspect', 'calculate', 'retrieve'], calls: [
      { id: 'inspect', input: 'tokenBudget' }, { id: 'calculate', input: '8192-2048-1024' }, { id: 'retrieve', input: '工具调用' },
    ], understood: true, passed: true });
    expect(lesson.passed).toBe(true);
    expect(lesson.calls[1]!.record.result.value?.value).toBe(5120);
    const forged = new ToolLesson();
    await forged.restore({ installed: ['calculate'], calls: [{ id: 'calculate', input: '2+2', record: { ok: true, result: { value: 5120 } } }], understood: true, passed: true });
    expect(forged.passed).toBe(false);
    expect(forged.calls[0]!.record.result.value?.value).toBe(4);
    lesson.dispose(); forged.dispose();
  });
});
