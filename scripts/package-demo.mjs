/**
 * 组装本地离线演示包到 demo/ 目录。
 *
 * 步骤：
 *  1. 构建 Web 与服务端产物；
 *  2. 复制服务端产物到 demo/server、网页产物到 demo/web；
 *  3. 复制演示包运行所需依赖（fastify 及其依赖树）到 demo/node_modules。
 *
 * 运行：node scripts/package-demo.mjs
 */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const demo = join(root, 'demo');

function run(cmd) {
  console.log('> ' + cmd);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

console.log('1/4 构建产物…');
run('npm run build');

console.log('2/4 准备 demo 目录…');
// Clear only this generated frontend output so retired UI bundles cannot remain.
const webOutput = resolve(demo, 'web');
if (dirname(webOutput) !== demo || dirname(demo) !== root) throw new Error('Invalid generated demo output');
rmSync(webOutput, { recursive: true, force: true });
mkdirSync(join(demo, 'server'), { recursive: true });
mkdirSync(join(demo, 'web'), { recursive: true });

cpSync(join(root, 'apps/server/dist'), join(demo, 'server'), { recursive: true });
cpSync(join(root, 'apps/web/dist'), join(demo, 'web'), { recursive: true });

console.log('3/4 复制离线运行依赖…');
const require = createRequire(import.meta.url);
const nodeModulesSrc = join(root, 'node_modules');
const nodeModulesDst = join(demo, 'node_modules');

// 解析 fastify / @fastify/static 依赖树并复制。
const visited = new Set();
function copyPackage(name) {
  if (visited.has(name)) return;
  visited.add(name);
  let pkgDir;
  try {
    pkgDir = dirname(require.resolve(join(name, 'package.json')));
  } catch {
    return;
  }
  const rel = pkgDir.slice(nodeModulesSrc.length + 1);
  const dst = join(nodeModulesDst, rel);
  mkdirSync(dirname(dst), { recursive: true });
  if (!existsSync(dst)) cpSync(pkgDir, dst, { recursive: true, dereference: true });
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    for (const dep of Object.keys(pkg.dependencies ?? {})) copyPackage(dep);
  } catch {
    // 忽略
  }
}

for (const dep of ['fastify', '@fastify/static']) copyPackage(dep);

console.log('4/4 写入说明与版本…');
writeFileSync(
  join(demo, 'VERSION.txt'),
  `AgentCraft 大模型与 Harness 架构城演示包\n构建时间：${new Date().toISOString()}\n对应规划：v2.1（2026-10-10）\n首页：任务定位与导航、四态区域、六阶段启动进度、约9秒可跳过流程示意\nC1/C2可玩，六章按前置通关开放；完整运行仅入口占位，后续教学待开发；仅电脑端\n`,
);

console.log('\n完成。演示包位于：' + demo);
console.log('运行：cd demo && node server/index.js  （或双击 start.cmd）');
