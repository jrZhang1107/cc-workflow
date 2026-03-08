# Prompt驱动的四阶段多CLI工作流设计分析

## 概述

本文档分析 `cc-workflow` 项目中**基于prompt驱动的四阶段多CLI工作流**的完整设计。与传统的命令行驱动方式不同，这里的核心是**文档化命令系统**（llmdoc-ccw commands），通过大模型解读Markdown文档来驱动整个工作流。

---

## 核心架构对比

### 传统命令行驱动 vs Prompt驱动

| 维度 | 传统命令行驱动 | Prompt驱动（本项目） |
|------|---------------|-------------------|
| **命令定义** | 代码中的函数/类 | Markdown文档 |
| **执行引擎** | Shell解释器 | 大模型（Claude/Gemini等） |
| **输入方式** | 命令行参数 + 选项 | 自然语言 + 上下文 |
| **灵活性** | 固定的参数解析逻辑 | 大模型理解意图并适配 |
| **扩展性** | 需要修改代码 | 只需添加/修改文档 |

---

## 完整数据流

### 用户输入到输出的全链路

```
┌─────────────────────────────────────────────────────────────────┐
│ 用户在 Claude Code 中输入: /llmdoc-ccw:team-research              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Claude Code 识别斜杠命令                                 │
│                                                                  │
│ • 解析格式: /<plugin-name>:<command-name>                       │
│ • plugin-name: llmdoc-ccw                                       │
│ • command-name: team-research                                   │
│ • 加载命令文档: llmdoc-ccw/commands/team-research.md            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: 大模型解读命令文档                                       │
│                                                                  │
│ 读取 team-research.md 的内容：                                   │
│ ---                                                              │
│ description: "团队研究 - 多 CLI 并行分析代码库"                   │
│ ---                                                              │
│ ## 执行流程                                                      │
│ ### STEP 0: 需求增强                                             │
│ ### STEP 1: 并行分析                                             │
│   llmdoc-ccw cli -p "<后端分析提示词>" --tool codex              │
│   llmdoc-ccw cli -p "<前端分析提示词>" --tool gemini             │
│ ### STEP 2: 结果聚合                                             │
│ ### STEP 3: 用户确认                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: 大模型执行文档中的指令                                    │
│                                                                  │
│ • 理解需要执行的操作                                              │
│ • 构建具体的提示词                                                │
│ • 准备调用 Bash 工具执行 CLI 命令                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: 调用 Node.js CLI 工具                                    │
│                                                                  │
│ Bash 工具执行实际命令：                                           │
│   llmdoc-ccw cli -p "..." --tool codex --mode analysis          │
│   llmdoc-ccw cli -p "..." --tool gemini --mode analysis         │
│                                                                  │
│ ↓ 进入 Node.js 层（src/cli.js）                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Node.js 处理（传统命令行逻辑）                            │
│                                                                  │
│ src/cli.js                                                       │
│   → parseArgs() 解析命令行参数                                    │
│   → switch('cli') → runCli()                                     │
│   → executeCli({ tool, prompt, mode })                           │
│                                                                  │
│ src/tools/cli-executor.js                                        │
│   → buildCommand() 构建子进程命令                                 │
│   → spawn('codex', ['exec', '--json', ...])                      │
│   → child.stdin.write(prompt)                                    │
│   → 流式解析 stdout                                              │
│                                                                  │
│ src/tools/cli-output-converter.js                                │
│   → JsonLinesParser 解析流式输出                                  │
│   → mapJsonToIR() 转换为统一格式                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: 结果返回给大模型                                         │
│                                                                  │
│ • Node.js CLI 返回结构化结果（JSON）                              │
│ • 大模型接收两个分析结果（Codex + Gemini）                        │
│ • 按照 team-research.md 中的 STEP 2 聚合结果                      │
│ • 按照 STEP 3 使用 AskUserQuestion 与用户确认                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: 大模型输出最终结果                                       │
│                                                                  │
│ ## 约束集                                                        │
│ ### 硬约束                                                       │
│ - [HC-1] <约束描述>                                              │
│ ### 依赖关系                                                     │
│ - [DEP-1] <模块A> → <模块B>                                      │
│                                                                  │
│ ✅ 研究阶段完成                                                   │
│ 下一步: 运行 /llmdoc-ccw:team-plan 生成执行计划                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 详细分层分析

### Layer 1: 文档化命令层（Prompt驱动）

#### 1.1 命令文档结构

每个命令都是一个Markdown文件，位于 `llmdoc-ccw/commands/` 目录：

```
llmdoc-ccw/commands/
├── team-research.md    # 定义 research 阶段的行为
├── team-plan.md        # 定义 plan 阶段的行为
├── team-exec.md        # 定义 exec 阶段的行为
└── team-review.md      # 定义 review 阶段的行为
```

#### 1.2 命令文档格式

以 `team-research.md` 为例：

```markdown
---
description: "团队研究 - 多 CLI 并行分析代码库，生成约束集和依赖关系"
---

