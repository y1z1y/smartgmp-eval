/**
 * 预览检查器 — 调 smartgmp-preview API 检查页面质量
 *
 * 5 个评分维度（总分100）：
 *  1. 预览可访问      40分  — 页面真的能在浏览器打开
 *  2. 编译无错误      15分  — Vite 编译层面无语法/类型错误
 *  3. 组件匹配准确率   25分  — AI 选的组件是不是用户要的
 *  4. 组件匹配无报错   10分  — 匹配过程有没有组件找不着
 *  5. 依赖安装成功    10分  — pnpm install 是否成功
 */
import type { PreviewPagesResponse, PageCompileError, QualityScore } from './types.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkCodeQuality } from './code-quality.js';

/** preview server 地址 */
const PREVIEW_URL = process.env.PREVIEW_URL ?? 'http://localhost:15174';

/**
 * 检查 preview server 是否可用
 */
export async function isPreviewServerAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${PREVIEW_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 绑定 preview server 到指定项目目录
 */
export async function setPreviewProject(codeRoot: string): Promise<boolean> {
  try {
    const res = await fetch(`${PREVIEW_URL}/api/preview/set-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: codeRoot }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 获取当前项目的页面列表和编译错误
 */
export async function getPreviewPages(): Promise<PreviewPagesResponse | null> {
  try {
    const res = await fetch(`${PREVIEW_URL}/api/preview/pages`);
    if (!res.ok) return null;
    return (await res.json()) as PreviewPagesResponse;
  } catch {
    return null;
  }
}

/**
 * 等待编译完成（轮询 preview server 直到编译错误清除或超时）
 */
export async function waitForCompile(
  pageId: string,
  maxWaitMs: number = 30000,
  intervalMs: number = 2000,
): Promise<Record<string, PageCompileError>> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const data = await getPreviewPages();
    if (data) {
      const pageErrors = data.errors ?? {};
      if (!pageErrors[pageId]) {
        return pageErrors;
      }
    }
    await sleep(intervalMs);
  }
  const data = await getPreviewPages();
  return data?.errors ?? { [pageId]: { message: '编译超时', file: 'unknown' } };
}

/**
 * 检查页面预览是否可访问 — fetch 页面 URL 检查 HTTP 200
 */
export async function checkPreviewAccessible(pageId: string): Promise<boolean> {
  try {
    const res = await fetch(`${PREVIEW_URL}/pages/${pageId}`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 从 new_generate_page 的 tool_result 中提取页面信息
 */
export function extractPageInfoFromToolResult(toolResult: string): {
  pagePath: string | null;
  pageDir: string | null;
  installCompleted: boolean;
  components: Array<{ id: string; dirName?: string; error?: string }>;
  codeRoot: string | null;
} {
  try {
    const jsonStart = toolResult.indexOf('{');
    if (jsonStart < 0) {
      return { pagePath: null, pageDir: null, installCompleted: false, components: [], codeRoot: null };
    }
    const data = JSON.parse(toolResult.slice(jsonStart));
    return {
      pagePath: data.pagePath ?? null,
      pageDir: data.pageDir ?? null,
      installCompleted: data.installCompleted ?? false,
      components: (data.components ?? []).map((c: Record<string, unknown>) => ({
        id: c.id ?? c.dirName ?? 'unknown',
        dirName: c.dirName as string | undefined,
        error: c.error as string | undefined,
      })),
      codeRoot: data.codeRoot ?? null,
    };
  } catch {
    return { pagePath: null, pageDir: null, installCompleted: false, components: [], codeRoot: null };
  }
}

/**
 * 解析真实的项目根目录
 * 从 pageDir 绝对路径反推：pageDir = projectRoot/src/pages/<slug> 或 projectRoot/code/src/pages/<slug>
 */
export function resolveProjectRoot(baseCodeRoot: string, info: ReturnType<typeof extractPageInfoFromToolResult>): string {
  // 优先从 pageDir 反推（最准确，是 new_generate_page 实际写入的路径）
  if (info.pageDir) {
    // pageDir 格式: /xxx/project/src/pages/cycling-cashback
    // 或: /xxx/project/code/src/pages/cycling-cashback
    const pagesIndex = info.pageDir.indexOf('/src/pages/');
    if (pagesIndex > 0) {
      // /src/pages/ 前面就是项目根
      return info.pageDir.slice(0, pagesIndex);
    }
    // 也可能是 /code/src/pages/
    const codePagesIndex = info.pageDir.indexOf('/code/src/pages/');
    if (codePagesIndex > 0) {
      // /code/src/pages/ 前面的 /code 算项目根（SkyWalker 的 code 布局）
      return info.pageDir.slice(0, codePagesIndex + 5); // 包含 /code
    }
  }

  // 其次用 tool_result 返回的 codeRoot
  if (info.codeRoot) {
    if (existsSync(join(info.codeRoot, 'src', 'pages'))) return info.codeRoot;
    if (existsSync(join(info.codeRoot, 'code', 'src', 'pages'))) return join(info.codeRoot, 'code');
  }

  // 最后兜底用 baseCodeRoot
  if (existsSync(join(baseCodeRoot, 'src', 'pages'))) return baseCodeRoot;
  if (existsSync(join(baseCodeRoot, 'code', 'src', 'pages'))) return join(baseCodeRoot, 'code');
  return baseCodeRoot;
}

/**
 * 检查组件匹配准确率（匹配到的组件是否包含用户期望的组件）
 */
export function checkComponentAccuracy(
  matchedComponents: Array<{ id: string; dirName?: string; error?: string }>,
  expectedComponents: string[],
): { accuracy: number; matchedExpected: string[]; missingExpected: string[] } {
  const matchedIds = matchedComponents
    .filter(c => !c.error)
    .map(c => (c.id ?? c.dirName ?? '').toLowerCase());

  const matchedExpected: string[] = [];
  const missingExpected: string[] = [];

  for (const ec of expectedComponents) {
    const ecLower = ec.toLowerCase();
    if (matchedIds.some(m => m.includes(ecLower) || ecLower.includes(m))) {
      matchedExpected.push(ec);
    } else {
      missingExpected.push(ec);
    }
  }

  const accuracy = expectedComponents.length > 0
    ? matchedExpected.length / expectedComponents.length
    : 1;
  return { accuracy, matchedExpected, missingExpected };
}

/**
 * 综合检查页面质量
 *
 * 评分维度（总分100）：
 *  1. 预览可访问      40分  — 页面真的能在浏览器打开
 *  2. 编译无错误      15分  — Vite 编译层面无语法/类型错误
 *  3. 组件匹配准确率   25分  — AI 选的组件是不是用户要的
 *  4. 组件匹配无报错   10分  — 匹配过程有没有组件找不着
 *  5. 依赖安装成功    10分  — pnpm install 是否成功
 */
export async function checkPageQuality(
  codeRoot: string,
  toolResult: string,
  expectedComponents: string[],
): Promise<QualityScore & { codeQuality: import('./types.js').CodeQualityScore }> {
  const info = extractPageInfoFromToolResult(toolResult);
  const projectRoot = resolveProjectRoot(codeRoot, info);

  console.log(`  [quality] 项目根目录: ${projectRoot}`);
  console.log(`  [quality] pagePath=${info.pagePath}, pageDir=${info.pageDir}, installCompleted=${info.installCompleted}, components=${info.components.length}个`);

  const pageId = info.pagePath ? info.pagePath.replace(/^\/pages\//, '') : null;

  // 1. 预览可访问（40分）
  // 先绑定项目到 preview server，绑定失败说明项目不完整（没 node_modules 等）
  let previewBound = false;
  let previewAccessible = false;
  if (pageId && projectRoot) {
    previewBound = await setPreviewProject(projectRoot);
    if (previewBound) {
      previewAccessible = await checkPreviewAccessible(pageId);
    }
  }
  if (!previewBound) {
    console.log(`  [quality] 预览可访问: ❌ +0 (preview server 绑定项目失败，可能缺少 node_modules)`);
  } else {
    console.log(`  [quality] 预览可访问: ${previewAccessible ? '✅ +40' : '❌ +0'}`);
  }

  // 2. 编译无错误（15分）
  // 只在项目成功绑定到 preview server 时才检查，否则查的是旧项目的缓存
  let compilePassed = false;
  if (pageId && previewBound) {
    const errors = await waitForCompile(pageId);
    compilePassed = !errors[pageId];
    console.log(`  [quality] 编译无错误: ${compilePassed ? '✅ +15' : '❌ +0'}`);
  } else {
    console.log(`  [quality] 编译无错误: ❌ +0 (项目未绑定 preview server，无法检查)`);
  }

  // 3. 组件匹配准确率（25分）
  const compAccuracy = checkComponentAccuracy(info.components, expectedComponents);
  const accuracyScore = Math.round(compAccuracy.accuracy * 25);
  console.log(`  [quality] 组件准确率: ${Math.round(compAccuracy.accuracy * 100)}% +${accuracyScore} (匹配: ${compAccuracy.matchedExpected.join(',') || '无'}, 缺失: ${compAccuracy.missingExpected.join(',') || '无'})`);

  // 4. 组件匹配无报错（10分）
  const failedComponents = info.components
    .filter(c => c.error)
    .map(c => c.id);
  const componentsMatched = failedComponents.length === 0 && info.components.length > 0;
  console.log(`  [quality] 组件无报错: ${componentsMatched ? '✅ +10' : '❌ +0'} (失败: ${failedComponents.join(',') || '无'})`);

  // 5. 依赖安装成功（10分）
  // 不看 tool_result.installCompleted（pnpm 在 smartgmp-mcp 进程里装不上 @didi 内网包）
  // 直接检查磁盘：node_modules 存在 + @didi 包存在 = 依赖安装成功
  const hasNm = existsSync(join(projectRoot, 'node_modules'));
  const hasDidi = existsSync(join(projectRoot, 'node_modules', '@didi'));
  const installCompleted = hasNm && hasDidi;
  console.log(`  [quality] 依赖安装: ${installCompleted ? '✅ +10' : '❌ +0'} (node_modules=${hasNm}, @didi=${hasDidi})`);

  // 计算总分
  let score = 0;
  if (previewAccessible) score += 40;
  if (compilePassed) score += 15;
  score += accuracyScore;
  if (componentsMatched) score += 10;
  if (installCompleted) score += 10;

  console.log(`  [quality] 总分: ${score}/100`);

  // 6. 代码质量静态分析（50分，独立维度）
  const codeQuality = checkCodeQuality(projectRoot, info.pageDir);

  return {
    compilePassed,
    runtimeOk: null,
    componentsMatched,
    failedComponents,
    installCompleted,
    fileCompleteness: compAccuracy.accuracy, // 复用：准确率即"匹配完整度"
    missingFiles: compAccuracy.missingExpected, // 复用：缺失的期望组件
    score,
    codeQuality,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
