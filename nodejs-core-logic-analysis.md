# CC-Workflow Node.js 脚本核心逻辑解析

整个项目包含 6 个核心 Node.js 脚本，按调用链从上到下逐个解析。

---

## 调用链总览

```
cli.js（入口分发）
  ├─ 'cli' 命令 → cli-executor.js（单次子进程执行）
  │                  └─ cli-output-converter.js（流式 JSON 解析）
  │
  └─ 'team' 命令 → team-orchestrator.js（四阶段编排）
                      ├─ parallel-executor.js（信号量并发 + 分层执行）
                      │    └─ cli-executor.js
                      ├─ task-graph.js（DAG 拓扑排序）
                      ├─ cli-state.js（单次执行持久化）
                      └─ team-state.js（团队执行持久化）
```

---

## 1. cli.js — 入口分发器

**文件**: `src/cli.js`

核心逻辑就一件事：解析命令行参数，分发到对应处理函数。

```
用户输入 → parseArgs() → switch(command)
                            ├─ 'cli'  → runCli()    → 单次调用 executeCli()
                            ├─ 'team' → runTeam()   → 创建 TeamOrchestrator 跑四阶段
                            ├─ 'history'      → 读 JSON 打印表格
                            └─ 'team-history' → 读 JSON 打印表格
```

`parseArgs()` 是一个手写的参数解析器，遍历 `args` 数组，通过 switch-case 识别 `-p`、`--tool`、`--mode`、`--phase` 等标志位，将结果收集到一个 options 对象中。

`runCli()` 和 `runTeam()` 的区别：

- `runCli()` — 直接调一次 `executeCli()`，通过 `onOutput` 回调实时打印子 CLI 的流式输出（`agent_message`、`thought`、`tool_call`）
- `runTeam()` — 实例化 `TeamOrchestrator`，注入 `onPhaseStart` / `onPhaseComplete` 回调用于打印阶段进度，然后调用 `orchestrator.run()` 走完整四阶段流水线

---

## 2. cli-executor.js — 子进程执行引擎

**文件**: `src/tools/cli-executor.js`

这是整个系统最底层的核心，负责通过 `child_process.spawn` 创建子进程并管理其生命周期。做三件事：

### 2.1 构建命令 — `buildCommand()`

根据 tool 类型拼出不同的 CLI 参数：

| tool | 实际命令 | 输出格式参数 | write 模式参数 | 输入方式 |
|------|---------|-------------|---------------|---------|
| gemini | `gemini` | `-o stream-json` | `--approval-mode yolo` | stdin |
| qwen | `qwen` | `-o stream-json` | `--approval-mode yolo` | stdin |
| codex | `codex exec` | `--json` | `--dangerously-bypass-approvals-and-sandbox` | stdin |

关键细节：
- Gemini/Qwen 的 write 模式用 `--approval-mode yolo` 跳过确认
- Codex 需要 `exec` 子命令进入非交互模式，analysis 模式用 `--full-auto`
- 三个工具都通过 stdin 接收 prompt

### 2.2 执行子进程 — `executeCli()`

这是核心函数，完整流程：

```
1. buildCommand() 拼出命令和参数
2. spawn(command, args, { stdio: ['pipe','pipe','pipe'] })
3. child.stdin.write(prompt) → child.stdin.end()    // prompt 通过 stdin 写入
4. child.stdout.on('data') → parser.parse(chunk)    // 实时流式解析
   → outputUnits.push(...units)                     // 收集所有 IR 单元
   → onOutput(unit)                                 // 回调上报
5. child.stderr.on('data') → 同上
6. child.on('close', code)
   → parser.flush()                                 // 刷出缓冲区残留
   → status = code === 0 ? 'success' : 'error'      // exit code 判定
   → extractAgentMessage(outputUnits)                // 提取最终回复
   → saveExecution(workingDir, result)               // 持久化
   → resolve(result)
7. child.on('error') → reject(err)                  // 进程启动失败
```

核心设计：prompt 通过 stdin 管道输入，结果通过 stdout 管道流式输出。不是 HTTP API 调用，是纯进程间管道通信。

### 2.3 提取最终消息 — `extractAgentMessage()`

按优先级从 IR 单元中提取最终回复：

