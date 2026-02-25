# CC-Workflow

最简多 CLI 协作框架 - 支持 Gemini/Qwen/Codex 统一调用与输出解析。

## 核心能力

1. **统一 CLI 调用** - 通过 `ccw cli` 命令调用不同 CLI 工具
2. **结构化输出解析** - 解析 stream-json/json-lines 格式
3. **会话状态管理** - 支持历史记录和 resume

## 安装

```bash
# 全局安装
npm install -g .

# 或本地使用
node bin/ccw.js
```

## 使用

### 命令行

```bash
# 分析任务
ccw cli -p "分析认证模块的安全性" --tool gemini --mode analysis

# 实现任务
ccw cli -p "实现用户登录功能" --tool codex --mode write

# 继续上次会话
ccw cli -p "继续分析" --tool gemini --resume

# 查看历史
ccw history
```

### 编程接口

```javascript
import { executeCli, flattenOutput } from 'cc-workflow';

const result = await executeCli({
  tool: 'gemini',
  prompt: '分析代码结构',
  mode: 'analysis',
  onOutput: (unit) => {
    if (unit.type === 'agent_message') {
      console.log(unit.content);
    }
  }
});

console.log('Agent 回复:', result.output.agentMessage);
```

## 架构

```
cc-workflow/
├── bin/ccw.js                    # CLI 入口
├── src/
│   ├── cli.js                    # 命令行解析
│   ├── index.js                  # 导出入口
│   └── tools/
│       ├── cli-executor.js       # CLI 执行核心
│       ├── cli-output-converter.js # 输出解析
│       └── cli-state.js          # 状态管理
├── .claude/
│   ├── agents/
│   │   └── cli-execution-agent.md # 执行代理定义
│   └── workflows/
│       └── cli-tools-usage.md    # CLI 使用规范
├── CLAUDE.md                     # Claude Code 指令
└── package.json
```

## 通信机制

### 1. 文件系统 - 会话状态共享

```
~/.cc-workflow/
└── projects/<project-id>/
    ├── history.json      # 执行历史索引
    └── sessions/
        └── <id>.json     # 完整执行记录
```

### 2. stdout 解析 - stream-json 格式

| CLI | 格式 | 参数 |
|-----|------|------|
| Gemini | stream-json | `-o stream-json` |
| Qwen | stream-json | `-o stream-json` |
| Codex | json-lines | `--json` |

### 3. 主 Agent 编排

Claude Code 作为主 agent，通过 Bash 调用 `ccw cli` 分发任务：

```javascript
// 分析任务 → gemini
Bash({ command: "ccw cli -p '...' --tool gemini" })

// 实现任务 → codex
Bash({ command: "ccw cli -p '...' --tool codex --mode write" })
```

## 输出类型

| 类型 | 说明 |
|------|------|
| `agent_message` | 最终回答（关键） |
| `streaming_content` | 流式内容 |
| `thought` | AI 思考过程 |
| `tool_call` | 工具调用 |
| `metadata` | 会话元数据 |
| `progress` | 进度信息（过滤） |

## License

MIT
