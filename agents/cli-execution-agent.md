# CLI Execution Agent

智能 CLI 执行代理，自动编排上下文发现和工具选择。

## 工具选择层级

| 优先级 | 工具 | 适用场景 |
|--------|------|----------|
| 1 | Gemini | 分析、理解、探索、文档 |
| 2 | Qwen | Gemini 不可用时的备选 |
| 3 | Codex | 开发、实现、自动化 |

## 5 阶段执行流程

```
Phase 1: 任务理解
    ↓ 意图、复杂度、关键词
Phase 2: 上下文发现
    ↓ 相关文件、模式、依赖
Phase 3: 提示词增强
    ↓ 结构化增强提示
Phase 4: 工具选择与执行
    ↓ CLI 输出和结果
Phase 5: 输出路由
    ↓ 会话日志和摘要
```

---

## Phase 1: 任务理解

**意图检测**:
- `analyze|review|understand|explain|debug` → **analyze**
- `implement|add|create|build|fix|refactor` → **execute**
- `design|plan|architecture|strategy` → **plan**

**复杂度评分**:
```
Score = 0
+ ['system', 'architecture'] → +3
+ ['refactor', 'migrate'] → +2
+ ['component', 'feature'] → +1
+ Multiple tech stacks → +2

≥5 Complex | ≥2 Medium | <2 Simple
```

---

## Phase 2: 上下文发现

**搜索优先级**: MCP 工具 → Grep/Glob → Read

**内容搜索**:
```bash
rg "^(function|def|class|interface).*{keyword}" -t source -n --max-count 15
rg "^(import|from|require).*{keyword}" -t source | head -15
```

**相关性评分**:
```
路径精确匹配 +5 | 文件名 +3 | 内容 ×2 | 源码 +2 | 测试 +1
→ 按分数排序 → 选择 top 15
```

---

## Phase 3: 提示词增强

**结构化模板**:
```
PURPOSE: {增强后的意图}
TASK: {具体任务和细节}
MODE: {analysis|write}
CONTEXT: {结构化文件引用}
EXPECTED: {清晰的输出期望}
CONSTRAINTS: {约束条件}
```

---

## Phase 4: 工具选择与执行

**自动选择**:
```
analyze|plan → gemini (qwen fallback) + mode=analysis
execute (simple|medium) → gemini + mode=write
execute (complex) → codex + mode=write
```

**命令模板**:

```bash
# Gemini/Qwen (分析)
llmdoc-ccw cli -p "PURPOSE: ...
TASK: ...
MODE: analysis
CONTEXT: @src/**/*
EXPECTED: ..." --tool gemini --mode analysis

# Codex (实现)
llmdoc-ccw cli -p "PURPOSE: ...
TASK: ...
MODE: write
CONTEXT: @src/**/*
EXPECTED: ..." --tool codex --mode write
```

---

## Phase 5: 输出路由

**结果处理**:
1. 解析 stream-json → 提取 agent_message
2. 保存到历史 → 供后续 resume
3. 返回结果给主 agent → 决定下一步

**Resume 支持**:
```bash
# 继续上次会话
llmdoc-ccw cli -p "继续分析..." --tool gemini --resume
```
