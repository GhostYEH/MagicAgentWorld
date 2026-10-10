/**
 * 存档适配：浏览器 IndexedDB。记录已过关章节与实验配置。
 * 不依赖 React，可被 store 调用；不可用时降级为内存。
 */

const DB_NAME = 'agentcraft';
const STORE_NAME = 'saves';
const KEY = 'progress.v1';

export interface ChapterProgress {
  chapterId: string;
  passed: boolean;
  badge?: string;
  evidence?: string[];
  lastRunId?: string;
  updatedAt: number;
}

export interface SaveState {
  progress: Record<string, ChapterProgress>;
  experiments: Record<string, unknown>;
  updatedAt: number;
}

export const emptySave = (): SaveState => ({ progress: {}, experiments: {}, updatedAt: 0 });

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function loadSave(): Promise<SaveState> {
  const db = await openDb();
  if (!db) return emptySave();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => resolve((req.result as SaveState) ?? emptySave());
    req.onerror = () => resolve(emptySave());
  });
}

export async function writeSave(state: SaveState): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...state, updatedAt: Date.now() }, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function clearSave(): Promise<void> {
  await writeSave(emptySave());
}
