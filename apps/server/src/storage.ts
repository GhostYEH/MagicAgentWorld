/**
 * 服务端存储：SQLite 保存运行与事件。
 *
 * 使用 Node 内置 node:sqlite（Node ≥ 22.5，Node 24 默认可用）。
 * 若不可用，自动降级为 JSON 文件存储，保证离线演示仍可运行。
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface RunRecord {
  runId: string;
  chapterId: string;
  mode: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  harnessConfig: string;
  report: string;
}

export interface StoredEvent {
  runId: string;
  seq: number;
  step: number;
  type: string;
  at: number;
  payload: string;
}

export interface Store {
  createRun(record: RunRecord): void;
  updateRun(runId: string, patch: Partial<RunRecord>): void;
  getRun(runId: string): RunRecord | undefined;
  listRuns(): RunRecord[];
  appendEvent(event: StoredEvent): void;
  eventsSince(runId: string, seq: number): StoredEvent[];
  close(): void;
  backend: string;
}

class SqliteStore implements Store {
  backend = 'sqlite';
  private db: import('node:sqlite').DatabaseSync;

  constructor(path: string, DatabaseSync: typeof import('node:sqlite').DatabaseSync) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        runId TEXT PRIMARY KEY,
        chapterId TEXT, mode TEXT, status TEXT,
        createdAt INTEGER, updatedAt INTEGER,
        harnessConfig TEXT, report TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
        runId TEXT, seq INTEGER, step INTEGER, type TEXT, at INTEGER, payload TEXT,
        PRIMARY KEY (runId, seq)
      );
    `);
  }

  createRun(record: RunRecord): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO runs (runId,chapterId,mode,status,createdAt,updatedAt,harnessConfig,report) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(
        record.runId,
        record.chapterId,
        record.mode,
        record.status,
        record.createdAt,
        record.updatedAt,
        record.harnessConfig,
        record.report,
      );
  }

  updateRun(runId: string, patch: Partial<RunRecord>): void {
    const current = this.getRun(runId);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: Date.now() };
    this.createRun(next);
  }

  getRun(runId: string): RunRecord | undefined {
    const row = this.db.prepare('SELECT * FROM runs WHERE runId = ?').get(runId) as RunRecord | undefined;
    return row;
  }

  listRuns(): RunRecord[] {
    return this.db.prepare('SELECT * FROM runs ORDER BY createdAt DESC').all() as unknown as RunRecord[];
  }

  appendEvent(event: StoredEvent): void {
    this.db
      .prepare('INSERT OR REPLACE INTO events (runId,seq,step,type,at,payload) VALUES (?,?,?,?,?,?)')
      .run(event.runId, event.seq, event.step, event.type, event.at, event.payload);
  }

  eventsSince(runId: string, seq: number): StoredEvent[] {
    return this.db
      .prepare('SELECT * FROM events WHERE runId = ? AND seq > ? ORDER BY seq ASC')
      .all(runId, seq) as unknown as StoredEvent[];
  }

  close(): void {
    this.db.close();
  }
}

class JsonStore implements Store {
  backend = 'json';
  private file: string;
  private runs: RunRecord[] = [];
  private events: StoredEvent[] = [];

  constructor(path: string) {
    this.file = path;
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      try {
        const data = JSON.parse(readFileSync(path, 'utf8')) as { runs: RunRecord[]; events: StoredEvent[] };
        this.runs = data.runs ?? [];
        this.events = data.events ?? [];
      } catch {
        this.runs = [];
        this.events = [];
      }
    }
  }

  private flush(): void {
    writeFileSync(this.file, JSON.stringify({ runs: this.runs, events: this.events }));
  }

  createRun(record: RunRecord): void {
    this.runs = this.runs.filter((r) => r.runId !== record.runId);
    this.runs.push(record);
    this.flush();
  }

  updateRun(runId: string, patch: Partial<RunRecord>): void {
    const current = this.getRun(runId);
    if (!current) return;
    this.createRun({ ...current, ...patch, updatedAt: Date.now() });
  }

  getRun(runId: string): RunRecord | undefined {
    return this.runs.find((r) => r.runId === runId);
  }

  listRuns(): RunRecord[] {
    return [...this.runs].sort((a, b) => b.createdAt - a.createdAt);
  }

  appendEvent(event: StoredEvent): void {
    this.events.push(event);
    appendFileSync(this.file + '.events.ndjson', JSON.stringify(event) + '\n');
  }

  eventsSince(runId: string, seq: number): StoredEvent[] {
    return this.events.filter((e) => e.runId === runId && e.seq > seq).sort((a, b) => a.seq - b.seq);
  }

  close(): void {
    this.flush();
  }
}

export async function createStore(dataDir: string): Promise<Store> {
  const sqlitePath = join(dataDir, 'agentcraft.sqlite');
  try {
    // 动态拼接模块名，避免打包器改写 node: 前缀。
    const specifier = 'node:' + 'sqlite';
    const mod = (await import(/* @vite-ignore */ specifier)) as typeof import('node:sqlite');
    return new SqliteStore(sqlitePath, mod.DatabaseSync);
  } catch {
    return new JsonStore(join(dataDir, 'agentcraft.json'));
  }
}
