/**
 * 测试执行器 — 调用 agent-service SSE 接口 + 收集事件
 *
 * 终端只打印关键链路信息：Spawn、核心工具调用、错误、耗时
 * 不打印 AI 回复全文、辅助工具细节、tool_result 内容
 */
import type { TestCase, TimedEvent, AgentStreamEvent, BasicConfig } from './types.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** agent-service 地址 */
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000';

/** 从 .env 文件读取 cookie（运行时加载一次） */
let _cachedCookie: string | null = null;
function getCookie(): string {
  if (_cachedCookie !== null) return _cachedCookie;
  // 优先用环境变量
  if (process.env.SKYWALKER_COOKIE) {
    _cachedCookie = process.env.SKYWALKER_COOKIE;
    return _cachedCookie;
  }
  // 回退读 .env 文件
  const envPath = join(import.meta.dirname, '..', '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    const match = content.match(/^SKYWALKER_COOKIE\s*=\s*(.+)$/m);
    if (match && match[1].trim()) {
      _cachedCookie = match[1].trim();
      return _cachedCookie;
    }
  }
  _cachedCookie = '';
  return '';
}

/** 检测 basic_config 返回的"等待用户输入"标记（注意：实际标记后带零宽空格 ​） */
const PENDING_INPUT_MARKER = '__SKYWALKER_PENDING_USER_INPUT__';

/** 检测 orchestrator 要求粘贴 cookie 的关键词（Pradox 认证失败时的兜底） */
const COOKIE_PROMPT_PATTERNS = [
  /粘贴.*[Cc]ookie/i,
  /X-BFF-Cookie/i,
  /Pradox.*未认证/,
  /登录态.*重试/,
  /刷新.*登录/,
];

/** 检测 design-agent / 其他 agent 的 ask_user_question（非 basic_config 的等待输入） */
const NON_BASIC_CONFIG_QUESTION_PATTERNS = [
  /MCP 工具/,
  /gpt_image_2_draw/,
  /image_transfer/,
  /image_extend/,
  /缺少.*工具/,
  /是否已配置/,
  /参考图.*URL/,
  /设计方案/,
];

/** 单次执行结果 */
export interface RunResult {
  events: TimedEvent[];
  timedOut: boolean;
  error: string | null;
  /** 首次 tool_call 的时间戳（用于计算思考耗时） */
  firstToolCallTs: number | null;
  /** done 事件的时间戳 */
  doneTs: number | null;
  /** generate_page tool_result 的时间戳（提前终止时用于算执行耗时） */
  pageGenResultTs: number | null;
  /** 各阶段耗时明细 */
  stages: StageTiming[];
  /** 会话 ID（供修复测试续接同一会话） */
  sessionId: string;
  /** 多轮对话消息历史 */
  messages: Array<{ role: string; content: string }>;
}

/** 单阶段耗时记录 */
export interface StageTiming {
  /** 阶段名 */
  name: string;
  /** 开始时间戳 */
  startTs: number;
  /** 结束时间戳 */
  endTs: number;
}

/** 单轮对话收集结果 */
interface RoundResult {
  events: TimedEvent[];
  /** basic_config 等待用户输入 */
  needsUserInput: boolean;
  /** design-agent 或其他非 basic_config 的 ask_user_question（需要跳过） */
  needsNonBasicConfigInput: boolean;
  /** orchestrator 要求用户粘贴 cookie（Pradox 认证失败） */
  needsCookieInput: boolean;
  /** orchestrator 的最终回复文本 */
  orchestratorResponse: string | null;
}

/**
 * 向 agent-service 发送单轮消息并收集 SSE 事件流
 * @param earlyStopOnPageGen 页面生成类用例：当 new_generate_page 返回 tool_result 后提前终止
 */