```
agent_message（完整回复）> streaming_content（流式增量拼接）> stdout（原始输出）
```

### 2.4 进程清理 — `killCurrentProcess()`

两阶段终止：先 SIGTERM 优雅退出，等待2 秒后 SIGKILL 强杀。通过模块级变量 `currentChildProcess` 追踪当前子进程。

---

## 3. cli-output-converter.js — 流式 JSON 解析器

**文件**: `src/tools/cli-output-converter.js`

核心逻辑是一个带缓冲区的换行分隔 JSON 解析器（`JsonLinesParser`），将不同 CLI 工具的异构输出统一转换为 IR（中间表示），写入到json。

解决的核心问题：子进程的 stdout 是字节流，不是按行传输的，一行 JSON 可能被切成两个 chunk。buffer 就是用来解决这个问题的——lines.pop() 把最后一个可能不完整的行暂存，等下一个 chunk来了拼上去，就变成完整的 JSON 了。

### 3.1 流式解析机制 — `parse()`

```javascript
parse(chunk) {
  this.buffer += chunk.toString();       // 追加到缓冲区
  const lines = this.buffer.split('\n'); // 按换行切分
  this.buffer = lines.pop();             // 最后一行可能不完整，留在缓冲区

  for (const line of lines) {
    try {
      parsed = JSON.parse(line);
      return this.mapJsonToIR(parsed);   // JSON → 统一 IR
    } catch {
      return this.classifyContent(line); // 非 JSON → 按正则分类
    }
  }
}
```

关键点：`lines.pop()` 把最后一个可能不完整的行留在 buffer 里，等下一个 chunk 到来时拼接。`flush()` 在进程退出时处理 buffer 中的残留数据。

### 3.2 JSON → IR 映射 — `mapJsonToIR()`

一个大型 if-else 映射表，处理两套协议：

**Gemini/Qwen 的 stream-json 格式：**

| 原始 JSON | IR 类型 | 含义 |
|-----------|---------|------|
| `{"type":"init","session_id":"..."}` | `metadata` | 会话初始化，包含 session ID 和模型名 |
| `{"type":"message","role":"assistant","delta":true}` | `streaming_content` | 流式增量内容 |
| `{"type":"message","role":"assistant"}` | `agent_message` | 完整回复 |
| `{"type":"tool_use","tool_name":"..."}` | `tool_call` (invoke) | 工具调用请求 |
| `{"type":"tool_result","tool_id":"..."}` | `tool_call` (result) | 工具调用结果 |
| `{"type":"result","stats":{...}}` | `metadata` | 执行统计信息 |

**Codex 的 json-lines 格式：**

| 原始 JSON | IR 类型 | 含义 |
|-----------|---------|------|
| `{"type":"thread.started","thread_id":"..."}` | `metadata` | 线程启动 |
| `{"type":"item.completed","item":{"type":"agent_message"}}` | `agent_message` | 完整回复 |
| `{"type":"item.completed","item":{"type":"reasoning"}}` | `thought` | 推理过程 |
| `{"type":"item.completed","item":{"type":"command_execution"}}` | `tool_call` | 命令执行结果 |
| `{"type":"turn.completed","usage":{...}}` | `metadata` | token 用量 |

### 3.3 非 JSON 内容分类 — `classifyContent()`

对无法解析为 JSON 的行，通过正则模式匹配分类：

- 匹配 `Loading.../Initializing/Connecting/Using model` → `progress`（进度信息，最终会被过滤）
- 匹配 `ERROR/FAILED/error:/fatal:` 且来自 stderr → `stderr`
- 其余 → `stdout`

### 3.4 工厂函数 — `createOutputParser()`

```javascript
switch (tool) {
  case 'gemini':
  case 'qwen':
  case 'codex':
    return new JsonLinesParser(tool);  // 已知工具用 JSON 解析器
  default:
    return new PlainTextParser();      // 未知工具用纯文本包装
}
```

---

## 4. team-orchestrator.js — 四阶段编排器

**文件**: `src/team/team-orchestrator.js`

核心逻辑是 `run()` 方法的四阶段串行流水线，每个阶段内部可能并行。

### 4.1 主流程 — `run()`

