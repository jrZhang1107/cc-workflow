---
description: "团队规划 - 基于研究结果生成任务计划，构建依赖图"
---

## 动作 (Actions)

**用途**: 将研究结果转化为可执行的任务计划，确保任务可并行执行。

### 触发场景
- 完成 team-research 后
- 需要将大任务拆分为子任务
- 准备并行实施

---

## 执行流程

### STEP 0: 加载研究结果

读取最新的研究结果：
```javascript
const research = loadResearch(projectPath, 'latest');
```

如果没有研究结果，提示先运行 `/llmdoc-ccw:team-research`。

### STEP 1: 任务拆分

基于研究结果，将任务拆分为独立的子任务：

**拆分原则**:
1. 每个任务有明确的文件范围
2. 文件范围不重叠（允许并行）
3. 如无法避免重叠，设为依赖关系
4. 每个任务有具体的实施步骤
5. 每个任务有可验证的验收标准

**任务类型分配**:
- 后端逻辑 → Codex
- 前端 UI → Gemini
- 配置/文档 → Gemini

### STEP 2: 构建依赖图

分析任务间的依赖关系：
- 数据依赖：Task B 需要 Task A 的输出
- 接口依赖：Task B 调用 Task A 创建的 API
- 文件依赖：Task B 修改 Task A 创建的文件

### STEP 3: 拓扑排序

将任务分层：
```
Layer 1 (并行): [Task A, Task B, Task C]  # 无依赖
Layer 2 (并行): [Task D, Task E]          # 依赖 Layer 1
Layer 3 (串行): [Task F]                  # 依赖 Layer 2
```

### STEP 4: 生成计划文件

```json
{
  "id": "plan-<timestamp>",
  "request": "<原始请求>",
  "tasks": [
    {
      "id": "task-1",
      "name": "实现用户 API",
      "type": "implement",
      "tool": "codex",
      "mode": "write",
      "scope": {
        "include": ["src/api/user.js", "src/models/user.js"],
        "exclude": []
      },
      "dependencies": [],
      "prompt": "详细的实施指令...",
      "acceptance": "API 返回正确的用户数据"
    }
  ],
  "layers": [["task-1", "task-2"], ["task-3"]],
  "createdAt": "<ISO timestamp>"
}
```

### STEP 5: 用户确认

展示计划摘要：
```
📋 执行计划

任务数: 5
并行层: 3
预计时间: ~10 分钟

Layer 1 (并行):
  - task-1: 实现用户 API (codex)
  - task-2: 创建用户组件 (gemini)

Layer 2 (并行):
  - task-3: 集成 API 和组件 (gemini)

Layer 3:
  - task-4: 添加测试 (codex)
  - task-5: 更新文档 (gemini)
```

使用 `AskUserQuestion` 确认是否执行。

---

## 输出

计划保存到: `~/.cc-workflow/projects/<id>/team/plans/<plan-id>.json`

提示用户：
```
✅ 计划生成完成

下一步: 运行 /llmdoc-ccw:team-exec 开始并行执行
或: llmdoc-ccw team --plan <plan-id> --phase exec
```
