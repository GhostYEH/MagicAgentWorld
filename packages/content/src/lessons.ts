import type { CampusData } from '@agentcraft/engine';

/** The first two lessons teach the agent itself; the academy is the setting. */
export const AGENT_LESSON_DATA: CampusData = {
  announcements: [
    { id: 'memory.identity', title: '身份记忆', body: '我是 AC–01，一个用于学习 Agent 的实验助手。我只能读取本次装入上下文的信息。', at: 0, visibleByDefault: true },
    { id: 'memory.boundary', title: '回答边界', body: '信息不足时要说明未知。没有事实依据的具体结论，可能构成幻觉；流畅的回答不等于正确的回答。', at: 0, visibleByDefault: true },
    { id: 'memory.tools', title: '工具协议', body: '现在的 AC–01 只有回答能力。工具需要先安装，再传入参数执行；只有收到回执，才知道查询、计算或检索是否成功。', at: 0, visibleByDefault: true },
  ],
  documents: [
    { id: 'guide.tool-call', title: '工具调用规约', year: 2026, topics: ['工具调用', '工具'], version: 'lesson.1', summary: '先核验工具参数与权限，再执行调用；观察成功或错误回执，把有效结果加入上下文，再继续推理。模型声称完成，不等于工具真的执行成功。' },
    { id: 'guide.context', title: '上下文预算', year: 2026, topics: ['上下文', 'Token'], version: 'lesson.1', summary: '可用预算 = 上下文窗口 - 已用输入 - 预留输出。持久记忆需要显式保存和重新加载，不能把上下文当作无限记忆。' },
    { id: 'guide.loop', title: 'Agent 执行循环', year: 2026, topics: ['Agent', '观察'], version: 'lesson.1', summary: '接收目标，选择下一项行动，执行工具，观察结果，再决定继续、恢复或停止。运行控制需要步数上限、权限与错误恢复。' },
  ],
  librarySlots: [],
};

export const TOOL_LESSON = [
  { id: 'inspect', name: '状态查询', tool: 'runtime.inspect', short: '读取运行状态', parameter: 'field', initial: 'tokenBudget', hint: '查询本次实验的 Token 预算配置。', why: '模型不能凭猜测获知运行状态，查询工具负责读取事实。' },
  { id: 'calculate', name: '精确计算', tool: 'calculator.evaluate', short: '处理数值表达式', parameter: 'expression', initial: '8192-2048-1024', hint: '窗口 8192，输入 2048，预留输出 1024。计算剩余预算。', why: '把数值运算交给计算工具，检查返回值，而非相信模型心算。' },
  { id: 'retrieve', name: '知识检索', tool: 'documents.retrieve', short: '找到资料与来源', parameter: 'query', initial: '工具调用', hint: '检索工具调用规约，找到结果的来源。', why: '检索得到的是外部证据；把有效结果带回上下文，才能支持后续判断。' },
] as const;
