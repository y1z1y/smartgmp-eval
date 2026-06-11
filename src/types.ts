/**
 * SkyWalker 页面生成评测工具 — 类型定义
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
  campaignId: string;
  bizId: string;
  env: string;
  simCluster: string;
  forceLogin: boolean;
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

/** 意图识别评分 */
export interface IntentScore {
  /** 路由是否正确（是否至少命中一个期望 agent） */
  routedCorrectly: boolean;
  /** 路由精确率 0-1（命中期望 agent 数 / 实际 spawn 总数） */
  routePrecision: number;
  /** 多余 agent 列表（spawn 了但不在期望列表中的） */
  redundantAgents: string[];
  /** 实际路由到的 agent */
  actualAgent: string;
  /** 工具选择是否正确（至少命中一个期望工具） */
  toolSelectedCorrectly: boolean;
  /** 工具精确率 0-1（命中期望工具数 / 命中+多余工具数） */
  toolPrecision: number;
  /** 多余工具列表（非期望、非白名单辅助工具） */
  redundantTools: string[];
  /** 实际调用的工具列表 */
  actualTools: string[];
  /** 总分 0-100（路由精确率×40 + 工具精确率×60） */
  score: number;
}

/** 代码质量评分（静态分析） */
export interface CodeQualityScore {
  /** 重复代码检测 0-15 */
  duplicateScore: number;
  /** 重复代码问题列表 */
  duplicateIssues: string[];
  /** TypeScript 类型安全 0-10 */
  typeSafetyScore: number;
  /** 类型安全问题列表 */
  typeSafetyIssues: string[];
  /** 代码规范 0-10 */
  codeStyleScore: number;
  /** 代码规范问题列表 */
  codeStyleIssues: string[];
  /** React 最佳实践 0-10 */
  reactPracticeScore: number;
  /** React 最佳实践问题列表 */
  reactPracticeIssues: string[];
  /** 可维护性 0-5 */
  maintainabilityScore: number;
  /** 可维护性问题列表 */
  maintainabilityIssues: string[];
  /** 总分 0-50 */
  score: number;
}

/** 页面质量评分 */
export interface QualityScore {
  /** 编译是否通过 */
  compilePassed: boolean;
  /** 运行时是否正常（可选检测） */
  runtimeOk: boolean | null; // null = 未检测
  /** 组件匹配是否成功 */
  componentsMatched: boolean;
  /** 匹配失败的组件 */
  failedComponents: string[];
  /** 依赖安装是否成功 */
  installCompleted: boolean;
  /** 文件完整性 0-1 */
  fileCompleteness: number;
  /** 缺失的文件 */
  missingFiles: string[];
  /** 总分 0-100 */
  score: number;
}

/** 耗时等级 */
export type DurationGrade = 'excellent' | 'good' | 'pass' | 'fail';

/** 端到端耗时评分 */
export interface DurationScore {
  /** 总耗时 ms */
  totalMs: number;
  /** 意图识别耗时 ms */
  intentMs: number;
  /** 工具执行耗时 ms */
  toolMs: number;
  /** 编译验证耗时 ms */
  compileMs: number | null;
  /** 各阶段等级 */
  totalGrade: DurationGrade;
  intentGrade: DurationGrade;
  /** 总分 0-100 */
  score: number;
}

/** 单个用例的完整评测结果 */
export interface CaseResult {
  testCase: TestCase;
  /** 事件时间线 */
  events: TimedEvent[];
  /** 意图识别评分 */
  intent: IntentScore;
  /** 页面质量评分（非页面类为 null） */
  quality: QualityScore | null;
  /** 代码质量评分（非页面类为 null） */
  codeQuality: CodeQualityScore | null;
  /** 端到端耗时评分 */
  duration: DurationScore | null;
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
  /** 意图识别平均分 */
  avgIntentScore: number;
  /** 页面质量平均分（仅页面生成类） */
  avgQualityScore: number;
  /** 代码质量平均分（仅页面生成类） */
  avgCodeQualityScore: number;
  /** 平均总耗时 ms（仅页面生成类） */
  avgTotalMs: number;
  /** 总体耗时等级 */
  overallDurationGrade: DurationGrade;
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