async function sendAndCollect(
  sessionId: string,
  messages: Array<{ role: string; content: string }>,
  codeRoot: string,
  controller: AbortController,
  earlyStopOnPageGen: boolean = false,
  /** 阶段计时收集器（外部传入，跨轮共享） */
  stages?: StageTiming[],
  /** 上一个事件时间戳（外部传入，跨轮共享），用于计算步骤耗时 */
  lastEventTsRef?: { value: number },
): Promise<RoundResult> {
  const roundEvents: TimedEvent[] = [];
  let needsUserInput = false;
  let needsNonBasicConfigInput = false;
  let needsCookieInput = false;
  let orchestratorResponse: string | null = null;
  let pageGenDone = false; // 页面生成完成标记（用于提前终止）

  // pending tool_call 队列：key = agent:tool_name, value = timestamp[]
  // 用于计算工具实际执行耗时（call → result）
  const pendingCalls = new Map<string, number[]>();
  // spawn call 队列：key = agent:tool_name, value = agent_id[]（按 FIFO 配对 result）
  const pendingSpawnAgentIds = new Map<string, string[]>();
  // Spawn call 的 agent_id → timestamp
  const pendingSpawns = new Map<string, number>();
  // 当前并行 spawn 的 agent_id 集合（用于判断是否处于并行模式）
  let parallelSpawnAgents: string[] = [];
  // Spawn 期间累计各类型耗时（用于 spawn 完成时打印分解）
  const spawnTimeBreakdown = new Map<string, { think: number; output: number; tool: number; other: number }>();

  // === 并行分叉显示 ===
  // 并行 spawn 期间，每个 agent 的事件缓存到各自的 buffer，spawn 全部完成后按分支打印
  // branchBuf[agentId] = { lines: string[], accumulatedLabel, accumulatedMs }
  const branchBuf = new Map<string, { lines: string[]; accumulatedLabel: string; accumulatedMs: number }>();
  let inParallelMode = false; // 是否正在并行 spawn 执行中

  // AI 思考/输出流事件合并（同标签直接累加，不因中间事件打断而拆开）
  let accumulatedLabel = '';
  let accumulatedMs = 0;
  // 上一个事件的时间戳（仅用于流事件累加）
  let prevEventTs = 0;

  /** 带 branch 感知的输出：并行模式缓存到分支，非并行直接打印 */
  function emit(agentId: string | undefined, line: string): void {
    if (!inParallelMode || !agentId || !branchBuf.has(agentId)) {
      console.log(line);
    } else {
      const buf = branchBuf.get(agentId)!;
      buf.lines.push(line);
    }
  }

  /** 带 branch 感知的 flushAccumulated */
  function flushAccumulatedTo(agentId: string | undefined): void {
    if (accumulatedLabel && accumulatedMs > 0) {
      emit(agentId, `  ${accumulatedLabel} ${fmtElapsed(accumulatedMs)}`);
    }
    accumulatedLabel = '';
    accumulatedMs = 0;
  }

  /** 并行全完成后，打印分叉树 */
  function flushParallelBranches(): void {
    if (branchBuf.size === 0) return;
    const entries = [...branchBuf.entries()];
    branchBuf.clear();
    inParallelMode = false;

    if (entries.length === 1) {
      // 只有一个分支，直接打印
      for (const line of entries[0][1].lines) console.log(line);
      return;
    }

    // 多分支分叉打印
    for (let i = 0; i < entries.length; i++) {
      const [aid, buf] = entries[i];
      const prefix = i < entries.length - 1 ? '├ ' : '└ ';
      const contPrefix = i < entries.length - 1 ? '│ ' : '  ';
      const stageName = stageNameFromAgent(aid);
      console.log(`${prefix}${stageName}`);
      for (const line of buf.lines) {
        // 去掉行首的 "  " 缩进，换成 contPrefix
        const stripped = line.replace(/^  /, '');
        console.log(`${contPrefix}  ${stripped}`);
      }
    }
  }

  /** 流事件标签映射 */
  function streamLabel(type: string): string {
    switch (type) {
      case 'reasoning_delta': case 'thinking': return '🧠 思考';
      case 'response_delta': case 'content_delta': return '📝 输出';
      case 'progress': return '⏳ 处理';
      default: return type;
    }
  }

  /** 刷出累加的流事件（已废弃，用 flushAccumulatedTo） */

  const url = `${AGENT_SERVICE_URL}/api/v1/agent/chat/stream`;

  // 构造请求头，注入 cookie（如果有）
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const cookie = getCookie();
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session_id: sessionId,
      project_id: 'default',
      local_path: codeRoot,
      data_root: '~/.skywalker',
      messages,
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`agent-service 返回 HTTP ${response.status}: ${await response.text()}`);
  }

  if (!response.body) {
    throw new Error('agent-service 返回空 body（非流式响应）');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // 页面生成完成后提前终止 SSE 读取
    if (pageGenDone) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    // 按 \n\n 分割 SSE 事件
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6);
        if (!jsonStr.trim()) continue;

        try {
          const event: AgentStreamEvent = JSON.parse(jsonStr);
          const now = Date.now();
          const timedEvent: TimedEvent = { timestamp: now, event };
          roundEvents.push(timedEvent);

          // 检测 basic_config 的"等待用户输入"标记
          if (event.type === 'tool_result' && event.tool_result) {
            const resultStr = event.tool_result.replace(/​/g, ''); // 去掉零宽空格再匹配
            if (resultStr.includes(PENDING_INPUT_MARKER)) {
              // 区分来源：
              // - basic_config 的 PENDING（tool_name=mcp__smartgmp__basic_config 或 agent=ops-agent）
              //   → 需要用 basicConfig 自动回复
              // - design-agent 等其他 agent 的 ask_user_question（agent=design-agent）
              //   → 需要自动回复跳过（告诉 orchestrator 用 default headerPolicy 继续生成页面）
              const agentName = event.agent ?? '';
              const toolName = event.tool_name ?? '';
              const isBasicConfigPendng = toolName === 'mcp__smartgmp__basic_config'
                || agentName === 'ops-agent';
              if (isBasicConfigPendng) {
                needsUserInput = true;
              } else {
                needsNonBasicConfigInput = true;
              }
            }
          }

          // 收集 orchestrator 的最终回复
          if (event.type === 'response' && event.agent === 'orchestrator' && event.content) {
            orchestratorResponse = event.content;
            // 检测是否要求用户粘贴 cookie（Pradox 认证失败时的兜底）
            if (COOKIE_PROMPT_PATTERNS.some(p => p.test(event.content!))) {
              needsCookieInput = true;
            }
          }

          // === 事件打印 + 阶段追踪 ===
          // 每个事件都标注距上一个事件的耗时，加起来 = 总时间
          // spawn 完成额外标注"共XX"和时间分解

          // 更新全局 lastEventTs（跨轮共享）
          if (lastEventTsRef) lastEventTsRef.value = now;

          // 距上一个事件的时间差（前缀格式，表示"等了多久才到这步"）
          const gapMs = prevEventTs > 0 ? now - prevEventTs : 0;
          const gap = gapMs > 2 ? `[+${fmtElapsed(gapMs)}]` : '';

          // 当前事件属于哪个 spawn agent（用于路由到分支 + 累加分解耗时）
          const activeSpawnAgents = [...pendingSpawns.keys()];
          const currentSpawnAgent = activeSpawnAgents.length === 1
            ? activeSpawnAgents[0]
            : activeSpawnAgents.find(aid => event.agent === aid);
          const bd = currentSpawnAgent ? spawnTimeBreakdown.get(currentSpawnAgent) : undefined;

          // emit 目标：并行模式下路由到对应分支，非并行直接打印
          const emitTarget = currentSpawnAgent;

          if (event.type === 'tool_call') {
            flushAccumulatedTo(emitTarget);
            // 记录 call 时间，等 result 时算执行耗时
            const callKey = `${event.agent ?? ''}:${event.tool_name ?? ''}`;
            const queue = pendingCalls.get(callKey) ?? [];
            queue.push(now);
            pendingCalls.set(callKey, queue);

            if (event.tool_name === 'sessions_spawn' || event.tool_name === 'sessions_spawn_parallel') {
              try {
                const raw = event.tool_input ?? '{}';
                const input = typeof raw === 'string' ? JSON.parse(raw) : raw;
                // 支持单个 agent_id 或多个 agent_ids
                const agentIds: string[] = input.agent_ids ?? (input.agent_id ? [input.agent_id] : []);
                const isParallel = event.tool_name === 'sessions_spawn_parallel' && agentIds.length > 1;
                if (isParallel) {
                  console.log(`  🔀 spawn ∥ ${agentIds.map(id => stageNameFromAgent(id)).join(' + ')} ${gap}`);
                  // 初始化各分支缓存
                  inParallelMode = true;
                  for (const aid of agentIds) {
                    branchBuf.set(aid, { lines: [], accumulatedLabel: '', accumulatedMs: 0 });
                  }
                } else if (agentIds.length === 1) {
                  console.log(`  🔀 spawn → ${agentIds[0]} ${gap}`);
                } else {
                  console.log(`  🔀 spawn → ${input.agent_id ?? '?'} ${gap}`);
                }
                for (const aid of agentIds) {
                  pendingSpawns.set(aid, now);
                  spawnTimeBreakdown.set(aid, { think: 0, output: 0, tool: 0, other: 0 });
                  if (stages && !stages.some(s => s.name === stageNameFromAgent(aid))) {
                    stages.push({ name: stageNameFromAgent(aid), startTs: now, endTs: now });
                  }
                }
                // 兜底：如果没有 agent_ids 数组，回退到 agent_id 单个
                if (agentIds.length === 0 && input.agent_id) {
                  pendingSpawns.set(input.agent_id, now);
                  spawnTimeBreakdown.set(input.agent_id, { think: 0, output: 0, tool: 0, other: 0 });
                  if (stages && !stages.some(s => s.name === stageNameFromAgent(input.agent_id))) {
                    stages.push({ name: stageNameFromAgent(input.agent_id), startTs: now, endTs: now });
                  }
                }
                // 记录并行 spawn 的 agent 集合
                parallelSpawnAgents = isParallel ? [...agentIds] : [];
                // 记录 call → agent_id 对应关系（用于 result 配对）
                const spawnQueue = pendingSpawnAgentIds.get(callKey) ?? [];
                const idsToRecord = agentIds.length > 0 ? agentIds : (input.agent_id ? [input.agent_id] : ['?']);
                spawnQueue.push(...idsToRecord);
                pendingSpawnAgentIds.set(callKey, spawnQueue);
              } catch {
                console.log(`  🔀 spawn ${gap}`);
              }
            } else if (event.tool_name?.includes('generate_page')) {
              emit(emitTarget, `  📄 generate_page ${gap}`);
            } else if (event.tool_name?.includes('campaign_create')) {
              emit(emitTarget, `  📋 campaign_create ${gap}`);
            } else if (event.tool_name?.includes('basic_config')) {
              emit(emitTarget, `  ⚙️ basic_config ${gap}`);
            } else {
              emit(emitTarget, `    ↳ ${shortToolName(event.tool_name ?? '')} ${gap}`);
            }
          }

          else if (event.type === 'tool_result') {
            flushAccumulatedTo(emitTarget);
            const toolName = event.tool_name ?? '';
            const agentName = event.agent ?? '';

            // 算工具执行耗时：call → result
            const callKey = `${agentName}:${toolName}`;
            const callQueue = pendingCalls.get(callKey);
            const callTs = callQueue?.shift();
            if (callQueue && callQueue.length === 0) pendingCalls.delete(callKey);
            const execMs = callTs ? now - callTs : -1;
            // ≤2ms 视为 SSE 批量到达导致，不显示
            const execDur = execMs > 2 ? fmtElapsed(execMs) : '';
            // 归算工具执行耗时到 spawn 分解（排除 spawn 本身，避免重复）
            if (bd && execMs > 0 && !toolName.startsWith('sessions_spawn')) {
              bd.tool += execMs;
            }

            if (toolName === 'sessions_spawn' || toolName === 'sessions_spawn_parallel') {
              // spawn 完成：从 call→result 配对获取 agent_id
              const spawnAidQueue = pendingSpawnAgentIds.get(callKey);
              const agentIds = spawnAidQueue?.splice(0, 1) ?? [];
              if (spawnAidQueue && spawnAidQueue.length === 0) pendingSpawnAgentIds.delete(callKey);

              // 兜底：从 result 文本中尝试解析
              if (agentIds.length === 0) {
                try {
                  const raw = event.tool_result ?? '';
                  const jsonStart = raw.indexOf('[') >= 0 ? Math.min(raw.indexOf('['), raw.indexOf('{') < 0 ? Infinity : raw.indexOf('{')) : raw.indexOf('{');
                  if (jsonStart >= 0 && jsonStart !== Infinity) {
                    const parsed = JSON.parse(raw.slice(jsonStart));
                    if (Array.isArray(parsed)) {
                      for (const item of parsed) {
                        const aid = item.agent_id ?? item.agentId;
                        if (aid) agentIds.push(aid);
                      }
                    } else {
                      const aid = parsed.agent_id ?? parsed.agentId;
                      if (aid) agentIds.push(aid);
                    }
                  }
                  if (agentIds.length === 0) {
                    const bracketMatch = raw.match(/\[([\w-]+-agent)\]/);
                    if (bracketMatch) agentIds.push(bracketMatch[1]);
                  }
                } catch { /* 忽略 */ }
              }

              const completedAgents = agentIds.map(aid => ({
                agentId: aid,
                spawnTs: pendingSpawns.get(aid) ?? callTs ?? now,
              }));

              const isPartOfParallel = completedAgents.length > 1
                || completedAgents.some(a => parallelSpawnAgents.includes(a.agentId));

              // 构建 spawn 完成行
              function formatSpawnDone(aid: string, totalMs: number): string {
                const b = spawnTimeBreakdown.get(aid);
                const parts: string[] = [];
                if (b) {
                  if (b.think > 100) parts.push(`思考${fmtElapsed(b.think)}`);
                  if (b.output > 100) parts.push(`输出${fmtElapsed(b.output)}`);
                  if (b.tool > 100) parts.push(`工具${fmtElapsed(b.tool)}`);
                  const accounted = b.think + b.output + b.tool + b.other;
                  const unaccounted = totalMs - accounted;
                  if (unaccounted > 500) parts.push(`等待${fmtElapsed(unaccounted)}`);
                  spawnTimeBreakdown.delete(aid);
                }
                const breakdown = parts.length > 0 ? ` (${parts.join('+')})` : '';
                return `  ↩ ${stageNameFromAgent(aid)} 共${fmtElapsed(totalMs)}${breakdown}`;
              }

              if (completedAgents.length > 1) {
                // 批量返回
                const durations = completedAgents.map(a => {
                  pendingSpawns.delete(a.agentId);
                  return now - a.spawnTs;
                });
                const maxDur = Math.max(...durations);
                // 把完成行加到各分支的 lines
                for (const a of completedAgents) {
                  const idx = completedAgents.indexOf(a);
                  const line = formatSpawnDone(a.agentId, durations[idx]);
                  const buf = branchBuf.get(a.agentId);
                  if (buf) buf.lines.push(line);
                  else console.log(line);
                  if (stages) {
                    const stageName = stageNameFromAgent(a.agentId);
                    const stage = stages.find(s => s.name === stageName);
                    if (stage) stage.endTs = now;
                  }
                  parallelSpawnAgents = parallelSpawnAgents.filter(id => id !== a.agentId);
                }
                // 全部完成，分叉打印
                if (parallelSpawnAgents.length === 0) {
                  flushParallelBranches();
                  console.log(`  ↩ ∥ 并行总耗时 共${fmtElapsed(maxDur)}`);
                }
              } else if (completedAgents.length === 1) {
                const a = completedAgents[0];
                pendingSpawns.delete(a.agentId);
                const totalMs = a.spawnTs ? now - a.spawnTs : 0;
                const doneLine = formatSpawnDone(a.agentId, totalMs);

                if (isPartOfParallel) {
                  // 并行中的一个 agent 完成，加到分支 lines
                  const buf = branchBuf.get(a.agentId);
                  if (buf) buf.lines.push(doneLine);
                  else console.log(doneLine);

                  parallelSpawnAgents = parallelSpawnAgents.filter(id => id !== a.agentId);
                  // 如果所有并行 agent 都完成，分叉打印
                  if (parallelSpawnAgents.length === 0) {
                    // 计算并行总耗时：最晚的 endTs - 最早的 startTs
                    const allStartTs = completedAgents.length > 1
                      ? Math.min(...completedAgents.map(x => x.spawnTs))
                      : a.spawnTs;
                    const parallelTotalMs = allStartTs ? now - allStartTs : totalMs;
                    flushParallelBranches();
                    console.log(`  ↩ ∥ 并行总耗时 共${fmtElapsed(parallelTotalMs)}`);
                  }
                } else {
                  // 串行
                  console.log(doneLine);
                }

                if (stages) {
                  const stageName = stageNameFromAgent(a.agentId);
                  const stage = stages.find(s => s.name === stageName);
                  if (stage) stage.endTs = now;
                }
              } else {
                console.log(`  ↩ spawn 完成${execDur ? ' ' + execDur : ''}`);
              }
            } else if (toolName.includes('generate_page')) {
              emit(emitTarget, `  ✅ generate_page 完成${execDur ? ' ' + execDur : ''}`);
              if (earlyStopOnPageGen) {
                pageGenDone = true;
              }
              if (stages) {
                const pageStage = stages.find(s => s.name === '生成页面');
                if (pageStage) pageStage.endTs = now;
              }
            } else if (toolName.includes('campaign_create')) {
              emit(emitTarget, `  📋 campaign_create 完成${execDur ? ' ' + execDur : ''}`);
              if (stages) {
                const opsStage = stages.find(s => s.name === '活动配置');
                if (opsStage) opsStage.endTs = now;
              }
            } else if (toolName.includes('basic_config')) {
              emit(emitTarget, `  ⚙️ basic_config 完成${execDur ? ' ' + execDur : ''}`);
            } else {
              emit(emitTarget, `    ↳ ${shortToolName(toolName)} 完成${execDur ? ' ' + execDur : ''}`);
            }
          }

          else if (event.type === 'response') {
            flushAccumulatedTo(emitTarget);
          }

          else if (event.type === 'error') {
            flushAccumulatedTo(emitTarget);
            emit(emitTarget, `  ❌ ${event.content}`);
          }

          // AI 思考/输出流事件：合并同标签，直接累加耗时
          else if (event.type === 'reasoning_delta' || event.type === 'response_delta'
                   || event.type === 'thinking' || event.type === 'content_delta'
                   || event.type === 'progress') {
            const deltaMs = prevEventTs > 0 ? (now - prevEventTs) : 0;
            const label = streamLabel(event.type);
            // 累加到 spawn 分解
            if (bd) {
              if (label === '🧠 思考') bd.think += deltaMs;
              else if (label === '📝 输出') bd.output += deltaMs;
              else bd.other += deltaMs;
            }
            if (accumulatedLabel === label) {
              accumulatedMs += deltaMs;
            } else {
              flushAccumulatedTo(emitTarget);
              accumulatedLabel = label;
              accumulatedMs = deltaMs;
            }
          }

          prevEventTs = now;
        } catch {
          // 非 JSON 行，跳过
        }
      }
    }
  }

  flushAccumulatedTo(undefined);
  // 如果还有未打印的并行分支，清空
  if (branchBuf.size > 0) flushParallelBranches();
  return { events: roundEvents, needsUserInput, needsNonBasicConfigInput, needsCookieInput, orchestratorResponse };
}

