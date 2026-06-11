#!/usr/bin/env node
/**
 * SkyWalker 页面生成评测工具 — CLI 入口
 *
 * 用法：
 *   npx tsx src/index.ts                     # 默认运行所有用例
 *   npx tsx src/index.ts --verbose           # 详细输出
 *   npx tsx src/index.ts --case tc-001       # 只跑指定用例
 *   npx tsx src/index.ts --code-root /path   # 指定项目代码根目录
 */
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { TestCase } from './types.js';
import { runTestCase } from './runner.js';
import { scoreCase, generateReport } from './scorer.js';
import { printReport, saveJsonReport } from './reporter.js';
import { isPreviewServerAlive } from './preview-checker.js';

// ========== 参数解析 ==========

interface CliArgs {
  verbose: boolean;
  caseId: string | null;
  codeRoot: string;
  testCasesPath: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    verbose: false,
    caseId: null,
    codeRoot: resolve(import.meta.dirname, '..', 'project'),
    testCasesPath: join(import.meta.dirname, '..', 'test-cases.json'),
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--verbose':
        args.verbose = true;
        break;
      case '--case':
        args.caseId = argv[++i] ?? null;
        break;
      case '--code-root':
        args.codeRoot = resolve(argv[++i] ?? args.codeRoot);
        break;
      case '--test-cases':
        args.testCasesPath = resolve(argv[++i] ?? args.testCasesPath);
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
SkyWalker 页面生成评测工具

用法：
  npx tsx src/index.ts [选项]

选项：
  --verbose          详细输出（显示每个 SSE 事件）
  --case <id>        只运行指定用例（如 tc-001）
  --code-root <path> 项目代码根目录（默认 ~/.skywalker/eval-project）
  --test-cases <path> 测试用例文件路径（默认 ../test-cases.json）
  --help             显示帮助

环境变量：
  AGENT_SERVICE_URL  agent-service 地址（默认 http://localhost:8000）
  PREVIEW_URL        preview server 地址（默认 http://localhost:15174）
  SKYWALKER_COOKIE   Pradox 认证 Cookie（也可在 .env 文件中配置）

配置文件：
  .env                在项目根目录下，填入 SKYWALKER_COOKIE=<浏览器 Cookie 值>

前提条件：
  - agent-service 必须运行在 localhost:8000
  - smartgmp-mcp 必须运行在 localhost:8002
  - smartgmp-preview 必须运行在 localhost:15174（页面质量检测需要）
`);
}

// ========== 主流程 ==========

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  console.log('🚀 SkyWalker 页面生成评测工具');
  console.log(`   agent-service: ${process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'}`);
  console.log(`   preview-server: ${process.env.PREVIEW_URL ?? 'http://localhost:15174'}`);
  console.log(`   code-root: ${args.codeRoot}`);

  // 0. 检查 cookie 配置（Pradox 认证必须）
  const cookieConfigured = checkCookieConfigured();
  if (!cookieConfigured) {
    console.log('');
    console.log('⚠️  SKYWALKER_COOKIE 未配置！');
    console.log('   页面生成需要 Pradox 认证，没有 cookie 会卡在"请粘贴 Cookie"步骤。');
    console.log('   请在 .env 文件中配置 SKYWALKER_COOKIE（从浏览器 DevTools 复制 Cookie 请求头）');
    console.log('');
  } else {
    console.log(`   cookie: 已配置 ✅`);
  }
  console.log('');

  // 1. 检查 preview server
  const previewAlive = await isPreviewServerAlive();
  if (!previewAlive) {
    console.log('⚠️  preview server 不可用，页面质量检测将跳过');
  }

  // 2. 加载测试用例
  let testCases: TestCase[];
  try {
    const raw = await readFile(args.testCasesPath, 'utf-8');
    testCases = JSON.parse(raw) as TestCase[];
  } catch (e) {
    console.error(`❌ 无法加载测试用例: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  // 按用例 ID 过滤
  if (args.caseId) {
    testCases = testCases.filter(tc => tc.id === args.caseId);
    if (testCases.length === 0) {
      console.error(`❌ 未找到用例: ${args.caseId}`);
      process.exit(1);
    }
  }

  console.log(`📋 共 ${testCases.length} 个测试用例`);
  console.log('');

  // 3. 逐个执行
  // 每个用例生成独立的项目目录: project/<timestamp>-<caseId>/
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    // 为每个用例创建独立项目目录
    const caseCodeRoot = resolve(args.codeRoot, `${runTimestamp}-${tc.id}`);
    const codeDir = 'code'; // SkyWalker 项目布局：代码在 <projectRoot>/code/ 下
    const caseCodePath = join(caseCodeRoot, codeDir);
    const { mkdirSync, writeFileSync } = await import('node:fs');

    // 初始化项目：和 SkyWalker 平台创建项目的流程一致
    // 1. 创建 .skywalker/project.json（让 ensureProjectCodeRoot 知道 code_dir）
    // 2. 调 SmartGMP scaffold 接口初始化完整项目骨架
    mkdirSync(caseCodeRoot, { recursive: true });
    const skywalkerDir = join(caseCodeRoot, '.skywalker');
    mkdirSync(skywalkerDir, { recursive: true });
    const projectConfigPath = join(skywalkerDir, 'project.json');
    if (!existsSync(projectConfigPath)) {
      writeFileSync(projectConfigPath, JSON.stringify({
        name: `eval-${tc.id}`,
        description: `评测用例 ${tc.name}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        code_dir: codeDir,
        enabledPlugins: ['smartgmp'],
      }, null, 2), 'utf-8');
    }

    // 初始化项目：scaffold 骨架 + 复制预装 node_modules
    // pnpm install 装不上 @didi 内网包（静默跳过或报错），
    // 所以从预装模板直接复制 node_modules，比 npm install 快且稳定
    const SMARTGMP_MCP_URL = process.env.SMARTGMP_MCP_URL ?? 'http://localhost:8002';
    const templateDir = resolve(import.meta.dirname, '..', '.deps-template', 'code');
    if (!existsSync(join(caseCodePath, 'package.json'))) {
      try {
        // Step 1: scaffold
        const scaffoldRes = await fetch(`${SMARTGMP_MCP_URL}/business/project/scaffold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectRoot: caseCodeRoot,
            codeRoot: caseCodePath,
            projectName: `eval-${tc.id}`,
            templateId: 'gmp-react-marketing',
          }),
        });
        if (scaffoldRes.ok) {
          console.log(`  ✅ scaffold 项目骨架`);
        } else {
          const err = await scaffoldRes.text();
          console.log(`  ⚠️ scaffold 失败: ${err}，将使用空项目`);
        }

        // Step 2: 复制预装 node_modules（比 npm install 快且内网包完整）
        const templateNm = join(templateDir, 'node_modules');
        if (existsSync(templateNm)) {
          const { cpSync } = await import('node:fs');
          cpSync(templateNm, join(caseCodePath, 'node_modules'), { recursive: true });
          // 也复制 .npmrc 和 package-lock.json
          const templateNpmrc = join(templateDir, '.npmrc');
          if (existsSync(templateNpmrc)) {
            cpSync(templateNpmrc, join(caseCodePath, '.npmrc'));
          }
          const templateLock = join(templateDir, 'package-lock.json');
          if (existsSync(templateLock)) {
            cpSync(templateLock, join(caseCodePath, 'package-lock.json'));
          }
          console.log(`  ✅ 复制预装 node_modules`);
        } else {
          // 兜底：模板不存在时 npm install
          console.log(`  ⚠️ 未找到预装模板 .deps-template/，执行 npm install...`);
          const { execSync } = await import('node:child_process');
          try {
            execSync('npm install', { cwd: caseCodePath, timeout: 180_000, stdio: 'pipe' });
            console.log(`  ✅ npm install 完成`);
          } catch (e) {
            console.log(`  ⚠️ npm install 失败: ${e instanceof Error ? e.message : e}`);
          }
        }
      } catch (e) {
        console.log(`  ⚠️ 项目初始化请求失败: ${e instanceof Error ? e.message : e}`);
      }
    }

    console.log(`▶ [${i + 1}/${testCases.length}] ${tc.name} (${tc.id})`);
    console.log(`  prompt: "${tc.prompt}"`);
    console.log(`  项目目录: ${caseCodeRoot}`);

    const runResult = await runTestCase(tc, caseCodeRoot, args.verbose);
    const caseResult = await scoreCase(tc, runResult, caseCodeRoot);

    // 打印单条摘要
    const intentLabel = caseResult.intent.score >= 80 ? '✅' : caseResult.intent.score >= 50 ? '⚠️' : '❌';
    const routeInfo = caseResult.intent.routedCorrectly
      ? `路由精确率${Math.round(caseResult.intent.routePrecision * 100)}%`
      + (caseResult.intent.redundantAgents.length > 0 ? ` 多余agent: ${caseResult.intent.redundantAgents.join(', ')}` : '')
      : '未命中期望agent';
    const toolInfo = caseResult.intent.toolSelectedCorrectly
      ? `工具精确率${Math.round(caseResult.intent.toolPrecision * 100)}%`
      + (caseResult.intent.redundantTools.length > 0 ? ` 多余工具: ${caseResult.intent.redundantTools.join(', ')}` : '')
      : '未命中期望工具';
    console.log(`  意图识别: ${intentLabel} ${caseResult.intent.score}% (路由→${caseResult.intent.actualAgent}, ${routeInfo}, ${toolInfo})`);

    if (caseResult.quality) {
      const qualityLabel = caseResult.quality.score >= 60 ? '✅' : '❌';
      console.log(`  页面质量: ${qualityLabel} ${caseResult.quality.score}% (编译${caseResult.quality.compilePassed ? '通过' : '失败'})`);
    }

    if (caseResult.codeQuality) {
      const cq = caseResult.codeQuality;
      const cqLabel = cq.score >= 40 ? '✅' : cq.score >= 25 ? '⚠️' : '❌';
      console.log(`  代码质量: ${cqLabel} ${cq.score}/50 (重复${cq.duplicateScore}/15 类型${cq.typeSafetyScore}/10 规范${cq.codeStyleScore}/10 React${cq.reactPracticeScore}/10 可维护${cq.maintainabilityScore}/5)`);
    }

    if (caseResult.duration) {
      console.log(`  端到端耗时: ${fmtDuration(caseResult.duration.totalMs)} (${caseResult.duration.totalGrade})`);
    }

    if (caseResult.timedOut) {
      console.log(`  ⏱️ 超时`);
    }
    if (caseResult.error) {
      console.log(`  ❌ 错误: ${caseResult.error}`);
    }

    console.log('');

    results.push(caseResult);
  }

  // 4. 生成报告
  const report = generateReport(results);
  printReport(report);

  // 5. 保存 JSON 报告
  const reportDir = join(import.meta.dirname, '..', 'eval-reports');
  const savedPath = await saveJsonReport(report, reportDir);
  console.log(`📄 详细报告已保存: ${savedPath}`);

  // 6. 退出码
  const hasFailure = results.some(r => r.timedOut || r.intent.score === 0 || (r.quality?.score === 0));
  process.exit(hasFailure ? 1 : 0);
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 检查 SKYWALKER_COOKIE 是否已配置 */
function checkCookieConfigured(): boolean {
  if (process.env.SKYWALKER_COOKIE) return true;
  const envPath = join(import.meta.dirname, '..', '.env');
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      const match = content.match(/^SKYWALKER_COOKIE\s*=\s*(.+)$/m);
      return !!(match && match[1].trim());
    } catch { return false; }
  }
  return false;
}

main().catch(e => {
  console.error('❌ 评测工具异常:', e);
  process.exit(2);
});