## 动作 (Actions)

**用途**: 在实施复杂任务前，使用多个 CLI 工具并行分析代码库。

## 执行流程

### STEP 0: 需求增强
分析用户请求，补全缺失信息...

### STEP 1: 并行分析
同时启动两个分析任务：
```bash
llmdoc-ccw cli -p "<后端分析提示词>" --tool codex --mode analysis
llmdoc-ccw cli -p "<前端分析提示词>" --tool gemini --mode analysis

### STEP 2: 结果聚合

合并两个分析结果...

### STEP 3: 用户确认

使用 AskUserQuestion 确认...
```

#### 1.3 大模型如何解读

当用户输入 `/llmdoc-ccw:team-research` 时：

1. **Claude Code 加载文档**
   - 读取 `llmdoc-ccw/commands/team-research.md`
   - 解析 YAML frontmatter 获取描述
   - 将完整内容注入到大模型的上下文

2. **大模型理解意图**

   用户想要执行 team-research 命令
   → 这是一个并行分析任务
   → 需要调用两个 CLI 工具
   → 需要聚合结果并与用户确认

3. **大模型执行指令**
   - 按照文档中的 STEP 0-3 顺序执行
   - 在执行过程中动态构建提示词
   - 使用 Bash 工具调用实际的 CLI 命令

### Layer 2: 技能自动触发层（Skill驱动）

#### 2.1 Skill定义

Skill是自动触发的，不需要用户显式调用。定义在 `llmdoc-ccw/skills/` 目录：

llmdoc-ccw/skills/
└── team-workflow/
    ├── SKILL.md                 # Skill定义
    └── references/
        └── team-guide.md        # 参考指南

#### 2.2 Skill触发机制

`SKILL.md` 定义了触发条件：

```markdown
---
name: team-workflow
description: "当用户提到 'team'、'协作'、'并行执行'、'多CLI'、'agent team' 时使用"
disable-model-invocation: false
---

### 触发条件
当用户请求涉及以下情况时，自动触发此技能：
- 明确提到 "team"、"协作"、"并行"
- 需要多个 CLI 工具协作
- 任务复杂度高，需要分解
```

#### 2.3 工作流选择

Skill会根据用户意图自动选择阶段：

```markdown
| 用户意图 | 推荐阶段 | 命令 |
|---------|---------|------|
| "分析"、"了解"、"研究" | research | `/llmdoc-ccw:team-research` |
| "规划"、"计划"、"拆分" | plan | `/llmdoc-ccw:team-plan` |
| "执行"、"实现"、"开发" | exec | `/llmdoc-ccw:team-exec` |
| "审查"、"检查"、"验证" | review | `/llmdoc-ccw:team-review` |
```

**示例**：

```
用户输入: "用 team 模式分析这个项目"

大模型处理流程：
1. Skill 识别触发词 "team" 和 "分析"
2. 匹配到 research 阶段
3. 自动执行 /llmdoc-ccw:team-research
4. 加载 team-research.md 文档
5. 按照文档指令执行
```

---

### Layer 3: Node.js CLI执行层（实际执行）

#### 3.1 CLI工具架构

