# 优化计划：终端打印 + 生成即评分

## 一、终端打印优化

### 现状
runner.ts 实时打印了 `[tool_call][agent] tool_name input=...` 和 `[tool_result][agent] ...`，但：
- 输出混杂，没有结构化的阶段划分
- spawn 子 agent 时只打印了 tool_input JSON，没有高亮显示"派了谁"
- 没有各阶段耗时（意图识别耗时、首工具调用耗时、总耗时等）

### 改动：runner.ts 的 sendAndCollect 中优化打印

1. **spawn 事件单独高亮**：检测到 `sessions_spawn` 时，解析 `agent_id` 并打印 `🔀 Spawn → gmp-dev-agent`，而不是打印原始 JSON
2. **关键工具调用高亮**：对 `new_generate_page`、`basic_config` 等核心工具用不同标记，辅助工具低调显示
3. **各阶段计时**：在 runner 中追踪几个时间点，在每轮结束时打印耗时：
   - 意图识别阶段：开始 → 首个 tool_call
   - 工具执行阶段：首个 tool_call → new_generate_page tool_result
   - 每轮对话总耗时

### 改动：index.ts 的摘要打印

在用例完成后的摘要中增加：
- spawn 的 agent 列表
- 实际调用的工具列表（带顺序）
- 各阶段耗时分解

## 二、生成即评分（不等流程结束）

### 现状
runner.ts 等待整个 SSE 流结束才返回 → scoreCase 才开始评分。
实际流程：basic_config → spawn gmp-dev-agent → new_generate_page → 配置活动玩法 → 发布 → …
后面的步骤耗时很长，经常超时。

### 改动：runner.ts 增加提前终止条件

在 sendAndCollect 的事件循环中，检测到以下条件之一时主动关闭 SSE 流：

1. **`new_generate_page` 的 tool_result 返回**（页面生成类用例的核心目标已完成）
2. 保留原有的超时机制不变

具体实现：
- 在 sendAndCollect 中新增一个参数 `earlyStopOnPageGen: boolean`
- 当检测到 `new_generate_page`（或名称包含 `generate_page`）的 `tool_result` 返回时，设置标记
- SSE 流自然读完本轮后，不再继续等待，直接返回
- 对非页面生成类用例，此参数为 false，行为不变

### 改动：scorer.ts 的 scoreCase 适配

当前 scoreCase 中页面质量检测已经是在 new_generate_page 的 tool_result 上做的，逻辑不需要改。
但需要确保：即使 SSE 流提前终止，已有的事件足够评分（意图识别评分只看 tool_call 事件，不受影响）。

## 文件改动清单

| 文件 | 改动内容 |
|---|---|
| `src/runner.ts` | 1. spawn 事件高亮打印 2. 关键工具/辅助工具区分打印 3. 各阶段计时打印 4. new_generate_page tool_result 后提前终止 SSE |
| `src/index.ts` | 摘要中增加 agent 列表、工具列表、阶段耗时 |