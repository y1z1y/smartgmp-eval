/**
 * SSE 透明代理 — 拦截 agent-service 的所有请求，复制 SSE 流做实时链路分析
 *
 * 不改 SkyWalker 任何代码，只需要前端连代理端口（如 8001）而非直连 8000。
 * 代理只做两件事：
 *  1. 透传：请求原样转发给 agent-service，响应原样返回给前端
 *  2. 偷看：SSE 事件流经过时复制一份，实时分析调用链路和耗时
 */
import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import type { AgentStreamEvent } from './types.js';

// ========== 配置 ==========

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000';
const DEFAULT_PROXY_PORT = 47890;

// ========== Session 追踪 ==========

interface SessionTracker {
  sessionId: string;
  startTs: number;
  firstToolCallTs: number | null;
  pageGenResultTs: number | null;
  doneTs: number | null;
  /** agent → tool → count */
  agentTools: Map<string, Map<string, number>>;
  /** spawn 的 agent 列表（按顺序） */
  spawnedAgents: string[];
  /** 最近一次有事件活动的时间 */
  lastActivityTs: number;
}

const sessions = new Map<string, SessionTracker>();

function getOrCreateTracker(sessionId: string): SessionTracker {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      sessionId,
      startTs: Date.now(),
      firstToolCallTs: null,
      pageGenResultTs: null,
      doneTs: null,
      agentTools: new Map(),
      spawnedAgents: [],
      lastActivityTs: Date.now(),
    });
    console.log(`\n📥 新会话: ${sessionId}`);
  }
  return sessions.get(sessionId)!;
}

/** 简化工具名 */
const shortTool = (t: string) => t.replace(/^mcp__\w+__/, '');

/** 处理单个 SSE 事件 */
function handleEvent(sessionId: string, event: AgentStreamEvent): void {
  const tracker = getOrCreateTracker(sessionId);
  tracker.lastActivityTs = Date.now();

  const now = Date.now();

  if (event.type === 'tool_call') {
    // 首次 tool_call → 思考阶段结束
    if (tracker.firstToolCallTs === null) {
      tracker.firstToolCallTs = now;
      const thinkMs = now - tracker.startTs;
      console.log(`     思考耗时: ${(thinkMs / 1000).toFixed(1)}s`);
    }

    const toolName = event.tool_name ?? '';
    const agent = event.agent ?? '?';

    // spawn
    if (toolName === 'sessions_spawn' || toolName === 'sessions_spawn_parallel') {
      try {
        const raw = event.tool_input ?? '{}';
        const input = typeof raw === 'string' ? JSON.parse(raw) : raw;
        // 支持单个 agent_id 或多个 agent_ids
        const ids: string[] = input.agent_ids ?? (input.agent_id ? [input.agent_id] : []);
        const agentIds = ids.length > 0 ? ids : (input.agent_id ? [input.agent_id] : ['?']);
        for (const aid of agentIds) tracker.spawnedAgents.push(aid);
        const isParallel = toolName === 'sessions_spawn_parallel' && agentIds.length > 1;
        if (isParallel) {
          console.log(`  🔀 Spawn ∥ ${agentIds.join(' + ')}`);
        } else {
          console.log(`  🔀 Spawn → ${agentIds[0]}`);
        }
      } catch {
        console.log(`  🔀 Spawn`);
      }
      return;
    }

    // 记录工具调用
    if (!tracker.agentTools.has(agent)) tracker.agentTools.set(agent, new Map());
    const tools = tracker.agentTools.get(agent)!;
    tools.set(toolName, (tools.get(toolName) ?? 0) + 1);

    // 实时打印核心工具
    if (toolName.includes('generate_page')) {
      console.log(`  📄 ${shortTool(toolName)}`);
    } else if (toolName.includes('basic_config')) {
      console.log(`  ⚙️  ${shortTool(toolName)}`);
    } else if (toolName.includes('campaign_create')) {
      console.log(`  📋 ${shortTool(toolName)}`);
    }
  }

  if (event.type === 'tool_result') {
    const toolName = event.tool_name ?? '';

    // generate_page 完成 → 执行阶段结束
    if (toolName.includes('generate_page') && tracker.pageGenResultTs === null) {
      tracker.pageGenResultTs = now;
      if (tracker.firstToolCallTs) {
        const execMs = now - tracker.firstToolCallTs;
        console.log(`  📄 generate_page 完成，执行耗时: ${(execMs / 1000).toFixed(1)}s`);
      }
    }
  }

  if (event.type === 'error') {
    console.log(`  ❌ ${event.content}`);
  }

  if (event.type === 'done') {
    tracker.doneTs = now;
    // 打印本 session 的完整摘要
    printSessionSummary(tracker);
  }
}