当大模型通过Bash工具调用 `llmdoc-ccw cli ...` 或 `llmdoc-ccw team ...` 时，进入Node.js层：

```
bin/ccw.js (CLI入口)
  ↓
src/cli.js (参数解析和分发)
  ├─ 'cli' 命令 → src/tools/cli-executor.js
  └─ 'team' 命令 → src/team/team-orchestrator.js
```

#### 3.2 单次CLI执行流程

当大模型调用 `llmdoc-ccw cli -p "..." --tool codex --mode analysis` 时：

```javascript
// src/cli.js
parseArgs() → { command: 'cli', tool: 'codex', prompt: '...', mode: 'analysis' }
  ↓
runCli() → executeCli({ tool: 'codex', prompt: '...', mode: 'analysis', workingDir })

// src/tools/cli-executor.js
executeCli({ tool, prompt, mode, workingDir }) {
  // 1. 构建命令
  const { command, args } = buildCommand(tool, mode);
  // command = 'codex', args = ['exec', '--json', '--dangerously-bypass-approvals-and-sandbox']

  // 2. 创建子进程
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  // 3. 通过 stdin 传入 prompt
  child.stdin.write(prompt);
  child.stdin.end();

  // 4. 流式解析输出
  const parser = createOutputParser(tool);  // JsonLinesParser   tool:gemini/codex/qwen
  child.stdout.on('data', (chunk) => {
    const units = parser.parse(chunk);      // 解析为IR
    outputUnits.push(...units);
    onOutput(unit);                          // 回调上报
  });

  // 5. 进程结束
  child.on('close', (code) => {
    parser.flush();                          // 刷出缓冲区,同时解析最后一行json为IR
    const agentMessage = extractAgentMessage(outputUnits);
    const result = { status: code === 0 ? 'success' : 'error', output: { agentMessage, units: outputUnits } };
    saveExecution(workingDir, result);       // 持久化
    resolve(result);
  });
}
```

**关键点**：
- prompt 通过 stdin 管道输入
- 结果通过 stdout 管道流式输出
- 不是HTTP API调用，是纯进程间管道通信
- 流式解析处理不完整的JSON行

#### 3.3 四阶段编排流程

当大模型调用 `llmdoc-ccw team -p "..."` 时：

```javascript
// src/team/team-orchestrator.js
async run(request) {
  try {
    // Phase 1: Research
    const research = await this.runResearch(request.prompt);
    this.saveResearch(research);

    // Phase 2: Plan
    const plan = await this.runPlan(research);
    this.savePlan(plan);

    // Phase 3: Exec
    const exec = await this.runExec(plan);

    // Phase 4: Review
    const review = await this.runReview(exec);

    const result = { research, plan, exec, review };
    this.saveTeamExecution(result);
    return result;
  } catch (error) {
    // 记录失败阶段并持久化
    this.saveTeamExecution({ failedPhase: currentPhase, error });
    throw error;
  }
}
```

**Research阶段**（并行调用）：
```javascript
async runResearch(prompt) {
  // 构建两个并行任务
  const backendTask = {
    tool: 'codex',
    prompt: buildResearchPrompt(prompt, 'backend')  // 关注 src/**/*.js
  };
  const frontendTask = {
    tool: 'gemini',
    prompt: buildResearchPrompt(prompt, 'frontend') // 关注 components/**/*
  };

  // 并行执行
  const results = await this.executor.executeDual(backendTask, frontendTask);

  // 聚合结果
  return mergeResearchResults(results);
}
```

**Plan阶段**（生成DAG）：
```javascript
async runPlan(researchResult) {
  // 1. 构建规划提示词（包含 Research 结果）
  const planPrompt = buildPlanPrompt(researchResult);

  // 2. 调用 Gemini 生成 JSON 任务列表
  const result = await executeCli({ tool: 'gemini', prompt: planPrompt });
  const planText = result.output.agentMessage;

  // 3. 提取 JSON
  const jsonMatch = planText.match(/```json\s*([\s\S]*?)\s*```/);
  const tasks = JSON.parse(jsonMatch[1]).tasks;

  // 4. 构建 DAG 并拓扑排序
  const taskGraph = new TaskGraph();
  tasks.forEach(t => taskGraph.addTask(t));
  const layers = taskGraph.getExecutionLayers();

  return { tasks, layers };
}
```

