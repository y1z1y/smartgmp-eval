#!/usr/bin/env node
/**
 * SkyWalker 评测工具 — CLI 入口
 *
 * 用法：
 *   pnpm eval                          # 运行测试用例
 *   pnpm eval --case tc-001            # 只跑指定用例
 *   pnpm eval listen                   # 代理监听模式（在 SkyWalker 前端正常操作，实时看链路）
 *   pnpm eval listen --port 8001       # 指定代理端口
 */
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { TestCase } from './types.js';
import { runTestCase, type StageTiming } from './runner.js';
import { analyzeCase, generateReport } from './scorer.js';
import { printReport, saveJsonReport } from './reporter.js';
import { isPreviewServerAlive } from './preview-checker.js';
import { startProxy } from './proxy.js';

import { runFixTest } from './fix-runner.js';
import type { ErrorType } from './error-injector.js';

// ========== 子命令 ==========

type Command = 'eval' | 'listen' | 'fix';

// ========== 参数解析 ==========

interface EvalArgs {
  command: Command;
  caseId: string | null;
  codeRoot: string;
  testCasesPath: string;
  proxyPort: number;
  /** fix 子命令：错误类型 */
  errorType: ErrorType;
  /** fix 子命令：已有项目路径（跳过生成） */
  projectPath: string | null;
  /** fix 子命令：跳过生成 */
  skipGeneration: boolean;
}