/** 格式化耗时（紧凑格式） */
function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** agent ID → 阶段名称 */
function stageNameFromAgent(agentId: string): string {
  switch (agentId) {
    case 'ops-agent': return '活动配置';
    case 'qingju-visual-agent': return '生成头图';
    case 'gmp-dev-agent': return '生成页面';
    case 'design-agent': return '设计处理';
    default: return agentId;
  }
}

/** 简化工具名：mcp__smartgmp__basic_config → basic_config */
function shortToolName(toolName: string): string {
  return toolName.replace(/^mcp__\w+__/, '');
}

/** 判断工具名是否属于辅助工具（用于终端打印时简略显示） */
function isAuxiliaryToolName(toolName: string): boolean {
  const auxiliaryKeywords = [
    'basic_config',
    'activity_base_config',
    'user_workspace_list',
    'user_workspace_add_dep',
    'user_workspace_git',
    'user_workspace_read_file',
    'pradox_cookie_save',
    'design_save_image_from_url',
    'image_upload',
    'think',
  ];
  return auxiliaryKeywords.some(kw => toolName.includes(kw));
}

/**
 * 构造第一轮回复：业务线环境配置（AI 首次回复后自动填入）
 */
function buildBizConfigAnswer(config: BasicConfig): string {
  const forceLoginLabel = config.forceLogin ? '是' : '否';
  const envLabel = (e: string) => `Stable / Osim (${e})`;
  return `【业务线环境已确认 · 请创建 Pradox 活动】
- 业务线：电单车（bizId=${config.bizId}）
- B 环境 / SkyWalker 平台（来自登录态，bEnv，兼容 env）：${envLabel(config.bEnv)}
- C 环境 / KOP 页面（cEnv）：${envLabel(config.cEnv)}
- simCluster（key）：${config.simCluster}
- forceLogin（key）：${forceLoginLabel}
- 头图来源：按主题生成头图

\`\`\`json
{
  "bizId": "${config.bizId}",
  "forceLogin": ${config.forceLogin},
  "env": "${config.env}",
  "bEnv": "${config.bEnv}",
  "cEnv": "${config.cEnv}",
  "simCluster": "${config.simCluster}",
  "headerImageSource": "generate"
}
\`\`\`

【Orchestrator 必做 — 勿 ask_user_question / 勿 spawn skill-agent】
1. 立即 \`sessions_spawn('ops-agent', task=...)\`；task 须写明 Cookie 已由后端写入 store，不要调用 pradox_cookie_save。
2. 调用 \`mcp__smartgmp__pradox_campaign_create({ payload_json: JSON.stringify({ bizId }), env: bEnv, sim_cluster: simCluster, sim_biz_type: 'htw' })\` 创建活动；B 环境只控制 Pradox，Cookie 只负责鉴权和用户身份。
3. 创建成功后返回 campaignId、bizId、bEnv、cEnv、simCluster、forceLogin，并组装 basicConfig：\`{ campaignId, bizId, forceLogin, env: bEnv, bEnv, cEnv, simCluster }\`。
4. 从本会话**第一条**用户消息读取活动页需求原文，先构造 PagePlan：\`headerPolicy=ai | provided | default\`。若 JSON 里有 \`selectedHeaderImageUrl\` 或用户已有可用 https 首图 URL，必须设为 \`provided\`，跳过头图生成并把该 URL 作为 \`imageAssets.headerImageUrl\` 传给 \`new_generate_page\`；否则自然语言活动页默认 \`ai\`；若用户明确说使用默认首图 / 不定制头图则为 \`default\`。
5. 仅当 \`headerPolicy=ai\` 时，才先 \`sessions_spawn('qingju-visual-agent', task=...)\` 生成活动头图 CDN URL，再 \`sessions_spawn('gmp-dev-agent', task=...)\` 一次调用 \`mcp__smartgmp__new_generate_page\`，直接带真实 \`headerImageUrl\` 生成页面。
6. 组件背景图默认保留组件兜底图，不作为首轮必做项；只有用户明确要求统一主题化组件背景时，才在页面生成后额外派 \`design-agent\` 处理。
7. \`componentDescriptions\` 只能由后端根据本会话第一条真实用户需求结构化解析并透传；不得从本条桥接消息、路由提示或示例说明中抽取组件；**不要**在 descriptions 里写「活动头图」「首图」（首图由工具自动选择：bizId=309/363 用 head-img，租车/bizId=901 用 act-header）。
8. 禁止跳过活动创建、禁止跳过 PagePlan 直接派 gmp-dev-agent、禁止仅回复文字而不 spawn。`;
}

