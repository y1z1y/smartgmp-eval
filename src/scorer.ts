/**
 * 评分器 — 意图识别、页面质量、端到端耗时三维度评分
 */
import type {
  TestCase,
  TimedEvent,
  IntentScore,
  DurationScore,
  DurationGrade,
  CaseResult,
  EvalReport,
} from './types.js';
import { checkPageQuality } from './preview-checker.js';
import type { RunResult } from './runner.js';

// ========== 意图识别评分 ==========

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
  'basic_config',             // 基础配置，页面生成前必须先调
  'activity_base_config',     // 活动基础配置
  'user_workspace_list',      // 查看工作区文件列表
  'user_workspace_add_dep',   // 安装依赖
  'user_workspace_git',       // git 操作
  'user_workspace_read_file', // 读取文件
  'pradox_cookie_save',       // cookie 存储
  'design_save_image_from_url', // 图片保存
  'image_upload',             // 图片上传
]);

/** 判断工具名是否属于白名单（支持全名匹配和后缀匹配） */
function isAuxiliaryTool(toolName: string): boolean {
  // 全名匹配
  if (AUXILIARY_TOOLS.has(toolName)) return true;
  // 后缀匹配：mcp__smartgmp__basic_config → 匹配 basic_config
  for (const aux of AUXILIARY_TOOLS) {
    if (toolName.endsWith(aux)) return true;
  }
  return false;
}

/**
 * 评估意图识别准确率
 */
export function scoreIntent(
  testCase: TestCase,
  events: TimedEvent[],
): IntentScore {
  // 收集所有 tool_call 事件
  const toolCalls = events.filter(e => e.event.type === 'tool_call');

  // 判断路由：看 spawn 了哪个 agent
  const spawnedAgents = toolCalls
    .filter(e => e.event.tool_name === 'sessions_spawn' || e.event.tool_name === 'sessions_spawn_parallel')
    .map(e => {
      try {
        const raw = e.event.tool_input ?? '{}';
        const input = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return input.agent_id ?? '';
      } catch {
        return '';
      }
    });

  // 判断实际调用的工具（排除 spawn 类）
  const actualTools = toolCalls
    .map(e => e.event.tool_name ?? '')
    .filter(name => name && !name.startsWith('sessions_spawn'));

  // 1. 路由评分（基于精确率 precision）
  const expectedAgents = INTENT_AGENT_MAP[testCase.expectedIntent] ?? ['orchestrator'];

  // 命中的期望 agent 数
  const agentHitCount = spawnedAgents.filter(a => expectedAgents.includes(a)).length;
  // 多余 agent：实际 spawn 的 - 命中的
  const redundantAgents = spawnedAgents.filter(a => !expectedAgents.includes(a));

  const routedCorrectly = agentHitCount > 0;
  // 精确率 = 命中数 / 实际 spawn 总数（没 spawn 任何 agent 则精确率为 0）
  const routePrecision = spawnedAgents.length > 0
    ? agentHitCount / spawnedAgents.length
    : 0;
  const routeScore = Math.round(routePrecision * 40);

  const actualAgent = spawnedAgents.length > 0
    ? spawnedAgents.join(', ')
    : '(未spawn)';

  // 2. 工具选择评分（基于精确率 precision）
  const expectedToolNames = testCase.expectedTools;

  // 命中的期望工具数
  const hitCount = expectedToolNames.filter(et =>
    actualTools.some(at => at === et || at.endsWith(et))
  ).length;

  // 多余工具：实际调用的 - 期望命中的 - 白名单辅助工具
  const redundantTools = actualTools.filter(at => {
    // 如果是期望工具的命中项，不算多余
    const isExpected = expectedToolNames.some(et => at === et || at.endsWith(et));
    if (isExpected) return false;
    // 如果是辅助工具，不算多余
    if (isAuxiliaryTool(at)) return false;
    return true;
  });

  // 精确率 = 命中的期望工具数 / (命中的期望工具数 + 多余工具数)
  // 没有调用任何工具时精确率为 0
  const toolPrecision = (hitCount + redundantTools.length) > 0
    ? hitCount / (hitCount + redundantTools.length)
    : 0;

  const toolSelectedCorrectly = hitCount > 0;
  const toolScore = Math.round(toolPrecision * 60);

  // 计算总分（路由精确率×40 + 工具精确率×60）
  const score = routeScore + toolScore;

  return {
    routedCorrectly,
    routePrecision,
    redundantAgents,
    actualAgent,
    toolSelectedCorrectly,
    toolPrecision,
    redundantTools,
    actualTools,
    score,
  };
}

// ========== 端到端耗时评分 ==========

/** 耗时阈值（ms） */
const TOTAL_THRESHOLDS: Record<DurationGrade, number> = {
  excellent: 60_000,
  good: 120_000,
  pass: 180_000,
  fail: Infinity,
};