**Exec阶段**（分层并行）：
```javascript
async runExec(plan) {
  const taskMap = new Map(plan.tasks.map(t => [t.id, t]));

  // 按层级执行
  const results = await this.executor.executeByLayers(
    plan.layers,
    taskMap,
    {
      onTaskStart: (task) => taskGraph.updateTaskStatus(task.id, 'running'),
      onTaskComplete: (task, result, error) => {
        taskGraph.updateTaskStatus(task.id, error ? 'failed' : 'completed');
      }
    }
  );

  return { results, summary: taskGraph.getStatusSummary() };
}
```

**Review阶段**（双模型审查）：
```javascript
async runReview(execResult) {
  // 并行审查
  const codexReview = { tool: 'codex', prompt: buildReviewPrompt(execResult, 'backend') };
  const geminiReview = { tool: 'gemini', prompt: buildReviewPrompt(execResult, 'frontend') };

  const results = await this.executor.executeDual(codexReview, geminiReview);

  // 分级问题
  return mergeReviewResults(results);  // Critical/Warning/Info
}
```

---

### Layer 4: 持久化层（状态管理）

#### 4.1 文件系统存储

所有执行结果都持久化到文件系统：

```
~/.cc-workflow/
└── projects/
    └── <project-name>-<hash>/
        ├── history.json           # 单次执行索引（最近100条）
        ├── sessions/              # 单次执行详情
        │   └─ <execution-id>.json
        └── team/
            ├── executions.json    # 团队执行索引（最近50条）
            ├── plans/             # 执行计划
            │   ├─ latest.json     # 最新计划副本
            │   └─ <plan-id>.json
            └── reports/           # 执行报告
                ├─ <exec-id>.json
                ├─ <exec-id>-research.json
                └─ <exec-id>-review.json
```

#### 4.2 状态管理API

```javascript
// src/team/team-state.js

// 保存团队执行
saveTeamExecution(projectPath, result) {
  const executionsPath = path.join(teamDir, 'executions.json');
  const reportPath = path.join(reportsDir, `${executionId}.json`);

  // 更新索引
  const executions = loadExecutions(projectPath);
  executions.unshift({ id: executionId, timestamp, status, summary });
  executions.splice(100);  // 保留最近100条
  fs.writeFileSync(executionsPath, JSON.stringify(executions));

  // 写入详情
  fs.writeFileSync(reportPath, JSON.stringify(result));
}

// 保存计划
savePlan(projectPath, plan) {
  const planPath = path.join(plansDir, `${plan.id}.json`);
  const latestPath = path.join(plansDir, 'latest.json');

  fs.writeFileSync(planPath, JSON.stringify(plan));
  fs.writeFileSync(latestPath, JSON.stringify(plan));  // 同步更新latest
}

// 加载计划
loadPlan(projectPath, planId) {
  const planPath = planId === 'latest'
    ? path.join(plansDir, 'latest.json')
    : path.join(plansDir, `${planId}.json`);

  return JSON.parse(fs.readFileSync(planPath, 'utf-8'));
}
```

---

## 四阶段完整数据流示例

### 场景：用户请求"实现用户认证模块"

#### 完整调用链