/** 打印 session 完整链路摘要 */
function printSessionSummary(tracker: SessionTracker): void {
  const endTs = tracker.pageGenResultTs ?? tracker.doneTs ?? Date.now();
  const totalMs = endTs - tracker.startTs;
  const thinkMs = tracker.firstToolCallTs ? tracker.firstToolCallTs - tracker.startTs : 0;
  const execMs = tracker.firstToolCallTs ? endTs - tracker.firstToolCallTs : 0;

  const agents = tracker.spawnedAgents.length > 0
    ? [...new Set(tracker.spawnedAgents)].join(' → ')
    : '无';

  console.log(`  ─── 会话摘要 ───`);
  console.log(`  路由: ${agents}`);
  for (const [agent, tools] of tracker.agentTools) {
    const toolStr = [...tools].map(([t, c]) => c > 1 ? `${shortTool(t)}×${c}` : shortTool(t)).join(', ');
    console.log(`     ${agent}: ${toolStr}`);
  }
  console.log(`     耗时: 思考${fmtDuration(thinkMs)} + 执行${fmtDuration(execMs)} = ${fmtDuration(totalMs)}`);
  console.log('');
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ========== HTTP 代理服务器 ==========

/** 从请求体或 URL 提取 session_id */
function extractSessionId(req: IncomingMessage, body: string): string {
  // POST /api/v1/agent/chat/stream 的 body 里有 session_id
  try {
    const data = JSON.parse(body);
    if (data.session_id) return data.session_id;
  } catch { /* 不是 JSON 或解析失败 */ }
  // URL 参数兜底
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  return url.searchParams.get('session_id') ?? 'unknown';
}

/**
 * 启动代理服务器
 * @param proxyPort 代理监听端口
 * @param targetUrl 目标 agent-service 地址
 */
export function startProxy(proxyPort: number = DEFAULT_PROXY_PORT, targetUrl: string = AGENT_SERVICE_URL): Server {
  const target = new URL(targetUrl);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // 收集请求体
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const body = Buffer.concat(chunks).toString('utf-8');

    // 判断是否 SSE 流式请求
    const isSSE = req.url?.includes('/chat/stream');

    // 提取 session_id（用于事件分组）
    let sessionId = 'unknown';
    if (isSSE) {
      sessionId = extractSessionId(req, body);
    }

    // 构造转发请求
    const fwdHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue;
      // 跳过 hop-by-hop 头
      if (['host', 'connection', 'transfer-encoding'].includes(k.toLowerCase())) continue;
      fwdHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
    }
    fwdHeaders['host'] = target.host;

    const fwdPath = req.url ?? '/';
    const fwdUrl = `${target.origin}${fwdPath}`;

    try {
      const fwdRes = await fetch(fwdUrl, {
        method: req.method ?? 'GET',
        headers: fwdHeaders,
        body: ['GET', 'HEAD'].includes(req.method ?? '') ? undefined : body,
        redirect: 'manual',
      });

      // 转发状态码和头
      res.writeHead(fwdRes.status, Object.fromEntries(fwdRes.headers.entries()));

      if (isSSE && fwdRes.body) {
        // SSE 流：透传 + 偷看
        const reader = fwdRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 原样转发给客户端
            res.write(value);

            // 复制一份做分析
            buffer += decoder.decode(value, { stream: true });
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
                  handleEvent(sessionId, event);
                } catch {
                  // 非 JSON，跳过
                }
              }
            }
          }
        } catch (e) {
          // 客户端断开等
          if (!(e instanceof Error && e.name === 'AbortError')) {
            console.log(`  ⚠️ SSE 流异常: ${e instanceof Error ? e.message : e}`);
          }
        }

        res.end();
      } else {
        // 非 SSE：直接转发
        const responseBody = fwdRes.body ? Buffer.from(await fwdRes.arrayBuffer()) : null;
        if (responseBody) res.write(responseBody);
        res.end();
      }
    } catch (e) {
      console.log(`  ❌ 代理请求失败: ${e instanceof Error ? e.message : e}`);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Proxy error: cannot reach agent-service');
      }
    }
  });

  server.listen(proxyPort, () => {
    console.log(`🎧 SSE 代理已启动`);
    console.log(`   代理端口: :${proxyPort}`);
    console.log(`   转发目标: ${target.origin}`);
    console.log(`   使用方式: SkyWalker 前端连 http://localhost:${proxyPort}`);
    console.log('');
    console.log(`等待连接...`);
  });

  // 优雅关闭
  const cleanup = () => {
    console.log('\n🛑 代理关闭中...');
    // 打印所有未完成 session 的摘要
    for (const [, tracker] of sessions) {
      if (!tracker.doneTs) {
        printSessionSummary(tracker);
      }
    }
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return server;
}