const INTENT_THRESHOLDS: Record<DurationGrade, number> = {
  excellent: 10_000,
  good: 20_000,
  pass: 30_000,
  fail: Infinity,
};

function gradeDuration(ms: number, thresholds: Record<DurationGrade, number>): DurationGrade {
  if (ms <= thresholds.excellent) return 'excellent';
  if (ms <= thresholds.good) return 'good';
  if (ms <= thresholds.pass) return 'pass';
  return 'fail';
}

function gradeToScore(grade: DurationGrade): number {
  switch (grade) {
    case 'excellent': return 100;
    case 'good': return 75;
    case 'pass': return 50;
    case 'fail': return 0;
  }
}

/**
 * 评估端到端耗时
 */
export function scoreDuration(
  startTs: number,
  firstToolCallTs: number | null,
  doneTs: number | null,
  compileDoneTs: number | null,
): DurationScore {
  const totalMs = (doneTs ?? Date.now()) - startTs;
  const intentMs = firstToolCallTs ? firstToolCallTs - startTs : totalMs;
  const toolMs = firstToolCallTs && doneTs ? doneTs - firstToolCallTs : 0;
  const compileMs = compileDoneTs && doneTs ? compileDoneTs - doneTs : null;

  const totalGrade = gradeDuration(totalMs, TOTAL_THRESHOLDS);
  const intentGrade = gradeDuration(intentMs, INTENT_THRESHOLDS);

  // 总分 = 70% 总耗时 + 30% 意图耗时
  const score = Math.round(gradeToScore(totalGrade) * 0.7 + gradeToScore(intentGrade) * 0.3);

  return {
    totalMs,
    intentMs,
    toolMs,
    compileMs,
    totalGrade,
    intentGrade,
    score,
  };
}

// ========== 综合评分 ==========

/**
 * 对单个测试用例综合评分
 */
export async function scoreCase(
  testCase: TestCase,
  runResult: RunResult,
  codeRoot: string,
): Promise<CaseResult> {
  const { events, timedOut, error, firstToolCallTs, doneTs } = runResult;
  const startTs = events.length > 0 ? events[0].timestamp : Date.now();

  // 意图识别评分
  const intent = scoreIntent(testCase, events);

  // 页面质量评分（仅页面生成类）
  let quality: CaseResult['quality'] = null;
  let codeQuality: CaseResult['codeQuality'] = null;
  if (testCase.expectedIntent === 'page_generation' && !timedOut) {
    // 找 new_generate_page 的 tool_result
    const toolResults = events.filter(e => e.event.type === 'tool_result');
    const pageGenResult = toolResults.find(e => {
      try {
        // tool_result 可能以 __SKYWALKER_SUBAGENT_TASK_COMPLETE__ 开头，跳过找 JSON
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
      quality = {
        compilePassed: false,
        runtimeOk: null,
        componentsMatched: false,
        failedComponents: [],
        installCompleted: false,
        fileCompleteness: 0,
        missingFiles: REQUIRED_PAGE_FILES_LIST,
        score: 0,
      };
    }
  }

  // 端到端耗时评分
  let duration: CaseResult['duration'] = null;
  if (!timedOut) {
    duration = scoreDuration(startTs, firstToolCallTs, doneTs, null);
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

  const avgIntentScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.intent.score, 0) / results.length)
    : 0;

  const avgQualityScore = pageGenResults.length > 0 && pageGenResults.every(r => r.quality !== null)
    ? Math.round(pageGenResults.reduce((sum, r) => sum + (r.quality?.score ?? 0), 0) / pageGenResults.length)
    : 0;

  const avgCodeQualityScore = pageGenResults.length > 0 && pageGenResults.some(r => r.codeQuality !== null)
    ? Math.round(pageGenResults.reduce((sum, r) => sum + (r.codeQuality?.score ?? 0), 0) / pageGenResults.filter(r => r.codeQuality !== null).length)
    : 0;

  const avgTotalMs = pageGenResults.length > 0 && pageGenResults.every(r => r.duration !== null)
    ? Math.round(pageGenResults.reduce((sum, r) => sum + (r.duration?.totalMs ?? 0), 0) / pageGenResults.length)
    : 0;

  // 总体耗时等级
  let overallDurationGrade: DurationGrade = 'fail';
  if (avgTotalMs <= TOTAL_THRESHOLDS.excellent) overallDurationGrade = 'excellent';
  else if (avgTotalMs <= TOTAL_THRESHOLDS.good) overallDurationGrade = 'good';
  else if (avgTotalMs <= TOTAL_THRESHOLDS.pass) overallDurationGrade = 'pass';

  return {
    timestamp: new Date().toISOString(),
    totalCases: results.length,
    pageGenCases: pageGenResults.length,
    nonPageCases: nonPageResults.length,
    results,
    avgIntentScore,
    avgQualityScore,
    avgCodeQualityScore,
    avgTotalMs,
    overallDurationGrade,
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
