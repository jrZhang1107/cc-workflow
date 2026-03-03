# Agent Team 架构详解

## 概述

Agent Team 是 cc-workflow 的多 CLI 协作功能，通过任务图（Task Graph）和并行执行器（Parallel Executor）实现多个 AI CLI 工具（Gemini、Codex、Qwen）的协作执行。

---

## 1. 四阶段工作流

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Research   │ ──► │    Plan     │ ──► │    Exec     │ ──► │   Review    │
│  (并行分析)  │     │  (任务规划)  │     │  (并行执行)  │     │  (交叉审查)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

| 阶段 | 目的 | 工具分配 | 输出 |
|------|------|----------|------|
| **Research** | 并行分析代码库 | Codex(后端) + Gemini(前端) | 约束集、依赖关系、风险评估 |
| **Plan** | 任务拆分与依赖规划 | Gemini | 任务列表 + 执行层 |
| **Exec** | 分层并行执行 | 按任务分配 | 代码变更 |
| **Review** | 双模型交叉审查 | Codex + Gemini | 问题报告 (Critical/Warning/Info) |

---

## 2. 核心组件架构

```
┌──────────────────────────────────────────────────────────────┐
│                    TeamOrchestrator                          │
│  (src/team/team-orchestrator.js)                            │
│  - 协调四阶段工作流                                           │
│  - 管理上下文和回调                                           │
└─────────────────────────┬────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   TaskGraph     │ │ ParallelExecutor│ │   TeamState     │
│ (task-graph.js) │ │(parallel-exec..)│ │ (team-state.js) │
│                 │ │                 │ │                 │
│ - 任务依赖管理   │ │ - 并发控制      │ │ - 状态持久化    │
│ - 拓扑排序      │ │ - 多CLI执行     │ │ - 计划/报告存储  │
│ - 冲突检测      │ │ - 失败处理      │ │ - 执行历史      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 3. 任务图 (TaskGraph)

### 3.1 任务数据结构

```typescript
interface Task {
  id: string;                          // 唯一标识，如 "task-1"
  type: 'research' | 'implement' | 'review';
  tool: 'gemini' | 'codex' | 'qwen';   // 执行工具
  mode: 'analysis' | 'write';          // 分析模式或写入模式
  prompt: string;                      // 任务提示词
  scope: {
    include: string[];                 // 允许修改的文件 glob 模式
    exclude: string[];                 // 排除的文件
  };
  dependencies: string[];              // 依赖的任务 ID
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result: object | null;
}
```

### 3.2 依赖管理

TaskGraph 维护两个映射：

```javascript
// 正向映射：任务 -> 它依赖的任务
this.dependencies = Map<taskId, Set<dependsOnTaskId>>

// 反向映射：任务 -> 依赖它的任务（用于快速查找下游任务）
this.dependents = Map<taskId, Set<dependentTaskId>>
```

**示例**：
```
Task C 依赖 Task A 和 Task B

dependencies:
  "task-c" → ["task-a", "task-b"]

dependents:
  "task-a" → ["task-c"]
  "task-b" → ["task-c"]
```

### 3.3 拓扑排序算法

`getExecutionLayers()` 方法将任务分层，同层任务可并行执行：

```javascript
getExecutionLayers() {
  const layers = [];
  const completed = new Set();
  const remaining = new Set(所有任务ID);

  while (remaining.size > 0) {
    const layer = [];

    for (const taskId of remaining) {
      const deps = this.dependencies.get(taskId);
      // 如果所有依赖都已完成，加入当前层
      if (deps.every(d => completed.has(d))) {
        layer.push(taskId);
      }
    }

    if (layer.length === 0) {
      throw new Error('检测到循环依赖');
    }

    layers.push(layer);
    layer.forEach(id => {
      remaining.delete(id);
      completed.add(id);
    });
  }

  return layers;
}
```

**可视化示例**：

```
原始任务和依赖：
  Task A (无依赖)
  Task B (无依赖)
  Task C (依赖 A, B)
  Task D (依赖 C)
  Task E (依赖 A)

拓扑排序结果：
  Layer 1: [A, B]     ← 无依赖，可并行
  Layer 2: [C, E]     ← C等A,B完成；E等A完成，可并行
  Layer 3: [D]        ← 等C完成
```

---

## 4. 并行/串行决策规则

### 4.1 决策流程

```
┌─────────────────────────────────────────────────────┐
│           任务可否并行执行决策树                      │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ 是否有依赖关系？  │
              └────────┬─────────┘
                 │           │
              Yes│           │No
                 ▼           ▼
          ┌──────────┐  ┌────────────────┐
          │ 必须串行  │  │ 检查文件范围    │
          └──────────┘  └───────┬────────┘
                                │
                   ┌────────────┴────────────┐
                   │                         │
                   ▼                         ▼
            ┌────────────┐            ┌────────────┐
            │ 范围重叠？  │            │ 范围不重叠  │
            └─────┬──────┘            └─────┬──────┘
                  │                         │
               Yes│                         │No
                  ▼                         ▼
            ┌──────────┐            ┌────────────┐
            │ 设为依赖  │            │ 可以并行    │
            │ (串行)   │            └────────────┘
            └──────────┘
