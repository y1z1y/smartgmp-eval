/**
 * 分析器 — 调用链路分析 + 阶段耗时记录
 *
 * 不打分，只记录事实：
 * - 路由到哪个 agent、是否正确、有无多余
 * - 调了哪些工具、是否正确、有无多余
 * - 各阶段耗时
 */
import type {
  TestCase,
  TimedEvent,
  IntentAnalysis,
  DurationBreakdown,
  CaseResult,
  EvalReport,
} from './types.js';
import { checkPageQuality } from './preview-checker.js';
import type { RunResult } from './runner.js';

// ========== 意图识别链路分析 ==========

/**
 * 意图类型到期望 agent 的映射
 * 页面生成类应路由到 gmp-dev-agent（通过 ops-agent 中转也算正确）
 * 其他类应留在 orchestrator 处理
 */
const INTENT_AGENT_MAP: Record<string, string[]> = {
  page_generation: ['gmp-dev-agent', 'ops-agent'],
  campaign_query: ['orchestrator'],
  copy_generation: ['orchestrator', 'ops-agent'],
  campaign_update: ['ops-agent', 'orchestrator'],
  review_operation: ['ops-agent', 'orchestrator'],
};

/**
 * 流程辅助工具白名单 — 这些工具是正常流程中必需的，不计入多余调用
 */
const AUXILIARY_TOOLS: Set<string> = new Set([
  'basic_config',
  'activity_base_config',
  'user_workspace_list',
  'user_workspace_add_dep',
  'user_workspace_git',
  'user_workspace_read_file',
  'pradox_cookie_save',
  'design_save_image_from_url',
  'image_upload',
]);

/** 判断工具名是否属于白名单（支持全名匹配和后缀匹配） */
function isAuxiliaryTool(toolName: string): boolean {
  if (AUXILIARY_TOOLS.has(toolName)) return true;
  for (const aux of AUXILIARY_TOOLS) {
    if (toolName.endsWith(aux)) return true;
  }
  return false;
}

/**
 * 分析意图识别链路
 */
export function analyzeIntent(
  testCase: TestCase,
  events: TimedEvent[],
): IntentAnalysis {
  const toolCalls = events.filter(e => e.event.type === 'tool_call');

  const spawnedAgents = toolCalls
    .filter(e => e.event.tool_name === 'sessions_spawn' || e.event.tool_name === 'sessions_spawn_parallel')
    .flatMap(e => {
      try {
        const raw = e.event.tool_input ?? '{}';
        const input = typeof raw === 'string' ? JSON.parse(raw) : raw;
        // 支持单个 agent_id 或多个 agent_ids
        const ids: string[] = input.agent_ids ?? (input.agent_id ? [input.agent_id] : []);
        return ids.length > 0 ? ids : (input.agent_id ? [input.agent_id] : []);
      } catch {
        return [];
      }
    })
    .filter(Boolean);

  const actualTools = toolCalls
    .map(e => e.event.tool_name ?? '')
    .filter(name => name && !name.startsWith('sessions_spawn'));

  // 1. 路由分析
  const expectedAgents = INTENT_AGENT_MAP[testCase.expectedIntent] ?? ['orchestrator'];
  const agentHitCount = spawnedAgents.filter(a => expectedAgents.includes(a)).length;
  const redundantAgents = spawnedAgents.filter(a => !expectedAgents.includes(a));
  const routedCorrectly = agentHitCount > 0;

  // 2. 工具选择分析
  const expectedToolNames = testCase.expectedTools;
  const hitCount = expectedToolNames.filter(et =>
    actualTools.some(at => at === et || at.endsWith(et))
  ).length;

  const redundantTools = actualTools.filter(at => {
    const isExpected = expectedToolNames.some(et => at === et || at.endsWith(et));
    if (isExpected) return false;
    if (isAuxiliaryTool(at)) return false;
    return true;
  });

  const toolSelectedCorrectly = hitCount > 0;

  return {
    routedCorrectly,
    redundantAgents,
    actualAgents: spawnedAgents,
    toolSelectedCorrectly,
    redundantTools,
    actualTools,
  };
}

// ========== 阶段耗时记录 ==========

/**
 * 计算阶段耗时
 */
export function computeDuration(
  startTs: number,
  firstToolCallTs: number | null,
  doneTs: number | null,
  pageGenResultTs: number | null,
): DurationBreakdown {
  const endTs = pageGenResultTs ?? doneTs ?? Date.now();
  const totalMs = endTs - startTs;
  const intentMs = firstToolCallTs ? firstToolCallTs - startTs : totalMs;
  const toolMs = firstToolCallTs ? endTs - firstToolCallTs : 0;

  return { totalMs, intentMs, toolMs, compileMs: null };
}

// ========== 综合分析 ==========

/**
 * 对单个测试用例做综合分析
 */
