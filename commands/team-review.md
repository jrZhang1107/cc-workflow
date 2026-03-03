---
description: "团队审查 - 双模型交叉验证执行结果"
---

## 动作 (Actions)

**用途**: 使用 Codex 和 Gemini 交叉审查代码变更，识别潜在问题。

### 触发场景
- 完成 team-exec 后
- 需要验证代码质量
- 准备提交代码前

---

## 执行流程

### STEP 0: 收集变更

获取执行阶段的所有变更：
```bash
git diff --name-only HEAD~1  # 或根据执行记录获取
```

读取执行结果和计划文件，了解预期行为。

### STEP 1: 并行审查

**同时启动两个审查任务**:

```bash
# 后端审查 (Codex)
llmdoc-ccw cli -p "<后端审查提示词>" --tool codex --mode analysis

# 前端审查 (Gemini)
llmdoc-ccw cli -p "<前端审查提示词>" --tool gemini --mode analysis
```

**后端审查重点**:
- 逻辑正确性
- 安全漏洞
- 性能问题
- 错误处理

**前端审查重点**:
- 代码模式
- 可维护性
- 可访问性
- 用户体验

### STEP 2: 问题分级

合并两个审查结果，按严重性分级：

```markdown
## 审查报告

### 🔴 Critical (必须修复)
安全漏洞、逻辑错误、数据丢失风险

- [ ] [安全] src/api/user.js:42 - SQL 注入风险
- [ ] [逻辑] src/services/auth.js:15 - 认证绕过

### 🟡 Warning (建议修复)
模式偏离、可维护性问题

- [ ] [模式] src/utils/helper.js:88 - 未使用项目约定的错误处理
- [ ] [维护] src/components/Form.jsx:20 - 组件过大，建议拆分

### 🔵 Info (可选)
小改进建议

- [ ] [优化] src/api/user.js:100 - 可以使用缓存提升性能

### ✅ 已通过检查
- ✅ 无 XSS 漏洞
- ✅ 错误处理完整
- ✅ 类型安全
```

### STEP 3: 决策门

**如果 Critical > 0**:
```
⚠️ 发现 2 个严重问题

1. [安全] SQL 注入风险 - src/api/user.js:42
2. [逻辑] 认证绕过 - src/services/auth.js:15

选择操作:
[ ] 立即修复 (推荐)
[ ] 跳过审查
[ ] 查看详情
```

选择"立即修复"后：
- 为每个 Critical 问题创建修复任务
- 执行修复
- 重新审查受影响的文件

**如果 Critical = 0**:
```
✅ 审查通过

发现 3 个 Warning 和 2 个 Info
建议在后续迭代中处理

下一步:
  git add -A && git commit -m "feat: <功能描述>"
```

### STEP 4: 生成报告

```markdown
## Team Review Report

### 概要
- 审查文件: 8
- Critical: 0
- Warning: 3
- Info: 2
- 状态: ✅ 通过

### Codex 审查
<后端审查详情>

### Gemini 审查
<前端审查详情>

### 建议
1. 处理 Warning 级别的问题
2. 添加更多单元测试
3. 更新相关文档
```

---

## 输出

审查报告保存到: `~/.cc-workflow/projects/<id>/team/reports/<execution-id>-review.json`

提示用户：
```
✅ 审查完成

状态: 通过
Critical: 0 | Warning: 3 | Info: 2

建议:
  git add -A && git commit -m "feat: <功能描述>"
```
