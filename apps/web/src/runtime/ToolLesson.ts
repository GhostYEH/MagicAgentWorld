import { TOOL_LESSON } from '@agentcraft/content';
import type { ToolExecutionRecord } from '@agentcraft/engine';
import { SimulationSession } from './session';

export type LessonToolId = typeof TOOL_LESSON[number]['id'];
interface Call { id: LessonToolId; input: string; record: ToolExecutionRecord }
export interface ToolLessonSave { installed: LessonToolId[]; calls: { id: LessonToolId; input: string }[]; understood: boolean }

/** Installation gates execution. Completion comes from engine state plus reflection. */
export class ToolLesson {
  readonly session = new SimulationSession('C2', 'simulation', 1);
  readonly installed = new Set<LessonToolId>();
  readonly calls: Call[] = [];
  understood = false;
  busy = false;
  private disposed = false;

  install(id: LessonToolId): void {
    if (TOOL_LESSON.some(t => t.id === id)) this.installed.add(id);
  }

  async invoke(id: LessonToolId, input: string): Promise<ToolExecutionRecord | null> {
    const tool = TOOL_LESSON.find(t => t.id === id);
    if (this.disposed || this.busy || !tool || !this.installed.has(id) || this.calls.length >= 24) return null;
    this.busy = true;
    try {
      const record = await this.session.invoke(tool.tool, { [tool.parameter]: input.trim().slice(0, 160) });
      if (!this.disposed) this.calls.push({ id, input: input.trim().slice(0, 160), record });
      return this.disposed ? null : record;
    } finally { this.busy = false; }
  }

  get verification() { return this.session.snapshot().verification; }
  get passed(): boolean { return this.verification.passed && this.understood; }
  get remaining(): number { return 24 - this.calls.length; }

  save(): ToolLessonSave {
    return { installed: [...this.installed], calls: this.calls.map(({ id, input }) => ({ id, input })), understood: this.understood };
  }

  async restore(raw: unknown): Promise<void> {
    if (!raw || typeof raw !== 'object') return;
    const saved = raw as Partial<ToolLessonSave>;
    if (Array.isArray(saved.installed)) for (const id of saved.installed) this.install(id);
    if (Array.isArray(saved.calls)) for (const call of saved.calls.slice(0, 24)) {
      if (call && typeof call.input === 'string' && TOOL_LESSON.some(t => t.id === call.id)) await this.invoke(call.id, call.input);
    }
    this.understood = saved.understood === true;
  }

  dispose(): void { this.disposed = true; this.session.dispose(); }
}
