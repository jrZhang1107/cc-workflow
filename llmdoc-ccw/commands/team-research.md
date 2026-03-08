---
description: "团队研究 - 多 CLI 并行分析代码库，生成约束集和依赖关系"
---

## 动作 (Actions)

**用途**: 在实施复杂任务前，使用多个 CLI 工具并行分析代码库。

### 触发场景
- 需要理解大型代码库
- 准备实施跨模块功能
- 需要识别技术约束和风险

---

## 上下文传递规则

> **重要**: 当你通过 Bash 工具执行 `llmdoc-ccw cli ...` 时，CLI 的 stdout 输出会直接返回到你的上下文中。
> 你已经能看到 agentMessage 的完整内容（它被实时流式打印到了 stdout）。
>
> - **同会话内**: 不需要再读取任何 JSON 文件，直接使用 stdout 中已有的分析结果即可。
> - **跨会话时**: 如果需要加载之前的研究结果，使用轻量命令：
>   ```bash
>   llmdoc-ccw read-result --phase research
>   ```
>   这只会输出 agentMessage 摘要，不会加载完整的 IR 数据。
>
> ⛔ **禁止**直接用 Read 工具读取 `~/.cc-workflow/.../reports/*-research.json`，
> 那个文件包含所有中间 IR 单元（thought、tool_call、streaming_content 等），体积很大，会浪费上下文。

---

## 执行流程

### STEP 0: 需求增强
分析用户请求，补全缺失信息：
- 明确任务目标
- 识别隐含假设
- 确定成功标准

### STEP 1: 并行分析

**同时启动两个分析任务**（使用两个并行的 Bash 工具调用）:

```bash
# 后端分析 (Codex)
llmdoc-ccw cli -p "<后端分析提示词>" --tool codex --mode analysis

# 前端分析 (Gemini)
llmdoc-ccw cli -p "<前端分析提示词>" --tool gemini --mode analysis
```

两个命令的 stdout 输出会直接返回到你的上下文中，包含完整的分析结果。

**后端分析重点**:
- 数据模型和 API 结构
- 业务逻辑和服务层
- 配置和依赖管理
- 安全和权限控制

**前端分析重点**:
- 组件结构和状态管理
- 路由和页面组织
- 样式和主题系统
- 用户交互模式

### STEP 2: 结果聚合

直接基于 STEP 1 中两个 CLI 的 stdout 输出进行聚合（它们已经在你的上下文中），生成：

```markdown
## 约束集

### 硬约束 (必须遵守)
- [HC-1] <约束描述> — 来源: Codex/Gemini

### 软约束 (建议遵守)
- [SC-1] <约束描述> — 来源: Codex/Gemini

### 依赖关系
- [DEP-1] <模块A> → <模块B>: <原因>

### 风险
- [RISK-1] <风险描述> — 缓解: <策略>

## 成功判据
- [OK-1] <可验证的成功行为>
```

### STEP 3: 用户确认

使用 `AskUserQuestion` 确认：
- 约束集是否完整
- 是否有遗漏的依赖
- 风险评估是否准确

---

## 输出

研究结果保存到: `~/.cc-workflow/projects/<id>/team/reports/<execution-id>-research.json`

提示用户：
```
✅ 研究阶段完成

约束集:
- 硬约束: X 条
- 软约束: Y 条
- 依赖: Z 条
- 风险: W 条

下一步: 运行 /llmdoc-ccw:team-plan 生成执行计划
```
