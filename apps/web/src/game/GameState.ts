import { getTask } from '@agentcraft/content';
import type { GenerationOutput } from '@agentcraft/engine';
import { emptySave, loadSave, writeSave, type SaveState } from '../persistence/indexeddb';
import { SimulationSession } from '../runtime/session';
import { ToolLesson, type LessonToolId } from '../runtime/ToolLesson';
import { WORLD, SPAWN, FRAGMENTS, DEPARTMENTS, OBSTACLES } from './WorldMap';
import { WorldNavigation } from './WorldNavigation';
import { chapterAccess, lockedObstacles, lockedRegionAt, type ChapterId } from './ChapterAccess';

export { FRAGMENTS, DESTINATIONS } from './WorldMap';
export const navigation = new WorldNavigation(WORLD.width, WORLD.height, OBSTACLES);

export interface ExplorationProgress {
  collected: string[];
  awakened: boolean;
  x: number;
  y: number;
  trials: number;
  visited: string[];
}

function initialProgress(): ExplorationProgress {
  return { collected: [], awakened: false, ...SPAWN, trials: 0, visited: ['model-core'] };
}

export class GameState {
  save: SaveState = emptySave();
  progress = initialProgress();
  output: GenerationOutput | null = null;
  session = new SimulationSession('C1', 'simulation', 1);
  toolLesson = new ToolLesson();
  private persistence = Promise.resolve();
  private navigationKey = '';
  private activeNavigation = navigation;

  isChapterUnlocked(id: ChapterId): boolean { return chapterAccess(this.save.progress,id).unlocked; }

  get navigation(): WorldNavigation {
    const key=DEPARTMENTS.map(d=>Number(this.isChapterUnlocked(d.chapter))).join('')+Number(this.isChapterUnlocked('C6'));
    if(key!==this.navigationKey){
      this.navigationKey=key;
      this.activeNavigation=new WorldNavigation(WORLD.width,WORLD.height,[...OBSTACLES,...lockedObstacles(this.save.progress)]);
    }
    return this.activeNavigation;
  }

  async load(): Promise<void> {
    this.save = await loadSave();
    await this.toolLesson.restore(this.save.experiments['toolLesson.v1']);
    const current = this.save.experiments['exploration.v3'];
    const raw = current ?? this.save.experiments['exploration.v2'] ?? this.save.experiments['exploration.v1'];
    if (raw && typeof raw === 'object') {
      const p = raw as Partial<ExplorationProgress>;
      const collected = Array.isArray(p.collected) ? FRAGMENTS.filter((f) => p.collected!.includes(f.id)).map((f) => f.id) : [];
      const savedPosition={ x: p.x ?? SPAWN.x, y: p.y ?? SPAWN.y };
      const position = current && !lockedRegionAt(this.save.progress,savedPosition) ? this.navigation.nearest(savedPosition) : SPAWN;
      this.progress = {
        collected,
        awakened: p.awakened === true && collected.length === FRAGMENTS.length,
        ...position,
        trials: 0,
        visited: current && Array.isArray(p.visited) ? DEPARTMENTS.filter(d => this.isChapterUnlocked(d.chapter)&&p.visited!.includes(d.id)).map(d => d.id) : ['model-core'],
      };
      if (!current) { this.persist(); await this.flush(); }
    }
  }

  persist(): void {
    const snapshot = structuredClone({ ...this.save, experiments: { ...this.save.experiments, 'exploration.v3': this.progress, 'toolLesson.v1': this.toolLesson.save() } });
    this.persistence = this.persistence.then(() => writeSave(snapshot));
  }

  visit(id: string): boolean {
    if (!DEPARTMENTS.some(d => d.id === id&&this.isChapterUnlocked(d.chapter)) || this.progress.visited.includes(id)) return false;
    this.progress.visited.push(id); this.persist(); return true;
  }

  collect(id: string): void {
    if (!FRAGMENTS.some((fragment) => fragment.id === id) || this.progress.collected.includes(id)) return;
    this.progress.collected.push(id);
    this.persist();
  }

  generate(prompt: string, contextIds: string[]): GenerationOutput {
    const available = getTask('C1').initialWorld.campus.announcements.map((a) => a.id);
    const output = this.session.generate(prompt, contextIds.filter((id) => available.includes(id)));
    this.progress.trials += 1;
    this.output = output;
    const snapshot = this.session.snapshot();
    if (snapshot.verification.passed) {
      this.save.progress.C1 = { chapterId: 'C1', passed: true, badge: '模型观察者', lastRunId: snapshot.runId, evidence: snapshot.verification.checks.filter((c) => c.passed).map((c) => c.label), updatedAt: Date.now() };
    }
    this.persist();
    return output;
  }

  async reset(): Promise<void> {
    this.session.dispose();
    this.session = new SimulationSession('C1', 'simulation', 1);
    this.progress = initialProgress();
    this.output = null;
    delete this.save.experiments['exploration.v1'];
    delete this.save.experiments['exploration.v2'];
    delete this.save.experiments['exploration.v3'];
    this.persist();
    await this.persistence;
  }

  installTool(id: LessonToolId): void {
    if (!this.isChapterUnlocked('C2')) return;
    this.toolLesson.install(id); this.persist();
  }

  async invokeTool(id: LessonToolId, input: string) {
    if (!this.isChapterUnlocked('C2')) return null;
    const lesson = this.toolLesson;
    const record = await lesson.invoke(id, input);
    if (lesson === this.toolLesson) this.persist();
    return record;
  }

  reflectTools(correct: boolean): boolean {
    if (!this.isChapterUnlocked('C2') || !this.toolLesson.verification.passed) return false;
    this.toolLesson.understood = correct;
    if (this.toolLesson.passed) {
      this.save.progress.C2 = { chapterId: 'C2', passed: true, badge: '工具工程师', lastRunId: this.toolLesson.session.runId, evidence: [...this.toolLesson.verification.checks.filter(c => c.passed).map(c => c.label), '理解工具回执要作为事实依据'], updatedAt: Date.now() };
    }
    this.persist(); return this.toolLesson.passed;
  }

  resetToolLesson(): void {
    this.toolLesson.dispose(); this.toolLesson = new ToolLesson(); this.persist();
  }

  async flush(): Promise<void> { await this.persistence; }
}
