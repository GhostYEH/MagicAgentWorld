/**
 * AgentCraft 服务端（Node.js + Fastify）。
 *
 * 提供：真实模型运行（密钥仅在服务端）、运行控制、SSE 事件、状态/报告读取、
 * 以及构建后网页的静态托管。模拟模式在浏览器执行；服务端复用同一套规则与事件语义。
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { RunController, DEFAULT_HARNESS_CONFIG, mergeHarnessConfig, SimulationModelAdapter, type RunEvent } from '@agentcraft/engine';
import { getTask } from '@agentcraft/content';
import { createStore, type Store } from './storage.js';
import { RealModelAdapter, realModelConfigFromEnv, MissingKeyError } from './model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = resolve(__dirname, '..', process.env.AGENTCRAFT_DATA_DIR ?? './data');

interface LiveRun {
  controller: RunController;
  events: RunEvent[];
  subscribers: Set<(event: RunEvent) => void>;
  realMode: boolean;
}

const runs = new Map<string, LiveRun>();
let store: Store;

function persistEvent(runId: string, event: RunEvent, chapterId: string): void {
  // 事件先持久化再推送。
  store.appendEvent({
    runId,
    seq: event.seq,
    step: event.step,
    type: event.type,
    at: event.at,
    payload: JSON.stringify(event.payload),
  });
  if (event.type === 'run.end') {
    const live = runs.get(runId);
    const status = live?.controller.currentState ?? 'unknown';
    store.updateRun(runId, { status, report: JSON.stringify(live?.controller.finalVerification ?? {}) });
  }
  void chapterId;
}

const app = Fastify({ logger: { level: 'info' } });

app.addHook('onRequest', async (req, reply) => {
  reply.header('access-control-allow-origin', '*');
  reply.header('access-control-allow-headers', 'content-type');
  reply.header('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') reply.code(204).send();
});

app.get('/api/health', async () => ({
  ok: true,
  service: 'agentcraft-server',
  store: store.backend,
  realModeAvailable: Boolean(process.env.MODEL_API_KEY),
  runs: runs.size,
}));

app.post('/api/runs', async (req, reply) => {
  const body = (req.body ?? {}) as { chapterId?: string; mode?: string; harnessConfig?: Record<string, unknown> };
  const chapterId = body.chapterId ?? 'C1';
  const mode = body.mode ?? 'real';
  let task;
  try {
    task = getTask(chapterId);
  } catch {
    reply.code(400);
    return { error: 'UNKNOWN_CHAPTER', message: `未知章节：${chapterId}` };
  }

  const config = realModelConfigFromEnv(process.env);
  const realMode = mode === 'real';
  if (realMode && !config.apiKey) {
    reply.code(409);
    return {
      error: 'NEEDS_KEY',
      message: '缺少 MODEL_API_KEY：真实调用列为待验收；请使用模拟模式或配置密钥。',
    };
  }

  const harness = mergeHarnessConfig(
    mergeHarnessConfig(DEFAULT_HARNESS_CONFIG, task.defaultHarness),
    (body.harnessConfig ?? {}) as never,
  );
  const runId = `${realMode ? 'real' : 'sim'}-${chapterId}-${Date.now()}`;
  const controller = new RunController(
    runId,
    {
      chapterId: task.chapterId,
      taskVersion: task.taskVersion,
      mode: realMode ? 'real' : 'simulation',
      seed: 1,
      harnessConfig: harness,
    },
    task,
    // 真实模式在服务端调用模型（密钥仅在服务端）；模拟模式在服务端复用同一规则引擎。
    realMode ? { modelFactory: () => new RealModelAdapter(config) } : { modelFactory: () => new SimulationModelAdapter() },
  );

  const live: LiveRun = { controller, events: [], subscribers: new Set(), realMode };
  controller.recorder.subscribe((event) => {
    live.events.push(event);
    persistEvent(runId, event, chapterId);
    for (const send of live.subscribers) {
      try {
        send(event);
      } catch {
        // 忽略推送失败
      }
    }
  });
  controller.initialize();
  runs.set(runId, live);

  store.createRun({
    runId,
    chapterId,
    mode,
    status: 'idle',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    harnessConfig: JSON.stringify(harness),
    report: '',
  });

  return { runId, chapterId, taskVersion: task.taskVersion };
});

app.post('/api/runs/:id/control', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { action } = (req.body ?? {}) as { action?: string };
  const live = runs.get(id);
  if (!live) {
    reply.code(404);
    return { error: 'RUN_NOT_FOUND' };
  }
  try {
    switch (action) {
      case 'start':
        await live.controller.start();
        break;
      case 'step':
        await live.controller.step();
        break;
      case 'pause':
        live.controller.pause();
        break;
      case 'resume':
        await live.controller.resume();
        break;
      case 'cancel':
        live.controller.cancel();
        break;
      default:
        reply.code(400);
        return { error: 'UNKNOWN_ACTION' };
    }
  } catch (error) {
    if (error instanceof MissingKeyError) {
      reply.code(409);
      return { error: 'NEEDS_KEY', message: error.message };
    }
    reply.code(500);
    return { error: 'RUN_ERROR', message: error instanceof Error ? error.message : String(error) };
  }
  return { status: live.controller.currentState };
});

app.post('/api/runs/:id/invoke', async (req, reply) => {
  const { id } = req.params as { id: string };
  const { tool, args } = (req.body ?? {}) as { tool?: string; args?: Record<string, unknown> };
  const live = runs.get(id);
  if (!live) {
    reply.code(404);
    return { error: 'RUN_NOT_FOUND' };
  }
  if (!tool) {
    reply.code(400);
    return { error: 'MISSING_TOOL' };
  }
  const record = await live.controller.manualInvoke(tool, args ?? {});
  return record;
});

app.get('/api/runs/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const live = runs.get(id);
  const stored = store.getRun(id);
  if (!live && !stored) {
    reply.code(404);
    return { error: 'RUN_NOT_FOUND' };
  }
  return {
    runId: id,
    status: live?.controller.currentState ?? stored?.status ?? 'unknown',
    budget: live?.controller.budgetSnapshot ?? null,
    verification: live?.controller.finalVerification ?? null,
    world: live?.controller.worldSummary ?? null,
    stored,
  };
});

app.get('/api/runs', async () => ({ runs: store.listRuns() }));

app.get('/api/runs/:id/events', async (req, reply) => {
  const { id } = req.params as { id: string };
  const query = req.query as { since?: string };
  const lastEventId = req.headers['last-event-id'] as string | undefined;
  const since = Number(query.since ?? lastEventId ?? 0);

  reply.raw.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'access-control-allow-origin': '*',
  });

  const send = (event: RunEvent): void => {
    reply.raw.write(`id: ${event.seq}\n`);
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // 重连按序号补取：优先使用已持久化事件。
  const persisted = store.eventsSince(id, since);
  const live = runs.get(id);
  if (persisted.length > 0) {
    for (const e of persisted) {
      reply.raw.write(`id: ${e.seq}\n`);
      reply.raw.write(`data: ${JSON.stringify({ ...e, payload: JSON.parse(e.payload) })}\n\n`);
    }
  } else if (live) {
    for (const e of live.events.filter((e) => e.seq > since)) send(e);
  }

  const subscriber = (event: RunEvent): void => send(event);
  live?.subscribers.add(subscriber);

  const keepAlive = setInterval(() => reply.raw.write(': ping\n\n'), 15000);
  req.raw.on('close', () => {
    clearInterval(keepAlive);
    live?.subscribers.delete(subscriber);
  });
  return reply;
});

async function start(): Promise<void> {
  store = await createStore(DATA_DIR);
  // 依次尝试多个候选路径，兼容 monorepo 运行与离线演示包运行。
  const webCandidates = [
    process.env.AGENTCRAFT_WEB_DIR,
    resolve(__dirname, '../../web/dist'),
    resolve(__dirname, '../web'),
    resolve(process.cwd(), 'web'),
    resolve(process.cwd(), 'apps/web/dist'),
  ].filter((p): p is string => Boolean(p));
  const webDist = webCandidates.find((p) => existsSync(p));
  if (webDist) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/' });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api')) {
        reply.code(404).send({ error: 'NOT_FOUND' });
        return;
      }
      reply.sendFile('index.html');
    });
    app.log.info(`托管网页目录：${webDist}`);
  } else {
    app.log.warn('未找到网页构建产物，先运行 npm run build:web 以托管网页。');
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`AgentCraft 服务端已启动：http://localhost:${PORT}`);
}

start().catch((error) => {
  console.error('服务端启动失败：', error);
  process.exit(1);
});

export { app, join };
