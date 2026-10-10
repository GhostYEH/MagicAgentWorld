import { ACCESS_REGIONS, chapterSequence, unlockRequirement, type ChapterId, type LearningProgress } from './ChapterAccess';

export type ModuleStatus='locked'|'available'|'current'|'completed';
const CHAPTERS:Record<ChapterId,{target:string;title:string;description:string;capability:string;tag:string}>={
  C1:{target:'model-core',title:'唤醒你的第一个模型',description:'装入记忆，与 AC–01 比较输入和回答依据。',capability:'理解输入与回答边界',tag:'FIRST CONTACT'},
  C2:{target:'tool-depot',title:'让模型拥有行动能力',description:'安装工具，执行查询、计算和检索，核对回执。',capability:'连接工具与真实回执',tag:'TOOLS UNLOCKED'},
  C3:{target:'loop-tower',title:'让 AC–01 自主迈出下一步',description:'探索决策、行动与观察之间的循环。',capability:'组织自主执行循环',tag:'AGENT AWAKENING'},
  C4:{target:'memory-archive',title:'搭建可靠的运行环境',description:'连接记忆馆与控制塔，\n理解上下文和运行边界。',capability:'管理记忆、权限与预算',tag:'HARNESS WORKSHOP'},
  C5:{target:'repair-lab',title:'找到故障，让系统恢复',description:'沿运行记录定位问题，理解观察与恢复。',capability:'观察运行与恢复故障',tag:'OBSERVE & RECOVER'},
  C6:{target:'assembly',title:'组装你的完整 Agent',description:'汇合各项能力，迎接多阶段智能体挑战。',capability:'整合完整智能体能力',tag:'FINAL ASSEMBLY'},
};
const SYNOPSIS:Record<string,string>={
  'model-core':'模型读取本次上下文，生成回答或下一项行动请求。',
  'tool-depot':'用工具查询、计算、检索，获得可核对的执行结果。',
  'loop-tower':'根据观察选择下一步，让任务持续执行直到停止。',
  'memory-archive':'管理当前上下文与持久记忆，让所需信息进入请求。',
  'control-gate':'检查权限、预算与停止条件，约束 Agent 的行动。',
  'repair-lab':'查看回执与记录，定位错误并恢复执行。',
  'assembly':'把模型与 Harness 汇合成能完成任务的 Agent。',
};
export interface HomeModule {
  id:string;name:string;chapter:ChapterId;status:ModuleStatus;
  x:number;y:number;description:string;unlockCondition:string;
}
export interface HomeWorld {
  modules:HomeModule[];completed:number;allCompleted:boolean;current:ChapterId;
  target:HomeModule;mission:typeof CHAPTERS[ChapterId];
  stages:{id:ChapterId;name:string;status:ModuleStatus}[];
}
export function learningWorld(progress:LearningProgress):HomeWorld {
  const chapters=chapterSequence(progress),next=chapters.find(c=>!c.completed)??chapters[5]!;
  const mission=CHAPTERS[next.id];
  const modules=ACCESS_REGIONS.map(region=>{
    const access=chapters.find(c=>c.id===region.chapter)!;
    const status:ModuleStatus=!access.unlocked?'locked':access.completed?'completed':region.id===mission.target?'current':'available';
    return {id:region.id,name:region.name,chapter:region.chapter,status,x:region.x,y:region.y,description:SYNOPSIS[region.id]!,unlockCondition:unlockRequirement(region.chapter)};
  });
  const names=['模型','工具','循环','Harness','修复','总装'];
  return {modules,completed:chapters.filter(c=>c.completed).length,allCompleted:chapters.every(c=>c.completed),current:next.id,
    target:modules.find(m=>m.id===mission.target)!,mission,
    stages:chapters.map((c,i)=>({id:c.id,name:names[i]!,status:!c.unlocked?'locked':c.completed?'completed':c.id===next.id?'current':'available'}))};
}
export const STATUS_NAME:Record<ModuleStatus,string>={current:'当前任务',available:'可进入',completed:'已启动',locked:'未开放'};
export function missionFor(id:ChapterId):typeof CHAPTERS[ChapterId] {return CHAPTERS[id];}
export const FLOW_PREVIEW=[
  {region:'model-core',title:'收到一个任务',detail:'AC–01 接到一个需要完成的目标。'},
  {region:'memory-archive',title:'准备上下文',detail:'把任务与所需资料交给模型。'},
  {region:'model-core',title:'模型决定下一步',detail:'生成回答，或提出工具请求。'},
  {region:'control-gate',title:'检查运行边界',detail:'检查权限与预算，决定行动是否允许。'},
  {region:'tool-depot',title:'工具执行，返回回执',detail:'从环境获得可以核对的结果。'},
  {region:'loop-tower',title:'观察结果，继续或停止',detail:'把回执带回上下文，再决定下一步。'},
  {region:'repair-lab',title:'留下记录，处理故障',detail:'观察运行过程，在需要时恢复执行。'},
  {region:'model-core',title:'返回最终响应',detail:'这就是一个 Agent 完成任务时发生的事情。'},
  {region:'model-core',title:'任务 01 · 前往大模型中枢',detail:'接下来，你将逐步理解并启动它。'},
] as const;
