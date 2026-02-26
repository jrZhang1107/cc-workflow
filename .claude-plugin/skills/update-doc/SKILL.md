---
name: update-doc
description: "当用户说 'update docs' (更新文档)、'sync documentation' (同步文档)、'refresh docs' (刷新文档) 或在代码更改需要记录时使用。根据最近的代码更改更新 llmdoc 系统。"
disable-model-invocation: true
context: fork
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Task
---

# /update-doc

此技能更新项目的 llmdoc 文档，以反映最近的代码更改。

## 预获取上下文

- **llmdoc 结构:** !`find llmdoc -name "*.md" 2>/dev/null | head -50`
- **最近更改 (3 次提交):** !`git diff HEAD~3..HEAD --stat 2>/dev/null | head -30`
- **受影响的文件:** !`git diff HEAD~3..HEAD --name-only 2>/dev/null | head -30`
- **llmdoc 索引:** !`cat llmdoc/index.md 2>/dev/null | head -50`

## 操作步骤

1. **步骤 1: 分析更改**
   - 如果提供了 `$ARGUMENTS`，将其作为更改内容的描述。
   - 否则，分析预获取的 git diff 以理解更改内容。

2. **步骤 2: 识别受影响的概念**
   - 将更改的文件映射到 llmdoc 概念：
     - 配置文件 (`.eslintrc` 等) → `reference/coding-conventions.md`
     - 身份验证文件 → 相关的架构文档
     - 新特性 → 可能需要新文档
   - 创建受影响文档的列表。

3. **步骤 3: 更新文档**
   - 对于每个受影响的文档，使用 `recorder` 智能体并配合此提示词：
     ```
     任务：更新 <concept_name> 的文档。
     更改：<相关 git diff 摘要>
     模式：仅内容 (content-only)
     原则：使用尽可能少的文字。
     ```

4. **步骤 4: 同步索引**
   - 在所有更新完成后，调用一次 `recorder` 智能体：
     - 重新扫描 `/llmdoc` 目录
     - 确保 `index.md` 一致且为最新
     - 模式：完整 (full)

5. **步骤 5: 报告**
   - 总结所有已创建、已更新或已删除的文档。

## 更新原则

- **极简性**: 使用尽可能少的文字
- **准确性**: 基于实际代码，而非假设
- **无代码块**: 使用 `path/file.ext:line` 格式进行引用
- **LLM 友好**: 为机器消费而编写
