# AgentCraft

面向 AI 初学者的日系动漫学园探索游戏，采用 **2.5D 等距视角**。地面、道路和建筑使用同一投影，人物与树木保持竖直，按前后位置遮挡；遮住人物的建筑和树冠会淡化。玩家在连续校园中收集信息，再逐章解锁工具、Agent、Harness 与修复能力。

当前前端为 **Phaser + TypeScript + Vite**，只适配电脑浏览器。已删除 React、React DOM、Zustand、React Vite 插件及旧页面源码。地图、角色、任务、背包、对话和实验台均由 Phaser 场景绘制；中文 Prompt 使用原生 textarea。

世界是一张 3072×2048 的连通架构城：**大模型中枢位于中央，工具工坊、执行循环塔、上下文与记忆馆、运行控制塔、观察与修复站分布周边。** 六种独立轮廓使用统一 2:1 透视；当前目标以金色标记，已启动模块显示勾选和轻量连线，锁定建筑保留并显示锁标。悬停查看职责与前置条件，点击标牌可步行至入口。模型预览和结构说明见 `部门建模说明.md`。原有 C1/C2 可继续游玩；后四章教学与实际自主执行待开发。

首页直接进入游戏，默认镜头能同时看到六座核心建筑；滚轮放大上限按建筑完整轮廓与桌面 HUD 留白计算，定位和流程预览同样受限。左侧任务卡支持「定位目标」及实际寻路的「前往场馆」；六阶段系统进度由真实章节通关记录计算。首次约 9 秒的 Agent 流程示意可跳过、关闭自动播放，并从右上角重播；示意不改变学习进度或门禁。完整运行入口在六章完成后显示就绪，目前仍是占位。见 `首页设计说明.md`。

校园外围接入连续的针叶林、竹林、花田、水渠和湖心亭，补齐桌面镜头四周；内部草地按区域增加柔和色块。外围是景观绘制，原有可行走边界与章节入口保持不变。

## 启动

```bash
npm install
npm run dev
# http://localhost:5173

# 构建后的单服务运行
npm run build
npm run start
# http://localhost:8787
```

只开发游戏可运行 `npm run dev:web`。无需模型密钥；当前游戏明确标注模拟探索，图片和字体均本地加载。演示包：`npm run package:demo`，随后双击 `demo/start.cmd`（需 Node.js）。

## 游玩

- WASD / 方向键沿屏幕方向移动；点击地面自动寻路，Shift 快跑；鼠标滚轮调整镜头远近。
- 点击三个发光记忆终端，或靠近后按 E 装入记忆。按 I 查看上下文背包。
- 回到 AC–01，连接伙伴进入 Prompt 实验台。
- 先问“你是谁”，移出身份记忆后重问，再恢复记忆并问“你现在能调用工具吗”；比较回答、事实依据和近似 Token。
- 获得「模型观察者」后前往工具工坊，给 AC–01 安装状态查询、精确计算和知识检索。读取预算、算出剩余 5120 Token、找到工具调用规约；检查实际回执并完成理解题，获得「工具工程师」。
- M 查看世界地图，H 查看指南，Esc 暂停或关闭面板。
- 新游戏只开放第一章；通过上一章后开放下一章。锁定区域的建筑可见，庭院不可进入，点击可查看条件。第四章同时开放记忆馆和控制塔，规则见 `章节开放说明.md`。
- 在世界地图点击已开放区域会规划步行路线；建筑、树干与水池具有碰撞，移动键可取消寻路。区域发现和位置自动保存。
- 收集与通关记录自动存入 IndexedDB，刷新后恢复；暂停菜单可重新开始探索。

## 工程

| 路径 | 职责 |
| --- | --- |
| `apps/web/src/game/WorldScene.ts` | 世界、玩家移动、拾取、NPC、镜头 |
| `apps/web/src/game/HudScene.ts` | 游戏 HUD、背包、菜单、实验台 |
| `apps/web/src/game/HomeLearning.ts` | 由真实存档派生任务、四态模块与六阶段启动进度 |
| `apps/web/src/game/LearningHud.ts` | 桌面任务卡、系统进度、悬浮卡、热键与小地图 |
| `apps/web/src/game/AgentFlowPreview.ts` | 可跳过、可重播的流程示意与偏好保存 |
| `apps/web/src/game/HomeMapFrame.ts` | 总览镜头为桌面 HUD 预留空间 |
| `apps/web/src/game/ToolLabView.ts` | 游戏内工具安装、参数输入、执行回执和理解题 |
| `apps/web/src/runtime/ToolLesson.ts` | 安装门控、实际调用、独立核验与调用日志恢复 |
| `apps/web/src/game/ChapterAccess.ts` | 六章顺序、前置核验与锁定庭院边界 |
| `apps/web/src/game/RegionGate.ts` | 与碰撞一致的围栏和门禁 |
| `apps/web/src/game/GameState.ts` | 探索状态、运行接口、存档 |
| `apps/web/src/game/WorldMap.ts` | 地图尺寸、道路、区域、建筑与碰撞数据 |
| `apps/web/src/game/WorldProjection.ts` | 地面与等距视图的正逆投影、竖向高度及深度排序 |
| `apps/web/src/game/WorldTerrain.ts` | 地面、建筑、植被、路灯和小地图渲染 |
| `apps/web/src/game/CampusEnvironment.ts` | 连续外围景观、湖岸设施与分区草地；缓存绘制 |
| `apps/web/src/game/CampusArchitecture.ts` | 统一斜视投影下的各类建筑、门窗、屋顶及校园设施 |
| `apps/web/src/game/HarnessArchitecture.ts` | 大模型中枢与五个部门的独立结构、立面、穹顶、轨道和标识 |
| `apps/web/src/game/CampusLandscape.ts` | 运动场、花园、分区庭院和铺装 |
| `apps/web/src/game/CampusRoads.ts` | 统一宽度的主路/支路、固定半径转角、连续路口、人行横道与铺装 |
| `apps/web/src/game/WorldNavigation.ts` | A* 路线、建筑避让与边界检查 |
| `packages/engine` | 工具、运行循环、权限、预算、上下文、恢复、独立核验 |
| `packages/content` | 章节任务；lessons.ts 定义当前 Agent 教学记忆与规约 |
| `apps/server` | Fastify、模型适配、SQLite、事件与静态托管 |

`npm run typecheck` 检查四包；`npm test` 测引擎、章节门禁、部门布局、导航、投影、教学与首页状态；`npm run test:e2e` 实测两章教学、部门寻路、旧存档迁移、镜头、遮挡、悬浮卡与流程预览。仅电脑端。启动构建后的服务后，可用 `AGENTCRAFT_TEST_BASE_URL` 指定地址运行 `node scripts/verify-homepage.mjs`，生成七种桌面分辨率（含超宽屏）截图及边缘位置检查记录。六张透明模型和总览位于 `screenshots/部门建模/`；重导出：启动 dev:web 后运行 `node scripts/export-department-models.mjs`。

六章目标与比赛 13+2 分钟结构见四份 `项目规划/` 文档；实现范围见 `开发进度.md`、`验收记录.md` 与 `网页游戏实现说明.md`。模拟器为本地规则行为，分词器为近似实现，8192 等预算值为教学实验配置。旧 C3—C6 引擎任务仍是历史回归样例，后续须改为 Agent 预算诊断任务，再接入游戏。真实模型调用、学生试玩和教学提升尚未验收。
