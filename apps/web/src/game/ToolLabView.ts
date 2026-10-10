import Phaser from 'phaser';
import { TOOL_LESSON } from '@agentcraft/content';
import type { GameState } from './GameState';
import { label, panel, button, COLOR } from './widgets';

export interface ToolLabUi {
  active: number;
  inputs: string[];
  feedback: string;
}

/** A game workbench: install a capability, pass arguments, inspect the receipt. */
export function drawToolLab(scene: Phaser.Scene, root: Phaser.GameObjects.Container, state: GameState, ui: ToolLabUi, x: number, y: number, w: number, h: number, redraw: () => void, refresh: () => void): void {
  const lesson = state.toolLesson, active = TOOL_LESSON[ui.active]!;
  const add = (...objects: Phaser.GameObjects.GameObject[]) => root.add(objects);
  const text = (px: number, py: number, value: string, size = 12, color = COLOR.text, wrap = w - px - 28) => {
    const object = label(scene, x + px, y + py, value, size, color).setWordWrapWidth(wrap, true); add(object); return object;
  };
  text(28, 23, '工具工坊', 23);
  text(28, 60, '第二章 / 把回答能力连接到实际行动 · 本地模拟实验', 11, '#658199');
  add(panel(scene, x + 25, y + 92, 218, h - 152));
  text(42, 109, 'AC–01 的能力插槽', 13, '#426d88', 183);
  TOOL_LESSON.forEach((tool, i) => {
    add(button(scene, x + 134, y + 162 + i * 101, 178, `${lesson.installed.has(tool.id) ? '◆' : '◇'} ${tool.name}`, () => { ui.active = i; ui.feedback = ''; redraw(); }, ui.active === i));
    text(47, 189 + i * 101, tool.short, 10, '#718796', 176);
    text(47, 211 + i * 101, lesson.installed.has(tool.id) ? '已安装 · 可执行' : '选择后装入插槽', 9, '#718796', 176);
  });
  text(43, h - 105, `已安装 ${lesson.installed.size} / 3\n剩余调用 ${lesson.remaining} / 24`, 10, '#657f94', 176);

  text(270, 96, active.name, 17, '#436d89');
  text(270, 127, active.tool, 11, '#7d909e');
  text(270, 155, active.hint, 11, '#687f91');
  const input = document.createElement('input');
  input.id = 'game-tool-input'; input.type = 'text'; input.maxLength = 160;
  input.setAttribute('aria-label', `${active.name}参数`); input.value = ui.inputs[ui.active]!;
  Object.assign(input.style, { left: `${x + 270}px`, top: `${y + 181}px`, width: `${w - 298}px`, height: '43px' });
  input.addEventListener('input', () => { ui.inputs[ui.active] = input.value; });
  // Keep movement hotkeys from consuming typed letters or caret navigation.
  // Let Escape reach HudScene and keyup release keys held before this dialog.
  input.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
  document.getElementById('game-input-layer')!.append(input);

  const installed = lesson.installed.has(active.id), exhausted = lesson.remaining === 0;
  add(button(scene, x + 351, y + 248, 162, installed ? '能力已安装' : '装入能力插槽', () => {
    if (lesson.busy) return;
    state.installTool(active.id); ui.feedback = `${active.name}已安装，试着执行一次调用。`; refresh(); redraw();
  }, !installed));
  const run = button(scene, x + w - 117, y + 248, 178, lesson.busy ? '正在执行…' : exhausted ? '预算耗尽 · 请重置' : '执行工具调用', () => {
    if (lesson.busy) return;
    if (!installed) { ui.feedback = '先安装工具，模型才拥有这项能力。'; redraw(); return; }
    if (exhausted) return;
    const pending = state.invokeTool(active.id, ui.inputs[ui.active]!);
    redraw();
    void pending.then(record => {
      ui.feedback = record ? record.ok ? '已收到工具回执，查看结果与来源。' : '调用失败，检查参数后再试；错误也会留下回执。' : '本次调用未执行。';
      refresh(); redraw();
    }).catch(() => { ui.feedback = '调用未完成，请重试或重置本次实验。'; redraw(); });
  }, true);
  if (!installed || exhausted) run.setAlpha(.58);
  add(run);
  text(270, 280, active.why, 11, '#698397');

  add(panel(scene, x + 264, y + 329, w - 289, 136));
  const last = [...lesson.calls].reverse().find(call => call.id === active.id);
  text(281, 345, last ? last.record.ok ? '✓ 执行回执 / 成功' : '◇ 执行回执 / 错误' : '执行回执 / 等待调用', 12, '#4f7b95');
  const summary = last?.record.result.value?.items as {summary?: string}[] | undefined;
  const body = last ? last.record.result.observation + (summary?.[0]?.summary ? `\n${summary[0].summary}` : '') : '只装入工具还不会产生结果。执行后，在这里检查实际返回的信息。';
  text(281, 374, body, 11, '#3c5872', w - 319);
  text(281, 443, last?.record.result.sources?.length ? `来源：${last.record.result.sources.map(s => s.title).join('、')}` : last?.record.ok ? '结果来自本地计算工具的实际执行。' : '没有成功回执，不能声称任务已经完成。', 9, '#7e919e');

  const checks = lesson.verification.checks;
  checks.forEach((check, i) => text(270 + i * (w - 298) / 3, 481, `${check.passed ? '✓' : '◇'} ${['运行配置', '预算 5120', '规约来源'][i]}`, 11, check.passed ? '#477f83' : '#8193a0', (w - 298) / 3 - 8));
  if (lesson.verification.passed) {
    text(270, 512, '工具执行后，Agent 应该依据什么继续？', 12, '#446d86');
    const bw = (w - 314) / 2;
    add(button(scene, x + 270 + bw / 2, y + 556, bw, '相信模型说“完成了”', () => {
      state.reflectTools(false); ui.feedback = '模型的说法不能证明执行成功，要检查工具返回的结果与错误。'; refresh(); redraw();
    }));
    add(button(scene, x + 282 + bw * 1.5, y + 556, bw, '检查回执，把结果带回上下文', () => {
      state.reflectTools(true); ui.feedback = '✓ 第二章完成 · 获得「工具工程师」徽章'; refresh(); redraw();
    }, lesson.passed));
  } else {
    text(270, 514, '完成三个核验目标后，回答最后一个问题。\n接下来，Agent 才能尝试自主选择工具并观察结果。', 12, '#71899a');
  }
  const status = text(270, h - 24, ui.feedback || '先安装状态查询，读取配置，再尝试计算与检索。', 10, '#5f7e92');
  status.setWordWrapWidth(w - 300, true);
  add(button(scene, x + 134, y + h - 28, 177, '重置本次工具实验', () => {
    if (lesson.busy) return;
    state.resetToolLesson(); ui.feedback = '本次实验已重置，已获得的学习徽章保留。'; refresh(); redraw();
  }));
  document.getElementById('game')!.dataset.tools = JSON.stringify({ active: active.id, installed: [...lesson.installed], busy: lesson.busy, calls: lesson.calls, checks, reflected: lesson.understood, passed: Boolean(state.save.progress.C2?.passed) });
}
