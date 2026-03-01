---
name: commit
description: "当用户说 'commit'、'save changes'、'wrap up'、'done with changes' 或想要创建 git 提交时使用。分析已暂存/未暂存的更改，并根据项目历史生成规范的提交消息。"
disable-model-invocation: true
allowed-tools: Bash, Read, AskUserQuestion
---

# /commit

此技能分析代码更改并生成遵循项目现有风格的高质量提交消息。

## 预获取上下文

- **最近提交:** !`git log --oneline -15 2>/dev/null || echo "No git history"`
- **当前分支:** !`git branch --show-current 2>/dev/null`
- **已暂存更改:** !`git diff --staged --stat 2>/dev/null | head -30`
- **未暂存更改:** !`git diff --stat 2>/dev/null | head -20`
- **文件状态:** !`git status -s 2>/dev/null | head -20`

## 操作步骤

1. **步骤 1: 分析上下文**
   - 查看上方预获取的 git 信息。
   - 如果没有任何更改（已暂存和未暂存均为空），告知用户并停止。

2. **步骤 2: 处理未暂存更改**
   - 如果只有未暂存更改，询问用户是否要先暂存文件。
   - 使用 `AskUserQuestion` 提供选项：暂存所有、暂存特定文件或取消。

3. **步骤 3: 分析更改**
   - 读取已暂存更改的实际差异内容：`git diff --staged`
   - 理解更改的内容和原因。

4. **步骤 4: 生成提交消息**
   - 根据项目的历史提交风格（从预获取上下文中获取），生成一条消息，要求：
     - 遵循项目的格式（约定式提交、表情符号使用等）
     - 准确且简洁地描述更改
     - 解释更改背后的“原因”，而不仅仅是“做了什么”

5. **步骤 5: 提议并提交**
   - 使用 `AskUserQuestion` 展示生成的提交消息。
   - 选项：照常使用、编辑或取消。
   - 如果确认，运行 `git commit -m "<message>"`。
