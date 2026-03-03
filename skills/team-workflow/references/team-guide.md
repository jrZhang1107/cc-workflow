# Team Workflow 指南

## 概述

Team Workflow 是 cc-workflow 的多 CLI 协作功能，支持：
- 多 CLI 并行执行 (Gemini + Codex)
- 任务依赖管理和拓扑排序
- 分层并行执行
- 双模型交叉审查

## 四阶段工作流

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Research   │ ──► │    Plan     │ ──► │    Exec     │ ──► │   Review    │
│  (并行分析)  │     │  (任务规划)  │     │  (并行执行)  │     │  (交叉审查)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Phase 1: Research
- Codex 分析后端代码
- Gemini 分析前端代码
- 输出: 约束集、依赖关系、风险评估

### Phase 2: Plan
- 任务拆分 (文件范围隔离)
- 依赖图构建
- 拓扑排序 → 执行层
- 输出: 任务计划

### Phase 3: Exec
- 按层级并行执行
- 同层任务并发
- 失败传播和跳过
- 输出: 执行结果

### Phase 4: Review
- Codex + Gemini 交叉审查
- 问题分级 (Critical/Warning/Info)
- 输出: 审查报告

## 使用方式

### CLI 命令

```bash
# 完整工作流
llmdoc-ccw team -p "实现用户认证模块"

# 单独阶段
llmdoc-ccw team -p "分析项目" --phase research
llmdoc-ccw team -p "生成计划" --phase plan
llmdoc-ccw team --plan latest --phase exec
llmdoc-ccw team --phase review

# 详细输出
llmdoc-ccw team -p "任务描述" --verbose
```

### Claude Code 命令

```
/llmdoc-ccw:team-research   # 并行分析
/llmdoc-ccw:team-plan       # 生成计划
/llmdoc-ccw:team-exec       # 执行计划
/llmdoc-ccw:team-review     # 审查结果
```

## 核心概念

### 文件范围隔离

并行任务的文件范围必须不重叠：

```
Task A: src/api/**/*.js      ✅ 可并行
Task B: src/components/**/*  ✅ 可并行
Task C: src/api/user.js      ❌ 与 Task A 冲突 → 设为依赖
```

### 任务依赖

```
Task A (无依赖)     ─┐
                    ├─► Task C (依赖 A, B)
Task B (无依赖)     ─┘
```

### 执行层

```
Layer 1: [A, B]  # 并行执行
Layer 2: [C]     # 等待 Layer 1 完成
```

## 最佳实践

1. **先 Research**: 复杂任务先分析，避免盲目实施
2. **检查计划**: 执行前确认任务拆分合理
3. **处理 Critical**: Review 发现的严重问题必须修复
4. **保持隔离**: 确保并行任务文件范围不重叠
