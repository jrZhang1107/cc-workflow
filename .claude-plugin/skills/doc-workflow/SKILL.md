---
name: doc-workflow
description: "当用户询问 'documentation workflow' (文档工作流)、'how to document' (如何编写文档)、'doc system' (文档系统)、'what is llmdoc' (什么是 llmdoc)、'how does llmdoc work' (llmdoc 如何工作) 或需要文档系统指导时使用。"
disable-model-invocation: false
allowed-tools: Read, Glob, AskUserQuestion
---

# /doc-workflow

此技能提供关于 llmdoc 文档系统和可用文档工作流的指导。

## 预获取上下文

- **llmdoc 状态:** !`test -d llmdoc && echo "INITIALIZED" || echo "NOT_INITIALIZED"`
- **文档数量:** !`find llmdoc -name "*.md" 2>/dev/null | wc -l`
- **文档索引:** !`cat llmdoc/index.md 2>/dev/null | head -30`

## 工作流指南

### 如果 llmdoc 尚未初始化：

建议运行 `/ccw:initDoc` 来初始化文档系统。

说明其好处：
- 文档驱动开发
- LLM 优化的检索映射 (Retrieval Maps)
- 一致的项目理解

### 如果 llmdoc 已初始化：

说明可用的工作流：

| 任务 | 命令/技能 | 描述 |
|------|--------------|-------------|
| 阅读文档 | `/read-doc` | 快速了解项目 |
| 更新文档 | `/update-doc` | 代码更改后同步文档 |
| 调查研究 | `/investigate` | 文档优先的代码库研究 |
| 初始化 | `/ccw:initDoc` | 一次性设置（已完成） |

### llmdoc 结构

```
llmdoc/
├── index.md          # 导航中心
├── overview/         # "这是什么项目？"
├── architecture/     # "它是如何工作的？" (LLM 检索映射)
├── guides/           # "我该如何做 X？"
└── reference/        # "具体细节是什么？"
```

## 操作步骤

1. 检查预获取上下文以确定 llmdoc 状态。
2. 根据用户的问题，提供相关的指导。
3. 如果用户想要执行某个操作，引导他们使用相应的技能/命令。
