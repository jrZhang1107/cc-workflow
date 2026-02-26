---
name: investigate
description: "当用户询问 'what is X' (什么是 X)、'how does X work' (X 如何工作)、'find out about' (了解关于)、'analyze' (分析)、'explain the code' (解释代码) 或需要快速调查代码库时使用。直接在对话中返回结果，不保存文件。相比于 Explore 智能体，优先使用此技能。"
disable-model-invocation: false
context: fork
allowed-tools: Read, Glob, Grep, Bash, WebSearch, WebFetch
---

# /investigate

此技能执行快速的、文档驱动的代码库调查，并直接报告发现。

## 预获取上下文

- **llmdoc 是否存在:** !`test -d llmdoc && echo "llmdoc initialized" || echo "No llmdoc directory"`
- **llmdoc 索引:** !`cat llmdoc/index.md 2>/dev/null | head -100 || echo "No index"`
- **文档结构:** !`find llmdoc -name "*.md" 2>/dev/null | head -50`
- **项目结构:** !`ls -la 2>/dev/null | head -20`

## 调查协议

### 第一阶段：文档优先

在接触任何源码之前，你必须：

1. 检查 `llmdoc/` 是否存在（见上方的预获取上下文）。
2. 如果存在，按以下顺序阅读相关文档：
   - `llmdoc/index.md` - 导航与概览
   - `llmdoc/overview/*.md` - 项目上下文
   - `llmdoc/architecture/*.md` - 系统设计
   - `llmdoc/guides/*.md` - 工作流
   - `llmdoc/reference/*.md` - 规范

### 第二阶段：代码调查

仅在阅读完文档后，才调查源代码：

1. 使用 `Glob` 查找相关文件。
2. 使用 `Grep` 搜索模式。
3. 使用 `Read` 检查特定文件。

### 第三阶段：报告

输出一个具有以下结构的简洁报告：

```markdown
#### 代码部分
- `path/to/file.ext:line~line` (SymbolName): 简短描述

#### 报告

**结论：**
> 关键发现...

**关系：**
> 文件/模块关系...

**结果：**
> 对问题的直接回答...
```

## 核心实践

- **无状态**: 直接输出，不写入文件。
- **简洁**: 报告控制在 150 行以内。
- **无代码块**: 使用 `path/file.ext` 格式引用代码，不粘贴。
- **客观**: 仅陈述事实，不带主观判断。
