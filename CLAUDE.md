# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

SkyWalker 页面生成评测工具 — 自动化评测 agent-service 的意图识别、页面生成质量、端到端耗时。**不打分，只记录链路事实和检测结果**。

## 常用命令

```bash
pnpm eval                          # 运行全部测试用例
pnpm eval --case tc-001            # 只跑指定用例
pnpm eval --help                   # 查看帮助
pnpm eval listen                   # 代理监听模式（不执行用例，实时展示 SkyWalker 前端操作的调用链路）
pnpm eval listen --port 8001       # 指定代理端口
```

环境变量（在 `.env` 中配置，参照 `.env.example`）：
- `SKYWALKER_COOKIE` — **必填**，Pradox 认证 Cookie
- `AGENT_SERVICE_URL` — agent-service 地址，默认 `http://localhost:8000`
- `PREVIEW_URL` — preview server 地址，默认 `http://localhost:15174`

## 核心架构

```
src/index.ts        CLI 入口，支持 eval（评测）和 listen（代理监听）两种模式
src/runner.ts       测试执行器：调用 agent-service SSE 接口，多轮对话自动回复
src/scorer.ts       分析器：意图路由链路分析 + 阶段耗时计算 + 报告生成
src/reporter.ts     报告输出：终端表格 + 精简 JSON 文件
src/preview-checker.ts  页面质量检测：调 preview server API 检查编译、组件匹配
src/code-quality.ts 代码质量静态分析（重复代码、类型安全、规范、React 实践）
src/proxy.ts        SSE 透明代理（listen 模式用）
src/types.ts        所有类型定义
```

### 评测流程（eval 模式）

1. 加载 `test-cases.json` 中的测试用例
2. 为每个用例初始化项目（`project/<timestamp>-<caseId>/code/`）：
   - 调 scaffold API 生成骨架 → 覆盖 `package.json`（补 @didi 依赖）和 `.npmrc` → `pnpm install`
3. `runTestCase()` 发起 SSE 多轮对话（最多 8 轮）：
   - 发送用户 prompt → AI 回复 → 自动填入业务线配置 → 继续对话
   - 检测 `pradox_campaign_create` 完成后自动催促生成页面
   - 页面生成类用例：`new_generate_page` 的 tool_result 返回后提前终止 SSE
   - 终端实时打印 spawn 链路、核心工具调用、阶段耗时
4. `analyzeCase()` 综合分析：意图路由是否正确、工具选择是否正确、页面质量（编译 + 组件匹配）、代码质量
5. 生成报告 → 终端打印 + 保存到 `eval-reports/`

### 测试用例格式（test-cases.json）

```json
{
  "id": "tc-001",
  "name": "用例名",
  "prompt": "用户输入的自然语言需求",
  "expectedIntent": "page_generation",
  "expectedTools": ["new_generate_page"],
  "expectedComponents": ["count-down", "rule-popup"],
  "timeoutMs": 300000,
  "basicConfig": { "bizId": "363", "forceLogin": true, "env": "stable", ... }
}
```

### Agent 路由映射（scorer.ts）

```
page_generation → gmp-dev-agent / ops-agent
campaign_query  → orchestrator
campaign_update → ops-agent / orchestrator
review_operation → ops-agent / orchestrator
copy_generation → orchestrator / ops-agent
```

## 修改代码后

更新 `ai-change.log`，记录变更内容、涉及文件和原因。格式参照已有条目。