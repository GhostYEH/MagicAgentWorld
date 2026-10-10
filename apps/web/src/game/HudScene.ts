import Phaser from 'phaser';
import { getTask } from '@agentcraft/content';
import { FRAGMENTS, type GameState, type DESTINATIONS } from './GameState';
import { button, label, panel, COLOR } from './widgets';
import type { WorldSnapshot } from './WorldScene';
import { DEPARTMENTS } from './WorldMap';
import { TOOL_LESSON } from '@agentcraft/content';
import { drawToolLab, type ToolLabUi } from './ToolLabView';
import { chapterAccess, currentChapter, unlockRequirement, type ChapterId } from './ChapterAccess';
import {learningWorld} from './HomeLearning';
import {LearningHud} from './LearningHud';
import {AgentFlowPreview} from './AgentFlowPreview';

type Modal = 'guide' | 'inventory' | 'pause' | 'robot' | 'experiment' | 'tools' | 'preview' | 'department' | 'locked' | null;

export class HudScene extends Phaser.Scene {
  private surface!:LearningHud;
  private flow!:AgentFlowPreview;
  private modalRoot: Phaser.GameObjects.Container | null = null;
  private snapshot: WorldSnapshot | null = null;
  private modal: Modal = null;
  private toastText: Phaser.GameObjects.Text | null = null;
  private preview: typeof DESTINATIONS[number] | null = null;
  private department: typeof DEPARTMENTS[number] | null = null;
  private locked: {chapter:ChapterId;location:string} | null = null;
  private prompt = '你是谁？请介绍自己。';
  private toolUi: ToolLabUi = { active: 0, inputs: TOOL_LESSON.map(t => t.initial), feedback: '' };
  private context = new Set<string>();
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private pendingOnline:{id:string;name:string;capability:string}[]=[];

  constructor(private readonly state: GameState) { super('Hud'); }

  create(): void {
    this.context = new Set(FRAGMENTS.filter((f) => this.state.progress.collected.includes(f.id)).map((f) => f.announcement));
    this.build();
    this.flow=new AgentFlowPreview(this);this.flow.auto();
    this.game.events.on('world:update', this.onWorldUpdate, this);
    this.game.events.on('fragment:collected', this.onCollect, this);
    this.game.events.on('robot:interact', this.onRobot, this);
    this.game.events.on('destination:preview', this.onPreview, this);
    this.game.events.on('department:inspect', this.onDepartment, this);
    this.game.events.on('region:locked', this.onLocked, this);
    this.game.events.on('home:hover',this.onHover,this);
    this.game.events.on('home:hover-end',this.onHoverEnd,this);
    this.game.events.on('home:cancel-preview',this.cancelPreview,this);
    this.game.events.on('home:module-online',this.onModuleOnline,this);
    this.game.events.on('toast', this.toast, this);
    this.scale.on('resize', this.resize, this);
    this.input.keyboard!.on('keydown', this.onKey, this);
    this.events.once('shutdown', this.dispose, this);
    this.game.events.emit('world:refresh');
  }

  private keyEvent(event: KeyboardEvent): boolean {
    return event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement;
  }

  private onKey(event: KeyboardEvent): void {
    if (this.keyEvent(event)) { if (event.key === 'Escape') this.closeModal(); return; }
    if (event.repeat) return;
    if(this.flow.active&&event.key==='Escape'){this.flow.stop();return;}
    if (event.key === 'Escape') { if (this.modal) this.closeModal(); else this.openModal('pause'); }
    else if (event.key.toLowerCase() === 'm' && !this.modal) this.game.events.emit('world:atlas');
    else if (event.key.toLowerCase() === 'i') { if (this.modal === 'inventory') this.closeModal(); else this.openModal('inventory'); }
    else if (event.key.toLowerCase() === 'h') this.openModal('guide');
  }