/**
 * 构造催促生成页面的消息（pradox_campaign_create 完成后自动推送）
 */
function buildGeneratePagePrompt(testCase: TestCase): string {
  const config = testCase.basicConfig;
  if (!config) return '请立即生成页面。';
  return `【活动已创建 · 直接生成页面】
活动创建已完成，不要再调用 pradox_campaign_create。
basicConfig 已确认：
\`\`\`json
${JSON.stringify({ bizId: config.bizId, forceLogin: config.forceLogin, env: config.env, bEnv: config.bEnv, cEnv: config.cEnv, simCluster: config.simCluster })}
\`\`\`

【下一步】
1. 先 \`sessions_spawn('qingju-visual-agent', task=...)\` 生成活动头图，拿到 CDN URL
2. 再 \`sessions_spawn('gmp-dev-agent', task=...)\`，让 gmp-dev-agent 调用 \`mcp__smartgmp__new_generate_page\`
使用 headerPolicy=ai，传入上一步拿到的 headerImageUrl。`;
}

/**
 * 向 agent-service 发送用户消息并收集 SSE 事件流
 * 支持多轮对话：检测到 PENDING_USER_INPUT 时自动用 testCase.basicConfig 回答
 */
export async function runTestCase(
  testCase: TestCase,
  codeRoot: string,
): Promise<RunResult> {
  const sessionId = `eval-${testCase.id}-${Date.now()}`;
  const allEvents: TimedEvent[] = [];
  let firstToolCallTs: number | null = null;
  let doneTs: number | null = null;
  let pageGenResultTs: number | null = null; // new_generate_page tool_result 的时间
  let timedOut = false;
  let error: string | null = null;

  // 页面生成类用例：generate_page 返回后提前终止
  const earlyStopOnPageGen = testCase.expectedIntent === 'page_generation';

  const startTs = Date.now();
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, testCase.timeoutMs);

  // 阶段计时收集器
  const stages: StageTiming[] = [];
  // 跨轮共享的上一个事件时间戳
  const lastEventTsRef = { value: 0 };

  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: testCase.prompt },
  ];

  try {
    const maxRounds = 8;
    let hasRepliedBizConfig = false; // 是否已回复业务线配置
    let hasRepliedCampaignDone = false; // 是否已在 campaign_create 后催促生成页面

    for (let round = 0; round < maxRounds; round++) {
      const result = await sendAndCollect(
        sessionId,
        messages,
        codeRoot,
        controller,
        earlyStopOnPageGen,
        stages,
        lastEventTsRef,
      );

      allEvents.push(...result.events);

      // 追踪关键时间点（只记录首次）
      for (const te of result.events) {
        if (te.event.type === 'tool_call' && firstToolCallTs === null) {
          firstToolCallTs = te.timestamp;
        }
        if (te.event.type === 'done') {
          doneTs = te.timestamp;
        }
        if (te.event.type === 'tool_result' && te.event.tool_name?.includes('generate_page') && pageGenResultTs === null) {
          pageGenResultTs = te.timestamp;
        }
      }

      // 页面生成完成后直接退出
      if (earlyStopOnPageGen && pageGenResultTs !== null) {
        break;
      }

      // 优先级1：第一轮 AI 回复后，自动填入业务线环境配置
      if (!hasRepliedBizConfig && result.orchestratorResponse && testCase.basicConfig) {
        hasRepliedBizConfig = true;
        const answer = buildBizConfigAnswer(testCase.basicConfig);
        const gapDur = lastEventTsRef.value > 0 ? fmtElapsed(Date.now() - lastEventTsRef.value) : '';
        lastEventTsRef.value = Date.now();
        console.log(`  🔄 自动填入业务线配置 ${gapDur}`);
        messages.push({ role: 'assistant', content: result.orchestratorResponse });
        messages.push({ role: 'user', content: answer });
        continue;
      }

      // 优先级2：pradox_campaign_create 完成但还没生成页面，催促继续
      if (!hasRepliedCampaignDone && pageGenResultTs === null) {
        const hasCampaignDone = result.events.some(
          te => te.event.type === 'tool_result' && te.event.tool_name?.includes('campaign_create'),
        );
        if (hasCampaignDone) {
          hasRepliedCampaignDone = true;
          const gapDur = lastEventTsRef.value > 0 ? fmtElapsed(Date.now() - lastEventTsRef.value) : '';
          lastEventTsRef.value = Date.now();
          console.log(`  🔄 活动已创建，催促生成页面 ${gapDur}`);
          if (result.orchestratorResponse) {
            messages.push({ role: 'assistant', content: result.orchestratorResponse });
          }
          messages.push({ role: 'user', content: buildGeneratePagePrompt(testCase) });
          continue;
        }
      }

      // 优先级3：Cookie 要求
      if (result.needsCookieInput) {
        const cookie = getCookie();
        if (cookie) {
          const gapDur = lastEventTsRef.value > 0 ? fmtElapsed(Date.now() - lastEventTsRef.value) : '';
          lastEventTsRef.value = Date.now();
          console.log(`  🔄 自动粘贴 Cookie ${gapDur}`);
          if (result.orchestratorResponse) {
            messages.push({ role: 'assistant', content: result.orchestratorResponse });
          }
          messages.push({ role: 'user', content: `这是我的 Cookie：\n${cookie}` });
          continue;
        } else {
          console.log(`  ⚠️ 需要 Cookie 但未配置 SKYWALKER_COOKIE`);
        }
      }

      // 优先级4：非 basic_config 的 PENDING（如生图工具缺失），跳过生图
      if (result.needsNonBasicConfigInput) {
        const gapDur = lastEventTsRef.value > 0 ? fmtElapsed(Date.now() - lastEventTsRef.value) : '';
        lastEventTsRef.value = Date.now();
        console.log(`  🔄 自动跳过生图 ${gapDur}`);
        if (result.orchestratorResponse) {
          messages.push({ role: 'assistant', content: result.orchestratorResponse });
        }
        messages.push({ role: 'user', content: `跳过 AI 生图。不需要头图，使用默认首图即可。请直接使用 headerPolicy=default 派 gmp-dev-agent 调用 new_generate_page 生成页面，不要传 headerImageUrl。basicConfig 已确认：${JSON.stringify(testCase.basicConfig)}。` });
        continue;
      }

      // 优先级5：basic_config 的 PENDING（兜底，正常流程第一轮已自动回复）
      if (result.needsUserInput && testCase.basicConfig) {
        const gapDur = lastEventTsRef.value > 0 ? fmtElapsed(Date.now() - lastEventTsRef.value) : '';
        lastEventTsRef.value = Date.now();
        console.log(`  🔄 自动填入 basicConfig ${gapDur}`);
        if (result.orchestratorResponse) {
          messages.push({ role: 'assistant', content: result.orchestratorResponse });
        }
        messages.push({ role: 'user', content: buildBizConfigAnswer(testCase.basicConfig) });
        continue;
      }

      // 不需要用户输入，对话结束
      break;
    }
  } catch (e) {
    if (timedOut) {
      error = `超时（${testCase.timeoutMs / 1000}s）`;
    } else {
      error = e instanceof Error ? e.message : String(e);
    }
  } finally {
    clearTimeout(timeoutTimer);
  }

  if (doneTs === null) {
    doneTs = Date.now();
  }

  if (error) console.log(`  ❌ 错误: ${error}`);

  return { events: allEvents, timedOut, error, firstToolCallTs, doneTs, pageGenResultTs, stages, sessionId, messages };
}