```
用户: "用 team 模式实现用户认证模块"

┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Skill 触发                                          │
├─────────────────────────────────────────────────────────────┤
│ • Skill识别触发词: "team"、"实现"                              │
│ • 匹配到完整工作流（包含所有阶段）                              │
│ • 决定执行完整的 research → plan → exec → review              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Research 阶段（/llmdoc-ccw:team-research）           │
├─────────────────────────────────────────────────────────────┤
│ 大模型读取 team-research.md，执行：                            │
│                                                              │
│ STEP 1: 并行分析                                             │
│   Bash("llmdoc-ccw cli -p '分析后端认证需求' --tool codex")   │
│   Bash("llmdoc-ccw cli -p '分析前端认证需求' --tool gemini")  │
│                                                              │
│ Node.js 层执行:                                              │
│   src/cli.js → executeCli()                                  │
│     → spawn('codex', ...) → stdin.write(prompt)              │
│     → 流式解析 stdout → 返回 JSON                             │
│                                                              │
│ STEP 2: 聚合结果                                             │
│   合并两个分析结果，生成约束集和依赖关系                         │
│                                                              │
│ STEP 3: 用户确认                                             │
│   AskUserQuestion("约束集是否完整？")                          │
│                                                              │
│ 持久化:                                                       │
│   ~/.cc-workflow/projects/<id>/team/reports/<id>-research.json│
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Plan 阶段（/llmdoc-ccw:team-plan）                   │
├─────────────────────────────────────────────────────────────┤
│ 大模型读取 team-plan.md，执行：                                │
│                                                              │
│ STEP 0: 加载研究结果                                          │
│   Read("~/.cc-workflow/.../reports/<id>-research.json")      │
│                                                              │
│ STEP 1-3: 任务拆分、构建依赖图、拓扑排序                        │
│   Bash("llmdoc-ccw team -p '生成认证模块计划' --phase plan")  │
│                                                              │
│ Node.js 层执行:                                              │
│   src/team/team-orchestrator.js → runPlan()                  │
│     → executeCli({ tool: 'gemini', prompt: planPrompt })     │
│     → 解析返回的 JSON 任务列表                                 │
│     → TaskGraph.addTask() × N                                │
│     → TaskGraph.getExecutionLayers() → [[task1,task2],[task3]]│
│                                                              │
│ STEP 4: 生成计划文件                                          │
│   {                                                          │
│     "id": "plan-1234567890",                                 │
│     "tasks": [                                               │
│       {                                                      │
│         "id": "task-1",                                      │
│         "tool": "codex",                                     │
│         "mode": "write",                                     │
│         "scope": { "include": ["src/api/auth/**/*.js"] },   │
│         "dependencies": []                                   │
│       },                                                     │
│       {                                                      │
│         "id": "task-2",                                      │
│         "tool": "gemini",                                    │
│         "mode": "write",                                     │
│         "scope": { "include": ["src/components/Login.jsx"] },│
│         "dependencies": ["task-1"]                           │
│       }                                                      │
│     ],                                                       │
│     "layers": [["task-1"], ["task-2"]]                       │
│   }                                                          │
│                                                              │
│ 持久化:                                                       │
│   ~/.cc-workflow/projects/<id>/team/plans/plan-xxx.json      │
│   ~/.cc-workflow/projects/<id>/team/plans/latest.json        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Exec 阶段（/llmdoc-ccw:team-exec）                   │
├─────────────────────────────────────────────────────────────┤
│ 大模型读取 team-exec.md，执行：                                │
│                                                              │
│ STEP 0: 加载计划                                              │
│   Read("~/.cc-workflow/.../plans/latest.json")               │
│                                                              │
│ STEP 2: 分层执行                                              │
│   Bash("llmdoc-ccw team --plan latest --phase exec")         │
│                                                              │
│ Node.js 层执行:                                              │
│   src/team/team-orchestrator.js → runExec()                  │
│     → ParallelExecutor.executeByLayers()                     │
│                                                              │
│   Layer 1: [task-1]                                          │
│     → Semaphore.acquire()                                    │
│     → executeCli({ tool: 'codex', prompt: task1Prompt })     │
│     → Semaphore.release()                                    │
│                                                              │
│   Layer 2: [task-2]                                          │
│     → 等待 Layer 1 完成                                       │
│     → executeCli({ tool: 'gemini', prompt: task2Prompt })    │
│                                                              │
│ STEP 5: 结果汇总                                              │
│   {                                                          │
│     "summary": { "completed": 2, "failed": 0 },             │
│     "results": [                                             │
│       { "taskId": "task-1", "status": "success", ... },      │
│       { "taskId": "task-2", "status": "success", ... }       │
│     ]                                                        │
│   }                                                          │
│                                                              │
│ 持久化:                                                       │
│   ~/.cc-workflow/projects/<id>/team/reports/<exec-id>.json   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Review 阶段（/llmdoc-ccw:team-review）               │
├─────────────────────────────────────────────────────────────┤
│ 大模型读取 team-review.md，执行：                              │
│                                                              │
│ STEP 1: 并行审查                                              │
│   Bash("llmdoc-ccw cli -p '审查后端代码' --tool codex")       │
│   Bash("llmdoc-ccw cli -p '审查前端代码' --tool gemini")      │
│                                                              │
│ Node.js 层执行:                                              │
│   src/team/team-orchestrator.js → runReview()                │
│     → ParallelExecutor.executeDual(codexReview, geminiReview)│
│                                                              │
│ STEP 2: 问题分级                                              │
│   {                                                          │
│     "critical": [                                            │
│       { "file": "src/api/auth.js", "line": 42, "issue": "SQL注入风险" }│
│     ],                                                       │
│     "warning": [...],                                        │
│     "info": [...]                                            │
│   }                                                          │
│                                                              │
│ STEP 3: 决策门                                                │
│   如果 critical > 0:                                         │
│     AskUserQuestion("发现严重问题，是否立即修复？")             │
│                                                              │
│ 持久化:                                                       │
│   ~/.cc-workflow/projects/<id>/team/reports/<id>-review.json │
└─────────────────────────────────────────────────────────────┘
```