  private build(): void {
    this.surface?.destroy();
    this.surface=new LearningHud(this,{
      locate:()=>{if(this.modal)return;this.flow.stop();this.game.events.emit('world:locate',learningWorld(this.state.save.progress).target.id);},
      go:()=>{if(this.modal)return;this.flow.stop();this.game.events.emit('world:module-navigate',learningWorld(this.state.save.progress).target.id);},
      preview:()=>{if(!this.modal)this.flow.start();},
      interact:()=>this.game.events.emit('world:interact'),inventory:()=>this.openModal('inventory'),guide:()=>this.openModal('guide'),
      atlas:()=>{if(this.modal)return;this.flow.stop();this.game.events.emit('world:atlas');},pause:()=>this.openModal('pause'),
      simulation:()=>this.toast(learningWorld(this.state.save.progress).allCompleted?'完整运行入口已就绪，运行演示将在后续开放。':'完成六章核心学习后，完整运行入口才会解锁。'),
    });
  }
  private onWorldUpdate(snapshot:WorldSnapshot):void {
    this.snapshot=snapshot;
    this.surface.update(snapshot,learningWorld(this.state.save.progress),this.state.toolLesson.installed.size);
    if(snapshot.paused)this.surface.hideTooltip(true);
  }
  private onHover(data:{id:string;x:number;y:number}):void {
    if(this.modal||this.flow?.active)return;
    const module=learningWorld(this.state.save.progress).modules.find(m=>m.id===data.id);
    if(module)this.surface.showTooltip(module,data.x,data.y);
  }
  private onHoverEnd():void {this.surface.hideTooltip();}
  private cancelPreview():void {this.flow?.stop();this.surface.hideTooltip(true);}
  private onModuleOnline(module:{id:string;name:string;capability:string}):void {
    if(this.modal||this.flow.active){this.pendingOnline.push(module);return;}
    this.toast(`MODULE ONLINE · ${module.name}已启动\nAC–01 获得：${module.capability}`);
    this.game.events.emit('world:feedback-pulse',module.id);
  }

  private onCollect(fragment: typeof FRAGMENTS[number]): void {
    this.context.add(fragment.announcement);
    this.toast(`已装入「${fragment.title}」 · ${fragment.detail}`);
    document.getElementById('game-live-status')!.textContent = `已获得${fragment.title}`;
  }
  private onRobot(): void { this.openModal('robot'); }
  private onLocked(region:{chapter:ChapterId;location:string}):void {
    this.locked=region;this.openModal('locked');
  }
  private onDepartment(department: typeof DEPARTMENTS[number]): void {
    if(!this.state.isChapterUnlocked(department.chapter)){this.onLocked({chapter:department.chapter,location:department.name});return;}
    this.department = department; this.openModal('department');
  }
  private onPreview(destination: typeof DESTINATIONS[number]): void {
    if(!this.state.isChapterUnlocked(destination.id)){this.onLocked({chapter:destination.id,location:destination.location});return;}
    this.preview = destination;
    this.openModal(destination.id === 'C2' ? 'tools' : 'preview');
  }

  private openModal(type: Modal): void { this.flow?.stop();this.surface.hideTooltip(true); this.closeModal(false); this.modal = type; this.game.events.emit('world:pause', true); this.drawModal(); }

