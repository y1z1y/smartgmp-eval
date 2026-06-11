/**
 * 调试：打印 new_generate_page 的 tool_result 完整内容
 */
import type { AgentStreamEvent } from './types.js';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000';

async function main() {
  const url = `${AGENT_SERVICE_URL}/api/v1/agent/chat/stream`;
  const body = {
    session_id: `debug-result-${Date.now()}`,
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

  if (!res.ok) { console.log('HTTP error', res.status); process.exit(1); }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let round = 0;
  const messages: Array<{ role: string; content: string }> = [{ role: 'user', content: body.messages[0].content }];

  while (round < 3) {
    const res2 = round === 0 ? res : await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: body.session_id,
        project_id: 'default',
        local_path: body.local_path,
        data_root: '~/.skywalker',
        messages,
      }),
    });

    const reader2 = round === 0 ? reader : res2.body!.getReader();
    buffer = '';
    let gotDone = false;

    while (!gotDone) {
      const { done, value } = await reader2.read();
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
            if (event.type === 'done') gotDone = true;

            // 只打印 new_generate_page 的 tool_result
            if (event.type === 'tool_result' && event.tool_name?.includes('new_generate_page')) {
              console.log('\n=== new_generate_page tool_result 完整内容 ===');
              const tr = event.tool_result ?? '';
              // 打印前200字符，看看开头是什么
              console.log('前200字符:', tr.slice(0, 200));
              console.log('是否以 { 开头:', tr.trimStart().startsWith('{'));
              // 尝试找 JSON 部分
              const jsonStart = tr.indexOf('{');
              console.log('第一个 { 的位置:', jsonStart);
              if (jsonStart >= 0) {
                try {
                  const data = JSON.parse(tr.slice(jsonStart));
                  console.log('pagePath:', data.pagePath);
                  console.log('pageDir:', data.pageDir);
                  console.log('installCompleted:', data.installCompleted);
                  console.log('components:', JSON.stringify(data.components, null, 2));
                } catch (e2) {
                  console.log('JSON解析失败:', e2);
                }
              }
            }
          } catch {}
        }
      }
    }

    // 检查是否需要第二轮（basic_config）
    round++;
    // 简化：只跑1轮看结果
    if (round >= 1) break;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