```
run(request)
  │
  ├─ request.phase 存在？→ runSinglePhase()  // 只跑单个阶段
  │
  └─ 完整流水线：
      ├─ Phase 1: runResearch(prompt)
      │    → saveResearch()
      ├─ Phase 2: runPlan(researchResult)
      │    → savePlan()
      ├─ Phase 3: runExec(planResult)
      └─ Phase 4: runReview(execResult)
      │
      └─ saveTeamExecution(result)  // 持久化完整结果
```

外层 try-catch 捕获所有异常，记录 `failedPhase`（在哪个阶段失败）并持久化，然后 re-throw。

### 4.2 Research 阶段 — `runResearch()`

并行调两个子 CLI 做领域分析：

```javascript
backendTask  = { tool: 'codex',  prompt: buildResearchPrompt(prompt, 'backend') }
frontendTask = { tool: 'gemini', prompt: buildResearchPrompt(prompt, 'frontend') }

results = await executor.executeDual(backendTask, frontendTask);
return mergeResearchResults(results);
```

`buildResearchPrompt()` 按领域定制提示词：
- backend → 关注 `src/**/*.js, api/**/*.js, *.config.js`
- frontend → 关注 `components/**/*.*, pages/**/*.*, app/**/*.*`

`mergeResearchResults()` 从两个结果中提取 `output.agentMessage` 作为分析摘要。

### 4.3 Plan 阶段 — `runPlan()`

单次调 Gemini 生成 JSON 任务计划：

```javascript
// 1. 构建规划提示词（包含 Research 阶段的合并结果）
planPrompt = buildPlanPrompt(researchResult);

// 2. 调用 Gemini
result = await executeCli({ tool: 'gemini', prompt: planPrompt });

// 3. 从回复中提取 JSON
jsonMatch = planText.match(/```json\s*([\s\S]*?)\s*```/);
tasks = JSON.parse(jsonMatch[1]).tasks;

// 4. 构建 DAG，拓扑排序
taskGraph = new TaskGraph();
tasks.forEach(t => taskGraph.addTask(t));
layers = taskGraph.getExecutionLayers();
```

`buildPlanPrompt()` 要求 Gemini 返回的 JSON 结构：

```json
{
  "tasks": [{
    "id": "task-1",
    "tool": "codex|gemini",
    "mode": "write",
    "scope": { "include": ["src/api/**/*.js"], "exclude": [] },
    "dependencies": [],
    "prompt": "详细实现指令...",
    "acceptance": "验收标准"
  }]
}
```

降级策略：如果 JSON 解析失败，将整个回复文本作为单个任务的 prompt，生成一个 fallback 单任务计划。

### 4.4 Exec 阶段 — `runExec()`

```javascript
taskMap = new Map(plan.tasks.map(t => [t.id, t]));
results = await executor.executeByLayers(plan.layers, taskMap, {
  onTaskStart:    (task) => taskGraph.updateTaskStatus(task.id, 'running'),
  onTaskComplete: (task, result, error) => {
    taskGraph.updateTaskStatus(task.id, error ? 'failed' : 'completed', ...);
  }
});
summary = taskGraph.getStatusSummary();  // { completed, failed, skipped }
```

### 4.5 Review 阶段 — `runReview()`

与 Research 结构相同，并行调 Codex + Gemini 做交叉审查。`mergeReviewResults()` 通过简单的关键词匹配（`Critical`/`Warning`）从审查文本中提取问题分级。

### 4.6 阶段间数据传递

关键设计：阶段间的数据传递本质上是"把上一阶段的 JSON 结果序列化到下一阶段的 prompt 文本里"。

```
Research 结果（JSON）
  → 序列化为 planPrompt 的一部分（自然语言 + 结构化数据）
    → Gemini 读取并生成 Plan（JSON）
      → 反序列化为 TaskGraph
        → 每个 task.prompt 传给对应子 CLI
```

---

## 5. parallel-executor.js — 并发执行器

**文件**: `src/team/parallel-executor.js`

两个核心机制：

### 5.1 信号量 — `Semaphore`

