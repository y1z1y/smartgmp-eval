/**
 * 测试执行器 — 调用 agent-service SSE 接口 + 收集事件
 *
 * 支持多轮对话：当 agent 调用 basic_config 返回 PENDING_USER_INPUT 标记时，
 * 自动用测试用例中配置的参数回答，继续对话直到页面生成完成。
 *
 * 关键发现：agent-service 原始 SSE 流里没有 question 事件类型，
 * basic_config 的"等待用户填写"是通过 tool_result 里的
 * __SKYWALKER_PENDING_USER_INPUT__ 标记实现的。
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
  /** 首次 tool_call 的时间戳（用于计算意图识别耗时） */
  firstToolCallTs: number | null;
  /** done 事件的时间戳 */
  doneTs: number | null;
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
 */
async function sendAndCollect(
  sessionId: string,
  messages: Array<{ role: string; content: string }>,
  codeRoot: string,
  verbose: boolean,
  controller: AbortController,
): Promise<RoundResult> {
  const roundEvents: TimedEvent[] = [];
  let needsUserInput = false;
  let needsNonBasicConfigInput = false;
  let needsCookieInput = false;
  let orchestratorResponse: string | null = null;

  const url = `${AGENT_SERVICE_URL}/api/v1/agent/chat/stream`;
  if (verbose) console.log(`  [runner] POST ${url} session=${sessionId}`);

  // 构造请求头，注入 cookie（如果有）
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const cookie = getCookie();
  if (cookie) {
    headers['Cookie'] = cookie;
    if (verbose) console.log(`  [runner] 带 Cookie 请求（长度=${cookie.length}）`);
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
          // 实际标记为 __SKYWALKER_PENDING_USER_INPUT__ + 零宽空格(​)
          // 用 includes 匹配主干部分即可（零宽空格不影响）
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
                console.log(`  [runner] 检测到 PENDING_USER_INPUT（basic_config/${agentName}），需要用户填写配置`);
              } else {
                needsNonBasicConfigInput = true;
                console.log(`  [runner] 检测到 PENDING_USER_INPUT（非 basic_config: agent=${agentName}, tool=${toolName}），需要跳过`);
              }
            }
          }

          // 收集 orchestrator 的最终回复
          if (event.type === 'response' && event.agent === 'orchestrator' && event.content) {
            orchestratorResponse = event.content;
            // 检测是否要求用户粘贴 cookie（Pradox 认证失败时的兜底）
            if (COOKIE_PROMPT_PATTERNS.some(p => p.test(event.content!))) {
              needsCookieInput = true;
              console.log(`  [runner] 检测到 Orchestrator 要求粘贴 Cookie，Pradox 认证可能失败`);
            }
          }

          // 始终打印关键事件（不做 verbose 控制）
          if (event.type === 'response' && event.content) {
            const agent = event.agent ?? '?';
            const preview = event.content.length > 300 ? event.content.slice(0, 300) + '...' : event.content;
            console.log(`  [AI回复][${agent}] ${preview}`);
          }
          if (event.type === 'tool_call') {
            const agent = event.agent ?? '?';
            let inputStr = '';
            if (event.tool_input) {
              // tool_input 可能是对象或字符串
              const raw = event.tool_input;
              inputStr = typeof raw === 'string' ? raw : JSON.stringify(raw);
              if (inputStr.length > 500) inputStr = inputStr.slice(0, 500) + '...';
            }
            // 对 new_generate_page 特别打印完整 codeRoot
            if (event.tool_name?.includes('generate_page')) {
              try {
                const input = typeof event.tool_input === 'string' ? JSON.parse(event.tool_input) : event.tool_input;
                console.log(`  [tool_call][${agent}] ${event.tool_name} codeRoot=${input.codeRoot ?? '未传'} pageDescription=${input.pageDescription ?? ''} componentDescriptions=${JSON.stringify(input.componentDescriptions ?? [])}`);
              } catch {
                console.log(`  [tool_call][${agent}] ${event.tool_name} input=${inputStr}`);
              }
            } else {
              console.log(`  [tool_call][${agent}] ${event.tool_name} input=${inputStr}`);
            }
          }
          if (event.type === 'tool_result') {
            const agent = event.agent ?? '?';
            const resultPreview = event.tool_result
              ? (event.tool_result.length > 200 ? event.tool_result.slice(0, 200) + '...' : event.tool_result)
              : '';
            console.log(`  [tool_result][${agent}] ${event.tool_name} result=${resultPreview}`);
          }
          if (event.type === 'error') {
            console.log(`  [ERROR] ${event.content}`);
          }
          if (event.type === 'done') {
            console.log(`  [done]`);
          }
        } catch {
          // 非 JSON 行，跳过
        }
      }
    }
  }

  return { events: roundEvents, needsUserInput, needsNonBasicConfigInput, needsCookieInput, orchestratorResponse };
}

/**
 * 构造 basic_config 表单的回答消息（模拟真实用户填写格式）
 */
