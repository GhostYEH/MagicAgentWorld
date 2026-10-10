/**
 * EventRecorder：append-only 事件记录。
 *
 * 事件带 runId / seq / step / type / payload；世界变更与事件原子提交。
 * 界面按 seq 去重；切换运行后忽略旧运行事件。
 */

import type { RunEvent, RunEventType } from './events';
import { makeEvent } from './events';

export type EventSink = (event: RunEvent) => void;

export class EventRecorder {
  readonly runId: string;
  private seq = 0;
  private step = 0;
  private events: RunEvent[] = [];
  private sinks: EventSink[] = [];
  private now: () => number;
  /** 已提交的世界快照序列，用于“世界变更与事件原子提交”。 */
  private worldSnapshots: Array<{ seq: number; world: unknown }> = [];

  constructor(runId: string, now: () => number = () => Date.now()) {
    this.runId = runId;
    this.now = now;
  }

  subscribe(sink: EventSink): () => void {
    this.sinks.push(sink);
    return () => {
      this.sinks = this.sinks.filter((s) => s !== sink);
    };
  }

  setStep(step: number): void {
    this.step = step;
  }

  get currentStep(): number {
    return this.step;
  }

  get lastSeq(): number {
    return this.seq;
  }

  list(): RunEvent[] {
    return [...this.events];
  }

  /** 记录事件；可选附带世界快照，实现“原子提交”。 */
  record<T>(type: RunEventType, payload: T, worldSnapshot?: unknown): RunEvent<T> {
    this.seq += 1;
    const event = makeEvent(this.runId, this.seq, this.step, type, payload, this.now());
    this.events.push(event as RunEvent);
    if (worldSnapshot !== undefined) {
      this.worldSnapshots.push({ seq: this.seq, world: worldSnapshot });
    }
    for (const sink of this.sinks) {
      try {
        sink(event as RunEvent);
      } catch {
        // 监听器异常不影响运行。
      }
    }
    return event;
  }

  /** 按 seq 补取（重连场景）。 */
  eventsSince(seq: number): RunEvent[] {
    return this.events.filter((e) => e.seq > seq);
  }

  worldAt(seq: number): unknown | undefined {
    let result: unknown;
    for (const snap of this.worldSnapshots) {
      if (snap.seq <= seq) result = snap.world;
    }
    return result;
  }
}
