---
name: read-doc
description: "利用 llmdoc 文档系统快速理解项目架构、代码详情和核心概念，无需直接阅读源代码。"
disable-model-invocation: true
context: fork
allowed-tools: Read, Glob, Grep
---

# /read-doc

此技能阅读项目的 `llmdoc` 文档并提供全面的摘要，以帮助快速理解项目。

## 预获取上下文

- **文档索引:** !`cat llmdoc/index.md 2>/dev/null || echo "No llmdoc found"`
- **文档结构:** !`find llmdoc -name "*.md" 2>/dev/null | head -200 || echo "No llmdoc directory"`

## 操作步骤

1. **步骤 1: 检查文档是否存在**
   - 如果 `llmdoc/` 目录不存在，告知用户并建议先运行 `/ccw:initDoc`。

2. **步骤 2: 阅读索引**
   - 阅读 `llmdoc/index.md` 以了解文档结构。

3. **步骤 3: 阅读概览文档**
   - 阅读 `llmdoc/overview/` 中的所有文档，以了解项目的目的和上下文。

4. **步骤 4: 扫描架构与指南**
   - 扫描 `llmdoc/architecture/` 获取系统设计信息。
   - 扫描 `llmdoc/guides/` 获取可用的工作流。

5. **步骤 5: 生成摘要**
   - 提供一份简洁的摘要，包括：
     - 项目目的和主要特性
     - 核心架构组件
     - 可用的指南和工作流
     - 重要参考资料

以结构良好的格式直接向用户输出摘要。
