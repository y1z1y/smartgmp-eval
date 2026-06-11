/**
 * 调试脚本：查看 agent-service SSE 事件流中 question 事件的实际格式
 */
import type { AgentStreamEvent } from './types.js';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000';

async function main() {
  const url = `${AGENT_SERVICE_URL}/api/v1/agent/chat/stream`;
  const body = {
    session_id: `debug-question-${Date.now()}`,
    project_id: 'default',
    local_path: process.env.HOME + '/.skywalker/eval-project',
    data_root: '~/.skywalker',
    messages: [{ role: 'user', content: '帮我创建一个骑行返现的活动营销页' }],
  };

  console.log('Sending request...');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.log('HTTP error', res.status);
    process.exit(1);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const eventTypes: Array<Record<string, unknown>> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6);
        if (!jsonStr.trim()) continue;
        try {
          const event: AgentStreamEvent = JSON.parse(jsonStr);
          // 过滤掉高频事件，只看关键事件
          if (event.type !== 'response_delta' && event.type !== 'reasoning_delta') {
            const summary: Record<string, unknown> = {
              type: event.type,
              agent: event.agent ?? undefined,
            };
            if (event.tool_name) summary.tool_name = event.tool_name;
            // 打印 tool_result 的完整内容（这是检测 PENDING_INPUT 的关键）
            if (event.type === 'tool_result') {
              summary.all_keys = Object.keys(event);
              const tr = event.tool_result ?? '';
              summary.tool_result_preview = tr.length > 200 ? tr.slice(0, 200) + '...' : tr;
              summary.has_pending_marker = tr.includes('__SKYWALKER_PENDING_USER_INPUT__');
            }
            eventTypes.push(summary);
          }
        } catch {
          // skip
        }
      }
    }

    // 收到 done 就停
    if (eventTypes.some(e => e.type === 'done')) break;
  }

  console.log('\n=== 事件类型序列 ===');
  console.log(JSON.stringify(eventTypes, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
