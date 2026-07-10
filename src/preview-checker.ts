/**
 * 预览检查器 — 调 smartgmp-preview API 检查页面质量
 *
 * 不打分，只检测事实：
 *  1. 预览是否可访问
 *  2. 编译是否有错误
 *  3. 组件匹配了哪些、缺了哪些
 *  4. 依赖安装是否成功
 *  5. 代码质量问题（静态分析）
 */
import type { PreviewPagesResponse, PageCompileError, QualityResult } from './types.js';
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
 * 检查页面预览是否可访问
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
 * 解析代码目录（node_modules 所在的目录）
 * SkyWalker 项目布局：projectRoot/code/ 才是放代码和依赖的地方
 */
export function resolveCodeRoot(baseCodeRoot: string, info: ReturnType<typeof extractPageInfoFromToolResult>): string {
  // 优先从 pageDir 反推
  if (info.pageDir) {
    const pagesIndex = info.pageDir.indexOf('/src/pages/');
    if (pagesIndex > 0) {
      return info.pageDir.slice(0, pagesIndex);
    }
    const codePagesIndex = info.pageDir.indexOf('/code/src/pages/');
    if (codePagesIndex > 0) {
      return info.pageDir.slice(0, codePagesIndex + 5); // 包含 /code
    }
  }

  // 从 codeRoot 推断
  if (info.codeRoot) {
    if (existsSync(join(info.codeRoot, 'node_modules'))) return info.codeRoot;
    if (existsSync(join(info.codeRoot, 'code', 'node_modules'))) return join(info.codeRoot, 'code');
  }

  // 兜底：baseCodeRoot 下的 code/ 子目录
  if (existsSync(join(baseCodeRoot, 'code', 'node_modules'))) return join(baseCodeRoot, 'code');
  if (existsSync(join(baseCodeRoot, 'node_modules'))) return baseCodeRoot;
  // 最后兜底：code/ 子目录存在就用它
  if (existsSync(join(baseCodeRoot, 'code'))) return join(baseCodeRoot, 'code');
  return baseCodeRoot;
}

/**
 * 检查组件匹配情况
 */
export function checkComponentAccuracy(
  matchedComponents: Array<{ id: string; dirName?: string; error?: string }>,
  expectedComponents: string[],
): { matchedExpected: string[]; missingExpected: string[] } {
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

  return { matchedExpected, missingExpected };
}

/**
 * 综合检查页面质量（不打分，只记录检测结果）
 */
export async function checkPageQuality(
  codeRoot: string,
  toolResult: string,
  expectedComponents: string[],
): Promise<QualityResult & { codeQuality: import('./types.js').CodeQualityAnalysis }> {
  const info = extractPageInfoFromToolResult(toolResult);
  const codeDir = resolveCodeRoot(codeRoot, info);

  const pageId = info.pagePath ? info.pagePath.replace(/^\/pages\//, '') : null;

  // 1. 预览可访问
  let previewBound = false;
  let previewAccessible = false;
  if (pageId && codeDir) {
    previewBound = await setPreviewProject(codeDir);
    if (previewBound) {
      previewAccessible = await checkPreviewAccessible(pageId);
    }
  }

  // 2. 编译检查
  let compilePassed = false;
  if (pageId && previewBound) {
    const errors = await waitForCompile(pageId);
    compilePassed = !errors[pageId];
  }

  // 3. 组件匹配
  const compAccuracy = checkComponentAccuracy(info.components, expectedComponents);

  // 4. 组件报错
  const failedComponents = info.components
    .filter(c => c.error)
    .map(c => c.id);
  const componentsMatched = failedComponents.length === 0 && info.components.length > 0;

  // 5. 依赖安装
  // 如果没有 node_modules，尝试 pnpm install（new_generate_page 可能没装依赖）
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

  // 6. 代码质量静态分析
  const codeQuality = checkCodeQuality(codeDir, info.pageDir);

  return {
    compilePassed,
    runtimeOk: null,
    componentsMatched,
    failedComponents,
    matchedComponents: compAccuracy.matchedExpected,
    missingComponents: compAccuracy.missingExpected,
    installCompleted,
    missingFiles: compAccuracy.missingExpected,
    codeQuality,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
