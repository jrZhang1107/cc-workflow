# CC-Workflow

多 CLI 协作框架，支持 Gemini/Qwen/Codex 的统一调用和输出解析。

## CLI 协作规则

### 工具选择
- **分析任务** → `gemini` (qwen fallback)
- **实现任务** → `codex`
- **文档任务** → `gemini`

### 执行方式
```bash
# 通过 Bash 工具调用（后台执行）
Bash({
  command: "ccw cli -p '...' --tool gemini --mode analysis",
  run_in_background: true
})
```

### 提示词格式
```
PURPOSE: [目标] + [原因] + [成功标准]
TASK: • [步骤1] • [步骤2]
MODE: [analysis|write]
CONTEXT: @[文件模式]
EXPECTED: [交付格式]
```

## 参考文档

- **CLI 使用规范**: @.claude/workflows/cli-tools-usage.md
- **执行代理**: @.claude/agents/cli-execution-agent.md
