---
name: team-workflow
description: "当用户提到 'team'、'协作'、'并行执行'、'多CLI'、'agent team' 或需要复杂任务分解时使用"
disable-model-invocation: false
context: fork
allowed-tools: Bash, Read, Glob, Grep, Task, TaskOutput
---

## 预获取上下文

```bash
# 检查是否有现有计划
!`ls -la ~/.cc-workflow/projects/*/team/plans/latest.json 2>/dev/null | head -5`

# 检查团队执行历史
!`cat ~/.cc-workflow/projects/*/team/executions.json 2>/dev/null | head -20`

# 项目结构
!`ls -la 2>/dev/null | head -15`
```

---

## 协议

### 触发条件

当用户请求涉及以下情况时，自动触发此技能：
- 明确提到 "team"、"协作"、"并行"
- 需要多个 CLI 工具协作
- 任务复杂度高，需要分解
- 跨模块或全栈任务

### 工作流选择

根据用户意图选择合适的阶段：

| 用户意图 | 推荐阶段 | 命令 |
|---------|---------|------|
| "分析"、"了解"、"研究" | research | `/ccw:team-research` |
| "规划"、"计划"、"拆分" | plan | `/ccw:team-plan` |
| "执行"、"实现"、"开发" | exec | `/ccw:team-exec` |
| "审查"、"检查"、"验证" | review | `/ccw:team-review` |
| 完整任务 | 全流程 | `ccw team -p "<prompt>"` |

### 执行流程

1. **识别意图**: 分析用户请求，确定需要的阶段
2. **检查前置条件**:
   - exec 需要 plan
   - review 需要 exec 结果
3. **执行工作流**: 调用相应的命令或 CLI
4. **报告结果**: 展示执行摘要和下一步建议

### 输出格式

```markdown
## Team Workflow 执行结果

### 阶段: <phase>
### 状态: ✅ 成功 / ❌ 失败

### 摘要
<执行摘要>

### 下一步
<建议的后续操作>
```

---

## 示例

### 用户: "用 team 模式实现用户认证"

```
🚀 启动 Agent Team 工作流

📋 任务: 实现用户认证
📊 模式: 完整工作流 (research → plan → exec → review)

正在执行...
```

### 用户: "并行分析这个项目"

```
🔍 启动 Team Research

正在并行分析:
  - Codex: 后端代码分析
  - Gemini: 前端代码分析

...
```