---

## 关键设计决策

### 1. 为什么使用Markdown文档定义命令？

**优势**：
- **可读性强**：开发者可以直接阅读和修改命令逻辑
- **版本控制友好**：Markdown diff 清晰，便于 code review
- **无需编译**：修改命令不需要重新构建代码
- **大模型原生支持**：Markdown 是大模型最擅长的格式

**劣势**：
- **执行效率**：需要大模型解读，比编译后的代码慢
- **确定性**：大模型可能对同一文档有不同理解
- **调试困难**：无法像代码一样设置断点

### 2. 文档化命令 vs Node.js CLI 的分工

| 职责 | 文档化命令（Prompt驱动） | Node.js CLI（代码执行） |
|------|------------------------|----------------------|
| **意图理解** | ✅ 大模型解读自然语言 | ❌ 固定参数解析 |
| **上下文构建** | ✅ 动态读取文件、构建提示词 | ❌ 需要明确的输入 |
| **任务编排** | ✅ 高层工作流协调 | ✅ 底层并发控制、DAG排序 |
| **进程管理** | ❌ 无法直接管理 | ✅ spawn子进程、信号量 |
| **流式解析** | ❌ 无法处理字节流 | ✅ 缓冲区、JSON解析 |
| **持久化** | ❌ 无法直接写文件 | ✅ 文件系统操作 |
| **错误处理** | ✅ 理解语义错误 | ✅ 捕获系统错误 |

**核心原则**：
- 文档化命令负责**做什么**（What）和**为什么**（Why）
- Node.js CLI负责**怎么做**（How）

### 3. 大模型在执行链中的角色

大模型不是简单的"命令解释器"，而是**智能编排器**：

```
传统模式:
  用户 → Shell → 脚本 → 执行

Prompt驱动模式:
  用户 → 大模型 → 文档 → 大模型理解 → 动态构建 → Node.js执行 → 大模型解释结果
```

**大模型的增强能力**：
1. **需求增强**：用户说"实现登录"，大模型补全"需要session管理、密码加密、表单验证"
2. **上下文发现**：自动读取相关文件、llmdoc文档
3. **错误恢复**：CLI失败时，大模型可以调整策略重试
4. **结果解释**：将JSON结果转化为人类可读的报告

### 4. 为什么需要Node.js CLI层？

纯Prompt驱动理论上可以完全依赖大模型调用外部CLI（如直接调用gemini、codex），但引入Node.js中间层有以下好处：

**优势**：
1. **统一接口**：`llmdoc-ccw cli` 封装了不同CLI工具的参数差异
2. **流式解析**：处理不完整的JSON行、统一输出格式（IR）
3. **状态持久化**：执行历史、计划、报告的文件系统管理
4. **并发控制**：信号量、依赖图、分层执行
5. **离线能力**：即使没有大模型，也可以直接使用CLI工具