  private drawModal(): void {
    const width = this.scale.width, height = this.scale.height, mobile = width < 700;
    const modalW = Math.min(this.modal === 'tools' ? 930 : this.modal === 'experiment' ? 790 : 610, width - 32);
    const modalH = Math.min(this.modal === 'tools' ? 620 : this.modal === 'experiment' ? 603 : this.modal === 'inventory' ? 455 : 377, height - 32);
    const x = (width - modalW) / 2, y = (height - modalH) / 2;
    this.modalRoot?.destroy(true);
    document.getElementById('game-input-layer')!.replaceChildren();
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x253f66, .62).setInteractive();
    shade.on('pointerdown', (_pointer: unknown, _x: unknown, _y: unknown, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    this.modalRoot = this.add.container(0, 0, [shade, panel(this, x, y, modalW, modalH, .98)]).setDepth(100);
    const add = (...objects: Phaser.GameObjects.GameObject[]) => this.modalRoot!.add(objects);
    add(button(this, x + modalW - 28, y + 26, 30, '×', () => this.closeModal()));
    const text = (px: number, py: number, value: string, size = 14, color = COLOR.text) => {
      const result = label(this, x + px, y + py, value, size, color).setWordWrapWidth(modalW - px - 28, true); add(result); return result;
    };

    if (this.modal === 'guide') {
      text(28, 27, '探索者手册', 22); text(28, 65, '在游戏场景中移动、收集与交互。', 12, COLOR.muted);
      text(28, 106, '01  当前任务：定位查看镜头，或点前往场馆。\n02  WASD 移动、Shift 快跑；点击地面自动寻路。\n03  M 查看地图，悬停建筑可查看职责与开放条件。\n04  装入记忆，与 AC–01 比较 Prompt 和上下文。\n05  完成上一章才开放下一章；流程预览不计入进度。', mobile ? 11 : 13);
      text(28, modalH - 81, '连续校园 · 六个探索区  ·  I 背包  ·  Esc 暂停', 10, '#6886a0');
      add(button(this, width / 2, y + modalH - 33, 155, '明白了，继续探索', () => this.closeModal(), true));
    } else if (this.modal === 'robot') {
      text(28, 27, 'AC–01', 23); text(28, 65, this.state.progress.awakened ? '机器人伙伴 · 已连接' : '机器人伙伴 · 信号丢失', 11, '#617b99');
      const ready = this.state.progress.collected.length === 3;
      text(28, 111, ready ? '你装入的记忆，就是我这次能看到的上下文。\n先问“你是谁”，再移出身份记忆。\n我还知道自己是谁吗？回答需要什么依据？' : `我目前没有足够的信息认识自己。\n请在附近三个记忆终端装入身份、边界和工具协议。\n现在已经装入 ${this.state.progress.collected.length} / 3 份。`, mobile ? 12 : 15);
      text(28, modalH - 85, ready ? '这是一段模拟实验，回答仍需要事实依据。' : '提示：按 I 查看已经收集的信息。', 11, COLOR.muted);
      add(button(this, width / 2, y + modalH - 35, 174, ready ? '连接伙伴，进入实验' : '我去寻找信息', () => {
        if (!ready) this.closeModal();
        else { this.game.events.emit('world:awaken'); this.openModal('experiment'); }
      }, true));
    } else if (this.modal === 'inventory') {
      text(28, 27, '上下文背包', 23); text(28, 64, `${this.state.progress.collected.length} / 3 份记忆 · 上下文需要显式装入`, 11, '#688a9e');
      FRAGMENTS.forEach((fragment, index) => {
        const owned = this.state.progress.collected.includes(fragment.id);
        text(28, 110 + index * 83, `${owned ? '◆' : '◇'}  ${fragment.title}${owned ? '' : ' · 尚未找到'}`, 14, owned ? '#3e7293' : '#8896a6');
        const announcement = getTask('C1').initialWorld.campus.announcements.find((a) => a.id === fragment.announcement);
        text(44, 136 + index * 83, owned ? announcement?.body ?? fragment.detail : '探索中枢庭院，寻找发光的记忆终端。', 10, COLOR.muted);
      });
      add(button(this, width / 2, y + modalH - 31, 145, '收好，继续探索', () => this.closeModal(), true));
    } else if (this.modal === 'pause') {
      text(28, 27, '探索已暂停', 23); text(28, 64, '游戏进度会自动保存到本地。', 12, COLOR.muted);
      add(button(this, width / 2, y + 121, modalW - 60, '继续探索', () => this.closeModal(), true));
      add(button(this, width / 2, y + 174, modalW - 60, '操作指南', () => this.openModal('guide')));
      add(button(this, width / 2, y + 227, modalW - 60, this.reducedMotion ? '动态效果：减少' : '动态效果：开启', () => { this.reducedMotion = !this.reducedMotion; this.game.events.emit('world:motion', this.reducedMotion); this.drawModal(); }));
      add(button(this, width / 2, y + 280, modalW - 60, '重新开始校园探索', () => { if (confirm('重新开始校园探索？已有学习徽章会保留。')) { this.closeModal(); this.game.events.emit('world:reset'); } }));
    } else if(this.modal==='locked') {
      const access=chapterAccess(this.state.save.progress,this.locked!.chapter);
      const next=chapterAccess(this.state.save.progress,currentChapter(this.state.save.progress));
      text(28,27,'区域尚未开放',23);
      text(28,67,`${this.locked!.location} · 第${access.index}章「${access.name}」`,13,'#567c97');
      text(28,117,`${unlockRequirement(access.id)}。\n当前先完成第${next.index}章「${next.name}」。\n通关后入口会自动开放，并保存学习进度。`,14,COLOR.muted);
      text(28,modalH-90,'建筑可在地图上查看，开放前无法进入庭院或教学区。',11,COLOR.muted);
      add(button(this,width/2,y+modalH-40,205,'继续当前章节',()=>{
        const id=currentChapter(this.state.save.progress);this.closeModal();this.game.events.emit('world:navigate',id);
      },true));
      document.getElementById('game')!.dataset.locked=JSON.stringify({...this.locked,blockedBy:access.blockedBy,requirement:unlockRequirement(access.id)});
    } else if (this.modal === 'department') {
      text(28,27,this.department?.name ?? '部门模型',23);
      text(28,67,`${this.department?.code} / ${this.department?.role}`,12,'#567c97');
      const descriptions:Record<string,string>={
        'model-core':'玻璃穹顶包围神经核心，输入进入中枢后产生回答或工具请求。\n中央体量代表大模型，其余设施组成周围的 Harness。',
        'loop-tower':'环形轨道代表决策、行动和观察的重复循环。\n循环需要明确的完成条件，以及暂停和停止机制。',
        'memory-archive':'打开的书页代表当前上下文，档案结构代表持久记忆。\n保存过的信息仍需重新加载，才能进入模型下一次请求。',
        'control-gate':'双塔闸门控制允许的行动；刻度和时钟表示预算与截止时间。\n工具执行前必须经过权限与资源检查。',
        'repair-lab':'回执面板展示输入、调用和结果，维修结构代表故障恢复。\n根据实际记录定位原因，再修复和重新执行。',
      };
      text(28,117,descriptions[this.department?.id ?? ''] ?? '',13,COLOR.muted);
      text(28,modalH-90,this.department?.chapter==='C1'?'第一章已开放 · 在中枢庭院完成输入与上下文实验。':'本章区域已开放；完整教学运行联动仍在建设中。',11,COLOR.muted);
      add(button(this,width/2,y+modalH-40,164,'继续查看架构城',()=>this.closeModal(),true));
    } else if (this.modal === 'preview') {
      text(28, 27, this.preview?.name ?? '探索目的地', 23); text(28, 67, this.preview?.location ?? '', 13, '#567c97');
      const lessons: Record<string, string> = {
        C2: '工具能让模型读取状态、精确计算和检索证据。\n先回大模型中枢完成输入与上下文实验，\n获得「模型观察者」后，这里的工坊就会开放。',
        C3: '下一步：给 Agent 一个目标，让它选择工具，\n执行行动、观察结果，再决定下一步。\n这一章的自主执行玩法正在建设中。',
        C4: 'Harness 管理循环、权限、预算和记忆。\n你将通过配置限制，控制 Agent 的运行过程。\n这一章的运行控制玩法正在建设中。',
        C5: '工具误用、重复执行和记忆丢失都能让 Agent 失败。\n你将检查回执与运行记录，定位并修复原因。\n这一章的诊断玩法正在建设中。',
        C6: '组装模型、工具和运行控制，完成多阶段目标。\n比较完成情况、调用成本和可靠性。\n这一章的挑战玩法正在建设中。',
      };
      text(28, 117, lessons[this.preview?.id ?? ''] ?? '', 13, COLOR.muted);
      add(button(this, width / 2, y + modalH - 40, 174, '返回当前区域', () => this.closeModal(), true));
    } else if (this.modal === 'experiment') this.drawExperiment(x, y, modalW, modalH, add, text);
    else if (this.modal === 'tools') drawToolLab(this, this.modalRoot, this.state, this.toolUi, x, y, modalW, modalH, () => { if (this.modal === 'tools') this.drawModal(); }, () => this.game.events.emit('world:refresh'));

    document.getElementById('game')!.dataset.modal = this.modal ?? '';
  }

  private drawExperiment(x: number, y: number, width: number, height: number, add: (...objects: Phaser.GameObjects.GameObject[]) => void, text: (px: number, py: number, value: string, size?: number, color?: string) => Phaser.GameObjects.Text): void {
    text(27, 23, 'Prompt 实验台', 22); text(27, 60, '第一章 / Prompt 是输入指令；上下文是本次可见信息 · 规则模拟', 10, '#6a8599');
    const layer = document.getElementById('game-input-layer')!;
    layer.replaceChildren();
    const input = document.createElement('textarea');
    input.id = 'game-prompt'; input.setAttribute('aria-label', '给 AC–01 的 Prompt'); input.placeholder = '输入你想问伙伴的问题'; input.value = this.prompt;
    Object.assign(input.style, { left: `${x + 27}px`, top: `${y + 88}px`, width: `${width - 54}px`, height: '68px' });
    input.addEventListener('input', () => { this.prompt = input.value; });
    input.addEventListener('keydown', (event) => { event.stopPropagation(); if (event.key === 'Escape') this.closeModal(); });
    layer.append(input);
    text(27, 171, '可见上下文 · 点击记忆装入 / 移出', 11, '#74859a');
    FRAGMENTS.forEach((fragment, index) => {
      const bw = (width - 66) / 3;
      add(button(this, x + 27 + bw / 2 + index * (bw + 6), y + 213, bw, `${this.context.has(fragment.announcement) ? '✓' : '◇'} ${fragment.title}`, () => {
        if (this.context.has(fragment.announcement)) this.context.delete(fragment.announcement); else this.context.add(fragment.announcement);
        this.drawModal();
      }, this.context.has(fragment.announcement)));
    });
    add(button(this, x + width - 103, y + 263, 155, '向伙伴发送 Prompt', () => { this.state.generate(this.prompt, [...this.context]); this.drawModal(); this.game.events.emit('world:refresh'); }, true));
    text(27, 252, `已做 ${this.state.progress.trials} 次实验`, 10, COLOR.muted);
    const output = this.state.output;
    document.getElementById('game')!.dataset.experiment = JSON.stringify({ trials: this.state.progress.trials, grounded: output?.grounded ?? null, answer: output?.answer ?? '', evidence: output?.evidence ?? [], passed: Boolean(this.state.save.progress.C1?.passed) });
    text(27, 299, output ? output.grounded ? 'AC–01  /  回答有事实依据' : 'AC–01  /  当前信息不足' : 'AC–01  /  等待你的第一句 Prompt', 12, '#557e9b');
    const answer = text(27, 329, output?.answer ?? '先问“你是谁”，再移出「身份记忆」重问。最后换成“你现在能调用工具吗”，完成三组对比。', this.scale.width < 700 ? 11 : 13, '#3b5573');
    answer.setWordWrapWidth(width - 54, true);
    const tokenY = Math.min(459, height - 118);
    if (output) text(27, tokenY - 25, output.evidence.length ? `依据：${output.evidence.map((e) => e.title).join('、')}` : '承认未知是正确边界；缺少依据却编造具体事实，才是幻觉。', 10, '#62788f');
    text(27, tokenY, output ? `Prompt ${output.tokens.prompt.tokens}  ·  上下文 ${output.tokens.context.tokens}  ·  回答 ${output.tokens.answer.tokens} Token` : 'Token 会在生成后显示', 10, '#567d98');
    text(27, tokenY + 24, 'AgentCraft-LiteTokenizer：本地近似分词，非供应商计费结果。', 9, '#8995a3');
    const passed = Boolean(this.state.save.progress.C1?.passed);
    text(27, height - (this.scale.width < 700 ? 84 : 58), passed ? '✓ 第一章实验通过：已比较有依据和信息不足的情况' : '目标：比较至少三种输入 / 上下文组合，解释结果变化。', 10, passed ? '#477d92' : '#708092');
    add(button(this, x + width - 86, y + height - 29, 120, '返回校园', () => this.closeModal()));
    if (passed) add(button(this, x + width - 273, y + height - 29, 230, '获得模型观察者 · 前往工具工坊', () => { this.closeModal(); this.game.events.emit('world:navigate', 'C2'); }, true));
  }

  private closeModal(resume = true): void {
    this.modalRoot?.destroy(true); this.modalRoot = null; this.modal = null;
    document.getElementById('game-input-layer')?.replaceChildren();
    document.getElementById('game')!.dataset.modal = '';
    document.getElementById('game')!.dataset.locked = '';
    if (resume) {
      this.game.events.emit('world:pause', false);
      const module=this.pendingOnline.shift();if(module)this.onModuleOnline(module);
    }
  }

  private toast(message: string): void {
    this.toastText?.destroy();
    this.toastText = label(this, this.scale.width / 2, 110, message, this.scale.width < 700 ? 10 : 13, '#fff8e8').setOrigin(.5).setPadding(15, 11).setBackgroundColor('#627893').setDepth(150);
    const current = this.toastText;
    this.time.delayedCall(2600, () => { if (this.toastText === current) { current.destroy(); this.toastText = null; } });
  }

  private resize(): void { this.flow.stop();this.build(); if (this.snapshot) this.onWorldUpdate(this.snapshot); if (this.modal) this.drawModal(); }
  private dispose(): void {
    this.closeModal(false);this.flow.destroy();this.surface.destroy();this.pendingOnline=[];
    for (const [event, handler] of [['world:update', this.onWorldUpdate], ['fragment:collected', this.onCollect], ['robot:interact', this.onRobot], ['destination:preview', this.onPreview], ['department:inspect',this.onDepartment], ['region:locked',this.onLocked], ['home:hover',this.onHover], ['home:hover-end',this.onHoverEnd], ['home:cancel-preview',this.cancelPreview], ['home:module-online',this.onModuleOnline], ['toast', this.toast]] as const) this.game.events.off(event, handler, this);
    this.scale.off('resize', this.resize, this);
    this.input.keyboard?.off('keydown', this.onKey, this);
  }
}
