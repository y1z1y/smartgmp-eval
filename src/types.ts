/**
 * SkyWalker 页面生成评测工具 — 类型定义
 *
 * 重心：调用链路分析 + 阶段耗时
 * 不做打分，只记录事实
 */

// ========== SSE 事件类型（来自 agent-service） ==========

/** agent-service 返回的 SSE 事件 */
export interface AgentStreamEvent {
  type: string;
  content?: string;
  agent?: string;
  tool_name?: string;
  tool_input?: string;
  tool_result?: string;
  message_id?: string;
  options?: unknown[];
  fields?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

/** 带时间戳的事件记录 */
export interface TimedEvent {
  timestamp: number; // Date.now()
  event: AgentStreamEvent;
}

// ========== 测试用例 ==========

export type IntentType = 'page_generation' | 'campaign_query' | 'copy_generation' | 'campaign_update' | 'review_operation';

/** basic_config 表单配置 */
export interface BasicConfig {
  bizId: string;
  forceLogin: boolean;
  env: string;
  bEnv: string;
  cEnv: string;
  simCluster: string;
}

/** 测试用例定义 */
export interface TestCase {
  id: string;
  name: string;
  prompt: string;
  /** 期望的意图类型 */
  expectedIntent: IntentType;
  /** 期望调用的工具列表（按优先级排序） */
  expectedTools: string[];
  /** 期望匹配的组件 ID（仅页面生成类） */
  expectedComponents: string[];
  /** 超时时间 ms */
  timeoutMs: number;
  /** basic_config 表单的真实参数 */
  basicConfig: BasicConfig;
}

// ========== 评测结果 ==========

/** 意图识别分析结果（不打分，只记录链路事实） */
export interface IntentAnalysis {
  /** 路由是否正确（是否命中期望 agent） */
  routedCorrectly: boolean;
  /** 多余 agent 列表（spawn 了但不在期望列表中的） */
  redundantAgents: string[];
  /** 实际路由到的 agent 链 */
  actualAgents: string[];
  /** 工具选择是否正确（至少命中一个期望工具） */
  toolSelectedCorrectly: boolean;
  /** 多余工具列表（非期望、非白名单辅助工具） */
  redundantTools: string[];
  /** 实际调用的工具链 */
  actualTools: string[];
}

/** 代码质量分析（静态分析，不打分） */
export interface CodeQualityAnalysis {
  /** 重复代码问题列表 */
  duplicateIssues: string[];
  /** 类型安全问题列表 */
  typeSafetyIssues: string[];
  /** 代码规范问题列表 */
  codeStyleIssues: string[];
  /** React 最佳实践问题列表 */
  reactPracticeIssues: string[];
  /** 可维护性问题列表 */
  maintainabilityIssues: string[];
}

/** 页面质量检测结果（不打分，只记录检测事实） */
export interface QualityResult {
  /** 编译是否通过（null = 未检测，页面没生成时无法检查编译） */
  compilePassed: boolean | null;
  /** 运行时是否正常（可选检测） */
  runtimeOk: boolean | null; // null = 未检测
  /** 组件是否全部匹配 */
  componentsMatched: boolean;
  /** 匹配失败的组件 */
  failedComponents: string[];
  /** 匹配到的期望组件 */
  matchedComponents: string[];
  /** 缺失的期望组件 */
  missingComponents: string[];
  /** 依赖安装是否成功 */
  installCompleted: boolean;
  /** 缺失的文件 */
  missingFiles: string[];
}

/** 阶段耗时记录（不打分，只记录时间） */
export interface DurationBreakdown {
  /** 总耗时 ms */
  totalMs: number;
  /** 意图识别阶段耗时 ms（从开始到首次 tool_call） */
  intentMs: number;
  /** 工具执行阶段耗时 ms（从首次 tool_call 到 generate_page tool_result） */
  toolMs: number;
  /** 编译验证耗时 ms（可选） */
  compileMs: number | null;
}

/** 单个用例的完整评测结果 */
export interface CaseResult {
  testCase: TestCase;
  /** 事件时间线 */
  events: TimedEvent[];
  /** 意图识别链路分析 */
  intent: IntentAnalysis;
  /** 页面质量检测结果（非页面类为 null） */
  quality: QualityResult | null;
  /** 代码质量分析（非页面类为 null） */
  codeQuality: CodeQualityAnalysis | null;
  /** 阶段耗时 */
  duration: DurationBreakdown | null;
  /** 是否超时 */
  timedOut: boolean;
  /** 错误信息 */
  error: string | null;
}

/** 评测汇总报告 */
export interface EvalReport {
  /** 评测时间 ISO string */
  timestamp: string;
  /** 测试用例总数 */
  totalCases: number;
  /** 页面生成类用例数 */
  pageGenCases: number;
  /** 非页面类用例数 */
  nonPageCases: number;
  /** 各用例结果 */
  results: CaseResult[];
  /** 平均总耗时 ms */
  avgTotalMs: number;
  /** 意图识别正确的用例数 */
  intentCorrectCount: number;
  /** 工具选择正确的用例数 */
  toolCorrectCount: number;
}

// ========== Preview Server API ==========

/** preview server 返回的页面信息 */
export interface PreviewPageInfo {
  id: string;
  path: string;
}

/** preview server 编译错误 */
export interface PageCompileError {
  message: string;
  file: string;
  line?: number;
  column?: number;
}

/** GET /api/preview/pages 响应 */
export interface PreviewPagesResponse {
  project: string;
  pages: PreviewPageInfo[];
  cdnPages: PreviewPageInfo[];
  reloadGeneration: number;
  errors: Record<string, PageCompileError>;
}