export async function analyzeCase(
  testCase: TestCase,
  runResult: RunResult,
  codeRoot: string,
): Promise<CaseResult> {
  const { events, timedOut, error, firstToolCallTs, doneTs, pageGenResultTs } = runResult;
  const startTs = events.length > 0 ? events[0].timestamp : Date.now();

  // 意图识别链路分析
  const intent = analyzeIntent(testCase, events);

  // 页面质量检测（仅页面生成类）
  let quality: CaseResult['quality'] = null;
  let codeQuality: CaseResult['codeQuality'] = null;
  if (testCase.expectedIntent === 'page_generation' && !timedOut) {
    // 找 new_generate_page 的 tool_result
    const toolResults = events.filter(e => e.event.type === 'tool_result');
    const pageGenResult = toolResults.find(e => {
      try {
        const tr = e.event.tool_result ?? '';
        const jsonStart = tr.indexOf('{');
        if (jsonStart < 0) return false;
        const result = JSON.parse(tr.slice(jsonStart));
        return result.mode === 'import-auto' || result.pagePath;
      } catch {
        return false;
      }
    });

    if (pageGenResult?.event.tool_result) {
      const qualityResult = await checkPageQuality(codeRoot, pageGenResult.event.tool_result, testCase.expectedComponents);
      quality = qualityResult;
      codeQuality = qualityResult.codeQuality;
    } else {
      // 没找到 generate_page 的 tool_result，从磁盘检查
      const diskResult = await checkPageQualityFromDisk(codeRoot, testCase.expectedComponents);
      quality = diskResult;
      codeQuality = null;
    }
  }

  // 阶段耗时
  let duration: CaseResult['duration'] = null;
  if (!timedOut) {
    duration = computeDuration(startTs, firstToolCallTs, doneTs, pageGenResultTs);
  }

  return {
    testCase,
    events,
    intent,
    quality,
    codeQuality,
    duration,
    timedOut,
    error,
  };
}

/**
 * 生成汇总报告
 */
export function generateReport(results: CaseResult[]): EvalReport {
  const pageGenResults = results.filter(r => r.testCase.expectedIntent === 'page_generation');
  const nonPageResults = results.filter(r => r.testCase.expectedIntent !== 'page_generation');

  const avgTotalMs = pageGenResults.length > 0 && pageGenResults.every(r => r.duration !== null)
    ? Math.round(pageGenResults.reduce((sum, r) => sum + (r.duration?.totalMs ?? 0), 0) / pageGenResults.length)
    : 0;

  const intentCorrectCount = results.filter(r => r.intent.routedCorrectly).length;
  const toolCorrectCount = results.filter(r => r.intent.toolSelectedCorrectly).length;

  return {
    timestamp: new Date().toISOString(),
    totalCases: results.length,
    pageGenCases: pageGenResults.length,
    nonPageCases: nonPageResults.length,
    results,
    avgTotalMs,
    intentCorrectCount,
    toolCorrectCount,
  };
}

// ========== 工具函数 ==========

const REQUIRED_PAGE_FILES_LIST = [
  'index.tsx',
  'sdk-setup.ts',
  'app-bootstrap.tsx',
  'page-component-props.ts',
  'page-stage.css',
];

/**
 * 从磁盘检查页面质量（当 generate_page tool_result 找不到时的兜底）
 * 不依赖 tool_result，直接扫描文件系统 + preview server 编译检查
 */
async function checkPageQualityFromDisk(
  codeRoot: string,
  expectedComponents: string[],
): Promise<import('./types.js').QualityResult> {
  const { existsSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { resolveCodeRoot, setPreviewProject, waitForCompile } = await import('./preview-checker.js');

  const codeDir = resolveCodeRoot(codeRoot, {
    pagePath: null,
    pageDir: null,
    installCompleted: false,
    components: [],
    codeRoot: null,
  });

  // 依赖检查
  // 如果没有 node_modules，尝试 pnpm install
  let hasNm = existsSync(join(codeDir, 'node_modules'));
  let hasDidi = existsSync(join(codeDir, 'node_modules', '@didi'));
  if (!hasNm && existsSync(join(codeDir, 'package.json'))) {
    console.log(`  📦 补装依赖...`);
    try {
      const { execSync } = await import('node:child_process');
      execSync('pnpm install --no-frozen-lockfile --ignore-scripts --ignore-workspace', {
        cwd: codeDir,
        timeout: 180_000,
        stdio: 'pipe',
      });
      hasNm = existsSync(join(codeDir, 'node_modules'));
      hasDidi = existsSync(join(codeDir, 'node_modules', '@didi'));
    } catch (e) {
      console.log(`  ⚠️ 补装依赖失败: ${e instanceof Error ? e.message : e}`);
    }
  }
  const installCompleted = hasNm && hasDidi;

  // 检查 src/pages 下有没有生成的页面
  const pagesDir = join(codeDir, 'src', 'pages');
  let pageDirs: string[] = [];
  try {
    pageDirs = readdirSync(pagesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch { /* pages 目录不存在 */ }

  const hasPages = pageDirs.length > 0;

  // 文件完整性
  const missingFiles: string[] = [];
  if (hasPages) {
    const firstPageDir = join(pagesDir, pageDirs[0]);
    for (const file of REQUIRED_PAGE_FILES_LIST) {
      if (!existsSync(join(firstPageDir, file))) {
        missingFiles.push(file);
      }
    }
  }

  // 编译检查：绑定 preview server，查看编译错误
  let compilePassed: boolean | null = null;
  if (hasPages) {
    const previewBound = await setPreviewProject(codeDir);
    if (previewBound) {
      const pageId = pageDirs[0];
      const errors = await waitForCompile(pageId);
      compilePassed = !errors[pageId];
    } else {
      compilePassed = false;
    }
  } else {
    compilePassed = null;
  }

  return {
    compilePassed,
    runtimeOk: null,
    componentsMatched: false,
    failedComponents: [],
    matchedComponents: [],
    missingComponents: expectedComponents,
    installCompleted,
    missingFiles: hasPages ? missingFiles : REQUIRED_PAGE_FILES_LIST,
  };
}
