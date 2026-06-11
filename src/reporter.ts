/**
 * 报告生成器 — 终端表格 + JSON 报告文件
 */
import type { CaseResult, EvalReport, DurationGrade } from './types.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** 耗时等级中文映射 */
const GRADE_LABEL: Record<DurationGrade, string> = {
  excellent: '优秀',
  good: '良好',
  pass: '及格',
  fail: '不及格',
};

/** 格式化毫秒为可读字符串 */
function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 百分比格式 */
function fmtPct(score: number): string {
  return `${score}%`;
}

/**
 * 在终端输出评测报告
 */
export function printReport(report: EvalReport): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            SkyWalker 页面生成评测报告                        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║ 评测时间: ${report.timestamp.padEnd(49)}║`);
  console.log(`║ 测试用例: ${report.totalCases} 个（页面生成 ${report.pageGenCases} / 非页面 ${report.nonPageCases}）${''.padEnd(20)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║                                                              ║');

  // 表头
  const header = '║  用例       │ 意图识别 │ 页面质量 │ 代码质量 │ 端到端耗时   │ 总体   ║';
  console.log(header);
  console.log('║  ───────────┼──────────┼──────────┼──────────┼──────────────┼──────── ║');

  for (const r of report.results) {
    const name = r.testCase.name.padEnd(8).slice(0, 8);
    const intent = r.timedOut ? '  超时  ' : fmtPct(r.intent.score).padStart(6) + '  ';
    const quality = r.quality === null ? '  N/A   ' : fmtPct(r.quality.score).padStart(6) + '  ';
    const codeQ = r.codeQuality === null ? '  N/A   ' : `${r.codeQuality.score}/50`.padStart(6) + '  ';
    const duration = r.duration === null
      ? '    N/A     '
      : `${GRADE_LABEL[r.duration.totalGrade]} ${fmtMs(r.duration.totalMs)}`.padStart(10) + '  ';
    const overall = r.timedOut ? '  0%  ' : calcOverall(r).padStart(4) + '  ';

    console.log(`║  ${name}│${intent}│${quality}│${codeQ}│${duration}│${overall}║`);
  }

  console.log('║                                                              ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  const summary = `║ 汇总: 意图识别 ${fmtPct(report.avgIntentScore)} | 页面质量 ${fmtPct(report.avgQualityScore)} | 代码质量 ${report.avgCodeQualityScore}/50 | 端到端 ${GRADE_LABEL[report.overallDurationGrade]}`;
  console.log(summary.padEnd(63) + '║');

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
  const slimResults = report.results.map(r => ({
    id: r.testCase.id,
    name: r.testCase.name,
    prompt: r.testCase.prompt,
    intent: r.intent,
    quality: r.quality,
    codeQuality: r.codeQuality,
    duration: r.duration
      ? {
          totalMs: r.duration.totalMs,
          intentMs: r.duration.intentMs,
          toolMs: r.duration.toolMs,
          totalGrade: r.duration.totalGrade,
          score: r.duration.score,
        }
      : null,
    timedOut: r.timedOut,
    error: r.error,
    eventCount: r.events.length,
    toolCalls: r.events
      .filter(e => e.event.type === 'tool_call')
      .map(e => ({ tool: e.event.tool_name, agent: e.event.agent, ts: e.timestamp })),
  }));

  const slimReport = {
    ...report,
    results: slimResults,
  };

  await writeFile(filepath, JSON.stringify(slimReport, null, 2), 'utf-8');
  return filepath;
}

/** 计算单用例总体分 */
function calcOverall(r: CaseResult): string {
  if (r.timedOut) return '0';
  const weights: number[] = [];
  const scores: number[] = [];

  weights.push(0.3); scores.push(r.intent.score);
  if (r.quality !== null) { weights.push(0.5); scores.push(r.quality.score); }
  if (r.duration !== null) { weights.push(0.2); scores.push(r.duration.score); }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedSum = weights.reduce((sum, w, i) => sum + w * scores[i], 0);
  return String(Math.round(weightedSum / totalWeight));
}
