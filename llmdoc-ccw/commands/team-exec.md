---
description: "团队执行 - 按计划分层并行执行任务"
---

## 动作 (Actions)

**用途**: 执行 team-plan 生成的计划，按层级并行运行任务。

### 触发场景
- 完成 team-plan 后
- 有现成的执行计划
- 需要并行实施多个任务

---

## 上下文传递规则

> **加载计划的正确方式**:
>
> - **同会话（刚执行完 team-plan）**: 计划内容已经在你的上下文中，直接使用即可。
> - **跨会话（新对话中执行 team-exec）**: 使用轻量命令加载：
>   ```bash
>   llmdoc-ccw read-result --phase plan
>   ```
>   这只输出计划的结构信息（tasks 列表、layers、scope），不包含每个 task 的完整 prompt 文本。
>   如果需要加载特定计划：
>   ```bash
>   llmdoc-ccw read-result --phase plan --plan <plan-id>
>   ```
>
> ⛔ **禁止**直接用 Read 工具读取 `~/.cc-workflow/.../plans/latest.json`，该文件包含每个 task 的完整 prompt，体积较大。

---

## 执行流程

### STEP 0: 加载计划

判断当前上下文：
- 如果上下文中已有 team-plan 的输出 → 直接使用，跳到 STEP 1
- 如果是新会话 → 执行：
  ```bash
  llmdoc-ccw read-result --phase plan
  ```
- 如果没有计划，提示先运行 `/llmdoc-ccw:team-plan`。

### STEP 1: 前置检查

验证执行环境：
- [ ] 计划文件存在且有效
- [ ] 所有目标文件路径可访问
- [ ] 依赖的 CLI 工具可用 (gemini, codex)

### STEP 2: 分层执行

对于每一层：

```
📦 Layer 1/3 (2 tasks)

  🔧 Starting task-1 (codex)...
  🔧 Starting task-2 (gemini)...

  ✅ task-1 completed (45s)
  ✅ task-2 completed (32s)

📦 Layer 2/3 (1 task)

  🔧 Starting task-3 (gemini)...

  ✅ task-3 completed (28s)
```

**并行执行规则**:
- 同层任务并行执行（使用多个并行的 Bash 工具调用）
- 等待当前层全部完成后进入下一层
- 任务失败时，跳过依赖它的下游任务

### STEP 3: 任务执行

每个任务通过 CLI 执行：

```bash
llmdoc-ccw cli -p "<task.prompt>" --tool <task.tool> --mode <task.mode>
```

CLI 的 stdout 会直接返回到你的上下文中，包含该任务的执行结果。

**Builder 任务模板**:
```
你是 Builder，负责实施一个子任务。

## 你的任务
<task.name>
<task.prompt>

## 文件范围约束（⛔ 硬性规则）
你只能创建或修改以下文件：
<task.scope.include>
严禁修改任何其他文件。

## 验收标准
<task.acceptance>

完成后输出 JSON 格式的执行报告。
```

### STEP 4: 错误处理

**任务失败时**:
1. 记录失败原因
2. 标记依赖此任务的下游任务为 "skipped"
3. 继续执行其他不受影响的任务

**依赖跳过**:
```
⏭️ Skipping task-4 (dependency task-2 failed)
```

### STEP 5: 结果汇总

```
═══════════════════════════════════════════════════
✅ Team 执行完成

执行摘要:
  - 总任务: 5
  - 完成: 4
  - 失败: 1
  - 跳过: 0

任务详情:
| Task    | Tool   | Status | Duration | Files Changed |
|---------|--------|--------|----------|---------------|
| task-1  | codex  | ✅     | 45s      | 2             |
| task-2  | gemini | ✅     | 32s      | 3             |
| task-3  | gemini | ❌     | 28s      | 0             |
| task-4  | codex  | ✅     | 15s      | 1             |
| task-5  | gemini | ✅     | 20s      | 1             |

下一步:
  1. 运行 /llmdoc-ccw:team-review 进行代码审查
  2. 或手动检查失败的任务: task-3
```

---

## 输出

执行结果保存到: `~/.cc-workflow/projects/<id>/team/reports/<execution-id>.json`

提示用户：
```
✅ 执行阶段完成

下一步: 运行 /llmdoc-ccw:team-review 进行双模型审查
```