```

### 4.2 依赖类型

在 Plan 阶段识别以下依赖类型：

| 依赖类型 | 说明 | 示例 |
|---------|------|------|
| **数据依赖** | Task B 需要 Task A 的输出 | A 创建数据模型，B 使用该模型 |
| **接口依赖** | Task B 调用 Task A 创建的 API | A 实现 `/api/user`，B 调用该 API |
| **文件依赖** | Task B 修改 Task A 创建的文件 | A 创建 `utils.js`，B 向其添加函数 |

### 4.3 文件范围冲突检测

`hasConflict()` 和 `scopesOverlap()` 方法检测两个任务是否可能修改相同文件：

```javascript
// 只有 write 模式的任务需要检查冲突
hasConflict(task1Id, task2Id) {
  const t1 = this.tasks.get(task1Id);
  const t2 = this.tasks.get(task2Id);

  // 只有都是写操作才需要检查
  if (t1.mode !== 'write' || t2.mode !== 'write') {
    return false;
  }

  return this.scopesOverlap(t1.scope, t2.scope);
}

// 检查 glob 模式是否重叠
scopesOverlap(scope1, scope2) {
  for (const pattern1 of scope1.include) {
    for (const pattern2 of scope2.include) {
      if (this.patternsOverlap(pattern1, pattern2)) {
        return true;
      }
    }
  }
  return false;
}
```

**范围隔离示例**：

```
✅ 可并行（无重叠）：
  Task A: src/api/**/*.js
  Task B: src/components/**/*.jsx

❌ 不可并行（有重叠）：
  Task A: src/**/*.js
  Task B: src/api/user.js     ← 被 Task A 的模式覆盖

解决方案：将 Task B 设为依赖 Task A
```

---

## 5. 并行执行器 (ParallelExecutor)

### 5.1 并发控制 - Semaphore

使用信号量控制最大并发数：

```javascript
class Semaphore {
  constructor(max) {
    this.max = max;        // 最大并发数
    this.current = 0;      // 当前运行数
    this.queue = [];       // 等待队列
  }

  acquire() {
    return new Promise(resolve => {
      const tryAcquire = () => {
        if (this.current < this.max) {
          this.current++;
          resolve(() => {           // 返回释放函数
            this.current--;
            if (this.queue.length > 0) {
              const next = this.queue.shift();
              next();               // 唤醒下一个等待者
            }
          });
        } else {
          this.queue.push(tryAcquire);  // 加入等待队列
        }
      };
      tryAcquire();
    });
  }
}
```

### 5.2 分层执行流程

```javascript
async executeByLayers(layers, taskMap, options) {
  const allResults = [];
  const failedTasks = new Set();

  for (const layer of layers) {
    console.log(`📦 Layer ${i}/${layers.length}`);

    const executableTasks = [];

    for (const taskId of layer) {
      const task = taskMap.get(taskId);

      // 检查依赖是否失败
      const hasFailedDep = task.dependencies.some(
        depId => failedTasks.has(depId)
      );

      if (hasFailedDep) {
        // 跳过此任务
        console.log(`⏭️ Skipping ${taskId} (dependency failed)`);
        failedTasks.add(taskId);
      } else {
        executableTasks.push(task);
      }
    }

    // 并行执行当前层的所有可执行任务
    const layerResults = await this.executeParallel(executableTasks);

    // 记录失败任务
    for (const result of layerResults) {
      if (result.status === 'rejected') {
        failedTasks.add(result.taskId);
      }
    }
  }

  return allResults;
}
```

### 5.3 双模型执行模式

`executeDual()` 方法专门用于 Research 和 Review 阶段的双模型并行：

```javascript
async executeDual(task1, task2, options) {
  // task1: Codex 分析后端
  // task2: Gemini 分析前端
  const results = await this.executeParallel([task1, task2], options);

  return {
    task1: results.find(r => r.taskId === task1.id),
    task2: results.find(r => r.taskId === task2.id)
  };
}
```

---

## 6. 状态管理 (TeamState)

### 6.1 存储结构

```
~/.cc-workflow/
└── projects/
    └── <project-name>-<hash>/
        └── team/
            ├── executions.json     # 执行历史索引
            ├── plans/
            │   ├── latest.json     # 最新计划
            │   └── <plan-id>.json  # 历史计划
            └── reports/
                ├── <exec-id>.json           # 执行报告
                └── <exec-id>-research.json  # 研究结果