function buildBasicConfigAnswer(config: BasicConfig): string {
  const forceLoginLabel = config.forceLogin ? '是' : '否';
  return `【活动基础配置已确认 · 请进入第二步生成页面】
- campaignId（key）：${config.campaignId}
- bizId（key）：${config.bizId}
- env（key）：Stable / Osim (${config.env})
- simCluster（key）：${config.simCluster}
- forceLogin（key）：${forceLoginLabel}

\`\`\`json
{
  "campaignId": "${config.campaignId}",
  "bizId": "${config.bizId}",
  "forceLogin": ${config.forceLogin},
  "env": "${config.env}",
  "simCluster": "${config.simCluster}"
}
\`\`\`

【Orchestrator 必做 — 勿再 basic_config / 勿 ask_user_question / 勿 spawn skill-agent】
1. 从本会话**第一条**用户消息读取活动页需求原文，作为 gmp-dev-agent 的 pageDescription。
2. 使用 **headerPolicy=default**（不需要 AI 生图，使用默认首图策略），**不要** spawn design-agent。
3. 立即 \`sessions_spawn('gmp-dev-agent', task=...)\`；task 须写明子 Agent **必须先**调用 \`mcp__smartgmp__new_generate_page\`，并传入上方 basicConfig JSON（含 env、simCluster）。headerPolicy=default，不要传 headerImageUrl。
4. 禁止再次 spawn ops-agent 或 design-agent 或仅回复文字而不 spawn。`;
}

/**
 * 向 agent-service 发送用户消息并收集 SSE 事件流
 * 支持多轮对话：检测到 PENDING_USER_INPUT 时自动用 testCase.basicConfig 回答
 */
export async function runTestCase(
  testCase: TestCase,
  codeRoot: string,
  verbose: boolean = false,
): Promise<RunResult> {
  const sessionId = `eval-${testCase.id}-${Date.now()}`;
  const allEvents: TimedEvent[] = [];
  let firstToolCallTs: number | null = null;
  let doneTs: number | null = null;
  let timedOut = false;
  let error: string | null = null;

  const startTs = Date.now();
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, testCase.timeoutMs);

  try {
    // 构造消息历史（多轮对话需要带上之前的消息）
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: testCase.prompt },
    ];

    const maxRounds = 5; // 最多5轮对话，防止无限循环

    for (let round = 0; round < maxRounds; round++) {
      console.log(`  [runner] === 第 ${round + 1} 轮对话 ===`);

      const result = await sendAndCollect(
        sessionId,
        messages,
        codeRoot,
        verbose,
        controller,
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
      }

      console.log(`  [runner] needsUserInput=${result.needsUserInput}, needsNonBasicConfigInput=${result.needsNonBasicConfigInput}, needsCookieInput=${result.needsCookieInput}, hasBasicConfig=${!!testCase.basicConfig}, orchestratorResponse=${result.orchestratorResponse ? '有' : '无'}`);

      // 兜底：如果 orchestrator 要求粘贴 cookie，自动回复
      if (result.needsCookieInput) {
        const cookie = getCookie();
        if (cookie) {
          console.log(`  [runner] 自动粘贴 Cookie，继续第 ${round + 2} 轮`);
          if (result.orchestratorResponse) {
            messages.push({ role: 'assistant', content: result.orchestratorResponse });
          }
          messages.push({ role: 'user', content: `这是我的 Cookie：\n${cookie}` });
          continue;
        } else {
          console.log(`  [runner] ⚠️ Orchestrator 要求 Cookie 但 .env 未配置 SKYWALKER_COOKIE，无法自动回复`);
        }
      }

      // 如果 design-agent 等非 basic_config agent 要求用户输入（如图片工具缺失），
      // 自动回复"跳过生图，使用 default headerPolicy 直接生成页面"
      if (result.needsNonBasicConfigInput) {
        console.log(`  [runner] 检测到非 basic_config 的 PENDING（可能是 design-agent 缺图片工具），自动跳过生图`);
        if (result.orchestratorResponse) {
          messages.push({ role: 'assistant', content: result.orchestratorResponse });
        }
        messages.push({ role: 'user', content: `跳过 AI 生图。不需要头图，使用默认首图即可。请直接使用 headerPolicy=default 派 gmp-dev-agent 调用 new_generate_page 生成页面，不要传 headerImageUrl。basicConfig 已确认：${JSON.stringify(testCase.basicConfig)}。` });
        continue;
      }

      // 如果检测到 basic_config 需要用户输入配置，自动回答并继续
      if (result.needsUserInput && testCase.basicConfig) {
        const answer = buildBasicConfigAnswer(testCase.basicConfig);
        console.log(`  [runner] 自动填入 basicConfig，继续第 ${round + 2} 轮`);

        // 把 orchestrator 回复和用户回答加入消息历史
        if (result.orchestratorResponse) {
          messages.push({ role: 'assistant', content: result.orchestratorResponse });
        }
        messages.push({ role: 'user', content: answer });
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

  if (verbose) {
    const totalMs = doneTs - startTs;
    console.log(`  [runner] 完成: ${allEvents.length} 个事件, 耗时 ${(totalMs / 1000).toFixed(1)}s`);
    if (error) console.log(`  [runner] 错误: ${error}`);
  }

  return { events: allEvents, timedOut, error, firstToolCallTs, doneTs };
}