/**
 * 修复测试专用 — 在已有会话上发送修复 prompt，等待 AI 完成修复
 * 不复用 pageGen 提前终止，直到 done 或超时
 */
export async function runFixSession(
  sessionId: string,
  codeRoot: string,
  priorMessages: Array<{ role: string; content: string }>,
  fixMessage: string,
  timeoutMs: number,
): Promise<RunResult> {
  const allEvents: TimedEvent[] = [];
  let doneTs: number | null = null;
  let timedOut = false;
  let error: string | null = null;

  const messages = [...priorMessages, { role: 'user', content: fixMessage }];
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const stages: StageTiming[] = [];
  const lastEventTsRef = { value: 0 };

  try {
    const maxRounds = 4;
    for (let round = 0; round < maxRounds; round++) {
      const result = await sendAndCollect(
        sessionId,
        messages,
        codeRoot,
        controller,
        false,
        stages,
        lastEventTsRef,
      );

      allEvents.push(...result.events);

      for (const te of result.events) {
        if (te.event.type === 'done') {
          doneTs = te.timestamp;
        }
      }

      if (result.needsCookieInput) {
        const cookie = getCookie();
        if (cookie) {
          console.log(`  🔄 自动粘贴 Cookie`);
          if (result.orchestratorResponse) {
            messages.push({ role: 'assistant', content: result.orchestratorResponse });
          }
          messages.push({ role: 'user', content: `这是我的 Cookie：\n${cookie}` });
          continue;
        }
      }

      break;
    }
  } catch (e) {
    if (timedOut) {
      error = `修复超时（${timeoutMs / 1000}s）`;
    } else {
      error = e instanceof Error ? e.message : String(e);
    }
  } finally {
    clearTimeout(timeoutTimer);
  }

  if (doneTs === null) {
    doneTs = Date.now();
  }

  return {
    events: allEvents,
    timedOut,
    error,
    firstToolCallTs: null,
    doneTs,
    pageGenResultTs: null,
    stages,
    sessionId,
    messages,
  };
}