```javascript
class Semaphore {
  constructor(max) {
    this.max = max;        // 最大并发数，默认 4
    this.current = 0;      // 当前占用数
    this.queue = [];       // 等待队列
  }

  acquire() {
    return new Promise(resolve => {
      const tryAcquire = () => {
        if (this.current < this.max) {
          this.current++;
          resolve(release);           // 有空位，立即获取，返回释放函数
        } else {
          this.queue.push(tryAcquire); // 没空位，排队等待
        }
      };
      tryAcquire();
    });
  }
}
```

每个任务执行前 `acquire()` 获取令牌，执行完调用 `release()` 释放。release 时如果队列非空，自动唤醒下一个等待者。

### 5.2 并行执行 — `executeParallel()`

```javascript
for (const task of tasks) {
  const promise = semaphore.acquire().then(async (release) => {
    try {
      return await this.executeTask(task, callbacks);
    } finally {
      release();  // 无论成功失败都释放令牌
    }
  });

  // 关键：将 Promise 包装为 settled 结果，防止单个失败导致 Promise.all 拒绝
  allPromises.push(promise.then(
    result => ({ taskId: task.id, status: 'fulfilled', result, error: null }),
    error  => ({ taskId: task.id, status: 'rejected',  result: null, error })
  ));
}

return Promise.all(allPromises);  // 永远 resolve，不会 reject
```

### 5.3 分层执行 + 失败传播 — `executeByLayers()`

```javascript
async executeByLayers(layers, taskMap) {
  const failedTasks = new Set();

  for (const layer of layers) {
    const executableTasks = [];

    // 1. 检查依赖，跳过失败任务的下游
    for (const taskId of layer) {
      const deps = task.dependencies || [];
      const hasFailedDep = deps.some(depId => failedTasks.has(depId));

      if (hasFailedDep) {
        allResults.push({ taskId, status: 'rejected', skipped: true });
        failedTasks.add(taskId);  // 传播：被跳过的任务也加入失败集合
      } else {
        executableTasks.push(task);
      }
    }

    // 2. 同层任务并行执行（受 Semaphore 控制）
    const layerResults = await this.executeParallel(executableTasks);

    // 3. 收集新的失败
    for (const result of layerResults) {
      if (result.status === 'rejected' || result.result?.status === 'error') {
        failedTasks.add(result.taskId);
      }
    }
  }
}
```

核心思想：层间串行保证依赖顺序，层内并行最大化吞吐，失败通过 Set 向下游传播。

### 5.4 双任务快捷方法 — `executeDual()`

Research 和 Review 阶段的常用模式，本质就是 `executeParallel([task1, task2])` 的语法糖。

---

## 6. task-graph.js — DAG 依赖图

**文件**: `src/team/task-graph.js`

### 6.1 数据结构

```javascript
class TaskGraph {
  tasks = new Map();        // taskId → Task 对象
  dependencies = new Map(); // taskId → Set<依赖的 taskId>
  dependents = new Map();   // taskId → Set<依赖此任务的 taskId>（反向索引）
}
```

每个 Task 对象包含：`id, type, tool, prompt, mode, scope, dependencies, status, result`。

### 6.2 拓扑排序 — `getExecutionLayers()`

这是整个依赖调度的核心算法：

```javascript
getExecutionLayers() {
  const layers = [];
  const completed = new Set();
  const remaining = new Set(this.tasks.keys());

  while (remaining.size > 0) {
    const layer = [];

    for (const taskId of remaining) {
      const deps = this.dependencies.get(taskId);
      // 所有依赖都已"完成" → 加入当前层
      if ([...deps].every(d => completed.has(d))) {
        layer.push(taskId);
      }
    }

    // 找不到任何可执行任务 → 存在循环依赖
    if (layer.length === 0) {
      const cycle = this.findCycle(remaining);
      throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
    }

    layers.push(layer);
    layer.forEach(id => {
      remaining.delete(id);
      completed.add(id);
    });
  }

  return layers;  // [[layer0_tasks], [layer1_tasks], ...]
}
```

每轮迭代找出所有依赖已满足的任务组成一层，直到所有任务分完。时间复杂度 O(V × E)。

### 6.3 循环依赖检测 — `findCycle()`

当拓扑排序卡住时（某轮找不到任何可执行任务），用 DFS 在剩余节点中找到具体的环路，用于错误报告：