function parseArgs(argv: string[]): EvalArgs {
  const args: EvalArgs = {
    command: 'eval',
    caseId: null,
    codeRoot: resolve(import.meta.dirname, '..', 'project'),
    testCasesPath: join(import.meta.dirname, '..', 'test-cases.json'),
    proxyPort: 47890,
    errorType: 'syntax',
    projectPath: null,
    skipGeneration: false,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case 'listen':
        args.command = 'listen';
        break;
      case 'fix':
        args.command = 'fix';
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
      case '--port':
        args.proxyPort = parseInt(argv[++i] ?? '8001', 10);
        break;
      case '--error':
        args.errorType = (argv[++i] ?? 'syntax') as ErrorType;
        break;
      case '--project':
        args.projectPath = resolve(argv[++i] ?? '');
        args.skipGeneration = true;
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
SkyWalker 评测工具

用法：
  pnpm eval [选项]                  运行测试用例
  pnpm eval fix [选项]              错误注入 + AI 修复能力测试
  pnpm eval listen [--port 47890]   代理监听模式

选项：
  --case <id>        只运行指定用例（如 tc-001）
  --code-root <path> 项目代码根目录（默认 ./project）
  --test-cases <path> 测试用例文件路径（默认 ./test-cases.json）
  --port <port>      代理监听端口（默认 47890，仅 listen 模式）
  --help             显示帮助

fix 子命令选项：
  --case <id>        用指定用例先生成页面再注入错误（默认 tc-001）
  --error <type>     错误类型：syntax | runtime | bad-import（默认 syntax）
  --project <path>   跳过生成，直接在已有项目上注入并修复
                     例：--project project/2026-07-10T12-00-00-tc-001

环境变量：
  AGENT_SERVICE_URL  agent-service 地址（默认 http://localhost:8000）
  PREVIEW_URL        preview server 地址（默认 http://localhost:15174）
  SKYWALKER_COOKIE   Pradox 认证 Cookie（也可在 .env 文件中配置）

listen 模式：
  启动一个 SSE 透明代理，你在 SkyWalker 前端正常操作，
  终端实时显示调用链路和耗时。
  使用方式：SkyWalker 前端连 http://localhost:<proxyPort>
`);
}

// ========== 主流程 ==========

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.command === 'listen') {
    startProxy(args.proxyPort);
    return;
  }

  if (args.command === 'fix') {
    await runFixCommand(args);
    return;
  }

  // eval 模式
  console.log('🚀 SkyWalker 评测工具');
  const cookieConfigured = checkCookieConfigured();
  if (!cookieConfigured) {
    console.log('⚠️  SKYWALKER_COOKIE 未配置！请在 .env 中配置');
  }
  console.log('');

  // 1. 检查 preview server
  await isPreviewServerAlive();

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
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const results: import('./types.js').CaseResult[] = [];
  const allStages: import('./runner.js').StageTiming[][] = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const caseCodeRoot = resolve(args.codeRoot, `${runTimestamp}-${tc.id}`);
    const codeDir = 'code';
    const caseCodePath = join(caseCodeRoot, codeDir);
    const { mkdirSync, writeFileSync } = await import('node:fs');

    // 初始化项目
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

    // 初始化项目：scaffold 骨架 + 配置文件
    const SMARTGMP_MCP_URL = process.env.SMARTGMP_MCP_URL ?? 'http://localhost:8002';
    const templateDir = resolve(import.meta.dirname, '..', '.skywalker-template', 'code');
    if (!existsSync(join(caseCodePath, 'package.json'))) {
      try {
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
        if (!scaffoldRes.ok) {
          const err = await scaffoldRes.text();
          console.log(`  ⚠️ scaffold 失败: ${err}`);
        }

        // scaffold 之后覆盖关键配置文件（和真实 SkyWalker 项目一致）
        const { cpSync, readFileSync, writeFileSync } = await import('node:fs');

        // 补充 @didi 依赖到 package.json（scaffold 生成的骨架不包含）
        const pkgJsonPath = join(caseCodePath, 'package.json');
        if (existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
          pkgJson.dependencies = pkgJson.dependencies ?? {};
          pkgJson.dependencies['@didi/webx-js'] = '^2.22.2';
          pkgJson.dependencies['@didi/webx-js-web'] = '^2.22.0';
          pkgJson.dependencies['@didi/wsgsdk'] = '^1.5.16';
          pkgJson.dependencies['axios'] = '^1.6.0';
          pkgJson.dependencies['coordtransform'] = '^2.1.2';
          pkgJson.dependencies['crypto-js'] = '^4.2.0';
          pkgJson.dependencies['dayjs'] = '^1.11.0';
          pkgJson.dependencies['jotai'] = '^2.11.3';
          pkgJson.dependencies['lodash'] = '^4.17.0';
          pkgJson.dependencies['qs'] = '^6.11.0';
          pkgJson.dependencies['react-intersection-observer'] = '^9.5.0';
          pkgJson.dependencies['antd-mobile'] = '^5.0.0';
          pkgJson.devDependencies = pkgJson.devDependencies ?? {};
          pkgJson.devDependencies['@types/crypto-js'] = '^4.2.0';
          pkgJson.devDependencies['@types/lodash'] = '^4.17.0';
          pkgJson.devDependencies['@types/qs'] = '^6.9.0';
          pkgJson.pnpm = pkgJson.pnpm ?? {};
          pkgJson.pnpm.overrides = pkgJson.pnpm.overrides ?? {};
          pkgJson.pnpm.overrides['@babel/runtime-corejs3'] = '^7.29.7';
          writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), 'utf-8');
        }

        // 覆盖 .npmrc：全走内网 registry
        const templateNpmrc = join(templateDir, '.npmrc');
        if (existsSync(templateNpmrc)) {
          cpSync(templateNpmrc, join(caseCodePath, '.npmrc'));
        }
        // 用 pnpm 安装依赖（和 SkyWalker 一致，生成 .pnpm symlink 结构）
        console.log(`  📦 pnpm install...`);
        const { execSync } = await import('node:child_process');
        try {
          execSync('pnpm install --no-frozen-lockfile --ignore-scripts --ignore-workspace', { cwd: caseCodePath, timeout: 180_000, stdio: 'pipe' });
          console.log(`  ✅ 依赖安装完成`);
        } catch (e) {
          console.log(`  ⚠️ pnpm install 失败: ${e instanceof Error ? e.message : e}`);
        }
      } catch (e) {
        console.log(`  ⚠️ 项目初始化请求失败: ${e instanceof Error ? e.message : e}`);
      }
    }

    console.log(`▶ [${i + 1}/${testCases.length}] ${tc.name} (${tc.id})`);

    const runResult = await runTestCase(tc, caseCodeRoot);
    const caseResult = await analyzeCase(tc, runResult, caseCodeRoot);

    // 汇总输出
    const routeIcon = caseResult.intent.routedCorrectly ? '✅' : '❌';
    const agents = caseResult.intent.actualAgents.length > 0
      ? [...new Set(caseResult.intent.actualAgents)].join(' → ')
      : '无';
    console.log(`  ${routeIcon} 路由: ${agents}`);

    // 阶段耗时（补全未关闭的阶段：用下一阶段的开始时间作为结束时间）
    if (runResult.stages.length > 0) {
      // 修补阶段结束时间：如果 endTs == startTs，用下一阶段的 startTs 补上
      const fixedStages = runResult.stages.map((s, idx) => {
        if (s.endTs <= s.startTs && idx < runResult.stages.length - 1) {
          return { ...s, endTs: runResult.stages[idx + 1].startTs };
        }
        if (s.endTs <= s.startTs && idx === runResult.stages.length - 1 && caseResult.duration) {
          return { ...s, endTs: s.startTs + caseResult.duration.totalMs - (s.startTs - (runResult.events[0]?.timestamp ?? s.startTs)) };
        }
        return s;
      });
      const stageParts = fixedStages.map(s => {
        const dur = s.endTs > s.startTs ? fmtDuration(s.endTs - s.startTs) : '...';
        return `${s.name} ${dur}`;
      });
      console.log(`     ${stageParts.join(' → ')}`);
    }
    if (caseResult.duration) {
      console.log(`     总计: ${fmtDuration(caseResult.duration.totalMs)}`);
    }

    if (caseResult.quality) {
      const q = caseResult.quality;
      const parts: string[] = [];
      if (q.compilePassed === null) parts.push('编译未检测');
      else if (!q.compilePassed) parts.push('编译失败');
      if (!q.componentsMatched) parts.push(`组件缺${q.missingComponents.join(',')}`);
      if (!q.installCompleted) parts.push('依赖未装');
      if (parts.length > 0) console.log(`     页面: ${parts.join(', ')}`);
      else console.log(`     页面: ✅`);
    }

    if (caseResult.timedOut) console.log(`     ⏱️ 超时`);
    if (caseResult.error) console.log(`     ❌ ${caseResult.error}`);

    console.log('');

    results.push(caseResult);
    allStages.push(runResult.stages);
  }

  // 4. 生成报告
  const report = generateReport(results);
  printReport(report, allStages);

  // 5. 保存 JSON 报告
  const reportDir = join(import.meta.dirname, '..', 'eval-reports');
  const savedPath = await saveJsonReport(report, reportDir);
  console.log(`📄 详细报告已保存: ${savedPath}`);

  // 6. 退出码
  const hasFailure = results.some(r => r.timedOut || !r.intent.routedCorrectly);
  process.exit(hasFailure ? 1 : 0);
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** fix 子命令：错误注入 + AI 修复测试 */
async function runFixCommand(args: EvalArgs): Promise<void> {
  console.log('🔧 SkyWalker AI 修复能力测试');
  console.log('');

  await isPreviewServerAlive();

  let testCase: TestCase | undefined;
  if (!args.skipGeneration) {
    const caseId = args.caseId ?? 'tc-001';
    const raw = await readFile(args.testCasesPath, 'utf-8');
    const cases = JSON.parse(raw) as TestCase[];
    testCase = cases.find(c => c.id === caseId);
    if (!testCase) {
      console.error(`❌ 未找到用例: ${caseId}`);
      process.exit(1);
    }
    console.log(`📋 用例: ${testCase.name} (${testCase.id})`);
  } else if (!args.projectPath) {
    console.error('❌ --project 需要指定已有项目路径');
    process.exit(1);
  }

  console.log(`💉 错误类型: ${args.errorType}`);
  console.log('');

  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const projectRoot = args.skipGeneration
    ? args.projectPath!
    : resolve(args.codeRoot, `${runTimestamp}-${testCase!.id}`);

  if (!args.skipGeneration && testCase) {
    // 初始化项目（与 eval 模式相同）
    const { mkdirSync, writeFileSync, existsSync: exists, cpSync, readFileSync } = await import('node:fs');
    const codeDir = 'code';
    const caseCodePath = join(projectRoot, codeDir);
    mkdirSync(projectRoot, { recursive: true });
    const skywalkerDir = join(projectRoot, '.skywalker');
    mkdirSync(skywalkerDir, { recursive: true });
    if (!exists(join(skywalkerDir, 'project.json'))) {
      writeFileSync(join(skywalkerDir, 'project.json'), JSON.stringify({
        name: `eval-fix-${testCase.id}`,
        description: `修复测试 ${testCase.name}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        code_dir: codeDir,
        enabledPlugins: ['smartgmp'],
      }, null, 2), 'utf-8');
    }
    if (!exists(join(caseCodePath, 'package.json'))) {
      const SMARTGMP_MCP_URL = process.env.SMARTGMP_MCP_URL ?? 'http://localhost:8002';
      const templateDir = resolve(import.meta.dirname, '..', '.skywalker-template', 'code');
      try {
        const scaffoldRes = await fetch(`${SMARTGMP_MCP_URL}/business/project/scaffold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectRoot,
            codeRoot: caseCodePath,
            projectName: `eval-fix-${testCase.id}`,
            templateId: 'gmp-react-marketing',
          }),
        });
        if (!scaffoldRes.ok) console.log(`  ⚠️ scaffold 失败`);
        const pkgJsonPath = join(caseCodePath, 'package.json');
        if (exists(pkgJsonPath)) {
          const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
          pkgJson.dependencies = pkgJson.dependencies ?? {};
          pkgJson.dependencies['@didi/webx-js'] = '^2.22.2';
          pkgJson.dependencies['@didi/webx-js-web'] = '^2.22.0';
          writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), 'utf-8');
        }
        const templateNpmrc = join(templateDir, '.npmrc');
        if (exists(templateNpmrc)) cpSync(templateNpmrc, join(caseCodePath, '.npmrc'));
        console.log(`  📦 pnpm install...`);
        const { execSync } = await import('node:child_process');
        execSync('pnpm install --no-frozen-lockfile --ignore-scripts --ignore-workspace', { cwd: caseCodePath, timeout: 180_000, stdio: 'pipe' });
      } catch (e) {
        console.log(`  ⚠️ 项目初始化: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  console.log(`📁 项目: ${projectRoot}`);
  console.log('');

  const result = await runFixTest({
    testCase,
    projectRoot,
    errorType: args.errorType,
    skipGeneration: args.skipGeneration,
  });

  console.log('');
  console.log('══════════ 修复测试结果 ══════════');
  console.log(`  页面: ${result.pageName || '—'}`);
  console.log(`  注入: ${result.injectedError || '—'}`);
  console.log(`  检测到错误: ${result.brokenConfirmed ? '✅' : '❌'} ${result.detectedError ?? ''}`);
  console.log(`  修复结果: ${result.fixSucceeded ? '✅ 编译通过' : '❌ 仍有错误'}`);
  console.log(`  修复耗时: ${fmtDuration(result.fixDurationMs)}`);
  if (result.writeToolsCalled.length > 0) {
    console.log(`  写文件工具: ${result.writeToolsCalled.join(', ')}`);
  }
  if (result.error) {
    console.log(`  异常: ${result.error}`);
  }
  console.log(`  项目保留在: ${result.projectRoot}`);
  console.log('');

  process.exit(result.fixSucceeded ? 0 : 1);
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