```

### 6.2 项目标识

使用路径哈希生成唯一项目 ID：

```javascript
function pathToFolderId(projectPath) {
  const hash = crypto.createHash('md5')
    .update(projectPath)
    .digest('hex')
    .slice(0, 8);
  const name = path.basename(projectPath);
  return `${name}-${hash}`;  // 如: "my-project-a1b2c3d4"
}
```

### 6.3 状态持久化 API

| 函数 | 用途 |
|------|------|
| `saveTeamExecution()` | 保存执行记录到索引和详情文件 |
| `loadTeamExecutions()` | 加载执行历史索引 |
| `savePlan()` | 保存计划（同时更新 latest.json） |
| `loadPlan()` | 加载计划（支持 'latest' 或具体 ID） |
| `saveResearch()` | 保存研究阶段结果 |
| `getLatestExecution()` | 获取最近一次执行的完整数据 |

---

## 7. 多 CLI 交互机制

### 7.1 CLI 调用流程

```
┌─────────────────┐
│ ParallelExecutor│
└────────┬────────┘
         │ executeCli()
         ▼
┌─────────────────┐      ┌─────────────┐
│  cli-executor   │ ───► │ gemini CLI  │
│  (统一接口)      │      └─────────────┘
│                 │      ┌─────────────┐
│                 │ ───► │ codex CLI   │
│                 │      └─────────────┘
│                 │      ┌─────────────┐
│                 │ ───► │ qwen CLI    │
└─────────────────┘      └─────────────┘
```

### 7.2 任务分配策略

| 领域 | 推荐工具 | 原因 |
|------|---------|------|
| 后端逻辑、API、数据模型 | **Codex** | 擅长复杂逻辑和算法 |
| 前端 UI、组件、样式 | **Gemini** | 擅长设计和用户体验 |
| 配置、文档、简单任务 | **Gemini** | 通用性强 |

### 7.3 任务模板

每个 Builder 接收的任务格式：

```markdown
## 你的任务
<task.name>
<task.prompt>

## 文件范围约束（⛔ 硬性规则）
你只能创建或修改以下文件：
- src/api/user.js
- src/models/user.js
严禁修改任何其他文件。

## 验收标准
<task.acceptance>
```

---

## 8. 错误处理与失败传播

### 8.1 任务状态流转

```
pending ──► running ──► completed
              │
              └──► failed

pending ──► skipped (依赖失败时)
```

### 8.2 失败传播机制

```javascript
shouldSkipTask(taskId) {
  const deps = this.dependencies.get(taskId);
  const failedDeps = [];

  for (const depId of deps) {
    const depTask = this.tasks.get(depId);
    if (depTask.status === 'failed' || depTask.status === 'skipped') {
      failedDeps.push(depId);
    }
  }

  if (failedDeps.length > 0) {
    return {
      skip: true,
      reason: `Skipped due to failed dependencies: ${failedDeps.join(', ')}`
    };
  }

  return { skip: false };
}
```

**传播示例**：

```
执行顺序：
Layer 1: [A, B]  → A ✅, B ❌
Layer 2: [C, D]  → C ⏭️ (依赖B), D ✅ (依赖A)
Layer 3: [E]     → E ⏭️ (依赖C)

结果：
- B 失败导致 C 被跳过
- C 被跳过导致 E 被跳过
- A 和 D 不受影响
```

---

## 9. 使用方式

### 9.1 CLI 命令

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

### 9.2 Claude Code 命令

```
/llmdoc-ccw:team-research   # 并行分析
/llmdoc-ccw:team-plan       # 生成计划
/llmdoc-ccw:team-exec       # 执行计划
/llmdoc-ccw:team-review     # 审查结果
```

### 9.3 编程接口

```javascript
import { TeamOrchestrator } from './src/team/team-orchestrator.js';

const orchestrator = new TeamOrchestrator({
  workingDir: process.cwd(),
  maxConcurrency: 4,
  verbose: true,
  onPhaseStart: (phase) => console.log(`Starting ${phase}...`),
  onTaskComplete: (task, result) => console.log(`${task.id} done`)
});

// 完整工作流
const result = await orchestrator.run({
  prompt: "实现用户认证功能"
});

// 单独阶段
const research = await orchestrator.runSinglePhase('research', {
  prompt: "分析认证需求"
});
```

---

## 10. 最佳实践

1. **先 Research**：复杂任务先分析，避免盲目实施
2. **检查计划**：执行前确认任务拆分合理，文件范围不重叠
3. **处理 Critical**：Review 发现的严重问题必须修复后再继续
4. **保持隔离**：确保并行任务文件范围不重叠
5. **小步迭代**：大任务拆分为多次小的 team 工作流执行