**代价**：
- 增加了系统复杂度
- 需要维护两套系统（文档 + 代码）

---

## 与Node.js命令层对比

### 核心差异

| 维度 | Node.js命令层 | Prompt驱动层 |
|------|-------------|-------------|
| **输入方式** | `llmdoc-ccw team -p "..."` | `/llmdoc-ccw:team-research` |
| **命令定义** | `src/cli.js` 中的 `switch` 语句 | `llmdoc-ccw/commands/*.md` |
| **参数解析** | `parseArgs()` 手写解析器 | 大模型理解自然语言 |
| **错误处理** | `try-catch` + 错误码 | 大模型理解错误语义 |
| **扩展性** | 修改代码 → 重新部署 | 修改文档 → 立即生效 |
| **可测试性** | 单元测试、集成测试 | 需要大模型评估 |

### 互补关系

两种模式可以同时存在，互为补充：

```
场景1: 开发者熟悉CLI，直接使用
  $ llmdoc-ccw team -p "实现认证" --phase research

场景2: 开发者在Claude Code中，使用斜杠命令
  > /llmdoc-ccw:team-research

场景3: 开发者使用自然语言，Skill自动触发
  > "用team模式分析这个项目"
  → Skill识别 → 自动调用 /llmdoc-ccw:team-research
```

**底层都走同一套Node.js实现**，只是入口不同：
- CLI入口：`bin/ccw.js` → `src/cli.js`
- 斜杠命令入口：大模型解读文档 → Bash调用 `llmdoc-ccw ...`

---

## 最佳实践

### 1. 文档化命令的设计原则

**好的命令文档**：
```markdown
---
description: "明确的用途描述"
---

## 执行流程

### STEP 1: 具体动作
使用明确的指令：
- "调用 Bash 工具执行..."
- "使用 Read 工具读取..."
- "使用 AskUserQuestion 确认..."

### STEP 2: 数据格式
明确输入输出格式：
- 输入: { type: 'json', schema: {...} }
- 输出: { type: 'markdown', template: '...' }
```

**不好的命令文档**：
```markdown
分析代码并给出建议
```
（太模糊，大模型无法确定具体动作）

### 2. Skill触发词设计

**精确匹配**：
```markdown
触发条件: "team"、"多CLI"、"agent team"
```
→ 避免与常见词冲突（如"协作"可能太泛）

**上下文增强**：
```markdown
预获取上下文:
!`ls -la ~/.cc-workflow/projects/*/team/plans/latest.json`
!`cat ~/.cc-workflow/projects/*/team/executions.json`
```
→ 在Skill触发时自动加载历史数据，避免重复询问

### 3. 大模型与Node.js的边界

**清晰分层**：
- 大模型：意图理解、上下文构建、结果解释
- Node.js：进程管理、流式解析、并发控制、持久化

**避免**：
- ❌ 在文档中写复杂的算法逻辑（应该放在Node.js）
- ❌ 在Node.js中硬编码业务规则（应该通过prompt参数化）

---

## 总结

### Prompt驱动的四阶段工作流本质

```
传统编程: 代码 → 编译器 → 机器指令
Prompt驱动: 文档 → 大模型 → 动态行为
```

cc-workflow的创新在于：
1. **文档即代码**：Markdown文件定义了完整的命令行为
2. **大模型即解释器**：Claude Code 将文档转化为具体操作
3. **分层解耦**：Prompt层负责"做什么"，Node.js层负责"怎么做"
4. **渐进增强**：从简单CLI到智能Skill，多种使用方式并存

### 数据流核心链条

```
用户输入
  → Claude Code 识别命令
    → 大模型解读 Markdown 文档
      → 动态构建提示词和参数
        → Bash 工具调用 Node.js CLI
          → spawn 子进程执行外部工具
            → 流式解析输出
              → 持久化结果
                → 大模型解释结果并输出
```

整个系统**没有硬编码的业务逻辑**，所有行为都由文档定义，由大模型动态解释执行。这是Prompt Engineering在系统架构层面的极致应用。