```javascript
findCycle(remaining) {
  const path = [];
  const dfs = (taskId) => {
    if (path.includes(taskId)) {
      return [...path.slice(path.indexOf(taskId)), taskId];  // 找到环
    }
    path.push(taskId);
    for (const dep of this.dependencies.get(taskId)) {
      if (remaining.has(dep)) {
        const cycle = dfs(dep);
        if (cycle) return cycle;
      }
    }
    path.pop();
    return null;
  };
  // 从每个剩余节点尝试 DFS
  for (const taskId of remaining) {
    const cycle = dfs(taskId);
    if (cycle) return cycle;
  }
}
```

### 6.4 文件范围冲突检测 — `hasConflict()`

检查两个 write 模式任务的 glob 范围是否重叠，防止并行写入同一文件：

```javascript
hasConflict(task1Id, task2Id) {
  if (t1.mode !== 'write' || t2.mode !== 'write') return false;  // 只检查写任务
  return this.scopesOverlap(t1.scope, t2.scope);
}

patternsOverlap(p1, p2) {
  if (p1 === p2) return true;                    // 完全相同
  if (都含 ** && 根目录相同) return true;          // 通配符根目录重叠
  if (目录路径互为前缀) return true;               // 目录包含关系
  return false;
}
```

这是一个启发式检测，不是精确的 glob 匹配，但对常见模式足够用。

---

## 7. cli-state.js / team-state.js — 文件持久化

**文件**: `src/tools/cli-state.js` 和 `src/team/team-state.js`

两个文件逻辑相似，都是基于文件系统的 JSON 持久化。

### 7.1 项目 ID 生成

将项目路径转换为安全的文件夹名：

```javascript
// cli-state.js
function pathToFolderId(projectPath) {
  const normalized = resolve(projectPath).toLowerCase().replace(/\\/g, '/');
  if (normalized.length > 80) {
    // 长路径：截断 + SHA256 哈希后缀
    return normalized.substring(0, 70).replace(/[<>:"|?*\/]/g, '-') + '_' + hash;
  }
  // 短路径：直接替换特殊字符
  return normalized.replace(/^([a-z]):\/*/i, '$1--').replace(/\/+/g, '-');
}

// team-state.js
function pathToFolderId(projectPath) {
  const hash = createHash('md5').update(projectPath).digest('hex').slice(0, 8);
  const name = basename(projectPath).replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${name}-${hash}`;  // 项目名 + MD5 前 8 位
}
```

### 7.2 存储结构

```
~/.cc-workflow/projects/<projectId>/
  ├─ history.json          # 索引：最近 100 条单次执行记录
  ├─ sessions/
  │   └─ <executionId>.json  # 单次执行完整详情
  └─ team/
      ├─ executions.json     # 索引：最近 50 条团队执行记录
      ├─ plans/
      │   ├─ <planId>.json   # 执行计划
      │   └─ latest.json     # 最新计划的副本（快捷引用）
      └─ reports/
          ├─ <execId>.json           # 完整执行报告
          └─ <execId>-research.json  # 研究阶段结果
```

### 7.3 核心操作

- `saveExecution()` — 写入索引 + 详情文件，索引保留最近 100 条
- `savePlan()` — 写入计划文件 + 同步更新 `latest.json`
- `loadPlan(id)` — 支持传 `'latest'` 加载最新计划
- `saveTeamExecution()` — 写入报告 + 更新索引，索引保留最近 50 条

所有读操作都有 try-catch 降级：文件不存在或 JSON 解析失败时返回空结构 `{ executions: [], version: 1 }`。

---

## 核心逻辑链条总结

```
cli.js 解析参数
  → team-orchestrator.js 按四阶段编排
    → parallel-executor.js 用信号量 + 拓扑分层控制并发
      → cli-executor.js 用 spawn 创建子进程，通过 stdin/stdout 管道通信
        → cli-output-converter.js 把不同 CLI 的流式 JSON 输出统一解析为 IR
```

数据在阶段间的传递方式：把上一阶段的结构化结果序列化进下一阶段的 prompt 文本。

整个系统没有用任何 HTTP 服务、消息队列或数据库，纯粹依赖：
- **OS 进程**（spawn）做隔离执行
- **stdio 管道**做进程间通信
- **JSON 文件**做状态持久化
- **自然语言 prompt**做阶段间数据传递
