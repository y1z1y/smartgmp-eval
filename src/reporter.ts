/**
 * 报告生成器 — 终端输出 + JSON 报告文件
 */
import type { CaseResult, EvalReport } from './types.js';
import type { StageTiming } from './runner.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** 格式化毫秒为可读字符串 */
function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 简化工具名：mcp__smartgmp__new_generate_page → new_generate_page */
const shortTool = (t: string) => t.replace(/^mcp__\w+__/, '');

/**
 * 在终端输出评测报告
 */
export function printReport(report: EvalReport, allStages: StageTiming[][]): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            SkyWalker 评测报告                                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  for (let i = 0; i < report.results.length; i++) {
    const r = report.results[i];
    const name = r.testCase.name;
    const routeIcon = r.intent.routedCorrectly ? '✅' : '❌';
    const agents = r.intent.actualAgents.length > 0
      ? [...new Set(r.intent.actualAgents)].join(' → ')
      : '无';

    // 阶段耗时（补全未关闭的阶段）
    const stages = allStages[i] ?? [];
    const fixedStages = stages.map((s, idx) => {
      if (s.endTs <= s.startTs && idx < stages.length - 1) {
        return { ...s, endTs: stages[idx + 1].startTs };
      }
      return s;
    });
    const stageLine = fixedStages.length > 0
      ? fixedStages.map(s => {
          const dur = s.endTs > s.startTs ? fmtMs(s.endTs - s.startTs) : '...';
          return `${s.name} ${dur}`;
        }).join(' → ')
      : '';
    const durLine = r.duration ? `总计 ${fmtMs(r.duration.totalMs)}` : '';

    console.log(`║                                                              ║`);
    console.log(`║  ${name}${''.padEnd(55 - name.length)}║`);
    console.log(`║    ${routeIcon} ${agents}${''.padEnd(Math.max(0, 54 - agents.length - 4))}║`);
    if (stageLine) console.log(`║    ${stageLine}${''.padEnd(Math.max(0, 54 - stageLine.length))}║`);
    if (durLine) console.log(`║    ${durLine}${''.padEnd(Math.max(0, 54 - durLine.length))}║`);
  }

  console.log(`║                                                              ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');

  const summary = `路由正确 ${report.intentCorrectCount}/${report.totalCases} | 工具正确 ${report.toolCorrectCount}/${report.totalCases} | 平均耗时 ${fmtMs(report.avgTotalMs)}`;
  console.log(`║ ${summary}${''.padEnd(Math.max(0, 61 - summary.length))}║`);

  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * 保存 JSON 报告文件
 */
export async function saveJsonReport(report: EvalReport, outputDir: string): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const filename = `eval-${report.timestamp.replace(/[:.]/g, '-')}.json`;
  const filepath = join(outputDir, filename);

  // 精简版：去掉完整事件时间线，只保留关键信息
  const slimResults = report.results.map(r => {
    // 按 agent 分组统计工具
    const agentToolMap = new Map<string, Map<string, number>>();
    for (const te of r.events) {
      if (te.event.type !== 'tool_call') continue;
      const agent = te.event.agent ?? '?';
      const tool = te.event.tool_name ?? '';
      if (tool.startsWith('sessions_spawn')) continue;
      if (!agentToolMap.has(agent)) agentToolMap.set(agent, new Map());
      const tools = agentToolMap.get(agent)!;
      tools.set(tool, (tools.get(tool) ?? 0) + 1);
    }
    const agentTools = [...agentToolMap].map(([agent, tools]) => ({
      agent,
      tools: [...tools].map(([t, c]) => ({ name: shortTool(t), count: c })),
    }));

    return {
      id: r.testCase.id,
      name: r.testCase.name,
      prompt: r.testCase.prompt,
      routedAgents: [...new Set(r.intent.actualAgents)],
      agentTools,
      duration: r.duration
        ? {
            totalMs: r.duration.totalMs,
            intentMs: r.duration.intentMs,
            toolMs: r.duration.toolMs,
          }
        : null,
      quality: r.quality,
      codeQuality: r.codeQuality,
      timedOut: r.timedOut,
      error: r.error,
    };
  });

  const slimReport = {
    ...report,
    results: slimResults,
  };

  await writeFile(filepath, JSON.stringify(slimReport, null, 2), 'utf-8');
  return filepath;
}
