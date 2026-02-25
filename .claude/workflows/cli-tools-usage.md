# CLI 工具使用规范

## 工具类型

| 工具 | 输出格式 | 启用参数 | 适用场景 |
|------|---------|---------|----------|
| Gemini | stream-json | `-o stream-json` | 分析、理解、文档 |
| Qwen | stream-json | `-o stream-json` | Gemini 备选 |
| Codex | json-lines | `--json` | 开发、实现 |

---

## 命令结构

```bash
# 基本格式
ccw cli -p "<PROMPT>" --tool <tool> --mode <mode>

# 完整示例
ccw cli -p "PURPOSE: 分析认证模块
TASK: • 检查安全漏洞 • 审查代码质量
MODE: analysis
CONTEXT: @src/auth/**/*
EXPECTED: 安全报告" --tool gemini --mode analysis
```

---

## 提示词模板

### 通用模板

```
PURPOSE: [目标] + [原因] + [成功标准] + [约束/范围]
TASK: • [步骤1: 具体动作] • [步骤2: 具体动作]
MODE: [analysis|write]
CONTEXT: @[文件模式]
EXPECTED: [交付格式] + [质量标准]
CONSTRAINTS: [领域约束]
```

### 意图验证清单

执行 CLI 前，验证以下维度：
- [ ] 目标是否具体可衡量？
- [ ] 成功标准是否定义？
- [ ] 范围是否明确界定？
- [ ] 约束和限制是否说明？
- [ ] 预期输出格式是否清晰？
- [ ] 操作级别（读/写）是否明确？

---

## 工具选择算法

```
1. 解析任务意图 → 提取所需能力
2. 匹配工具标签 → 筛选支持的工具
3. 选择工具 → 按优先级（显式 > 标签匹配 > 默认）
```

### 决策树

```
┌─ 显式指定 --tool？
│  └─→ YES: 使用指定工具
│
└─ NO: 基于意图选择
   ├─ analyze|plan → gemini (qwen fallback)
   ├─ execute (simple) → gemini
   └─ execute (complex) → codex
```

---

## 模式说明

| 模式 | 用途 | 工具行为 |
|------|------|----------|
| `analysis` | 只读分析 | 不修改文件 |
| `write` | 实现/修改 | 可创建/修改文件 |

---

## 输出格式

### Gemini/Qwen stream-json

```json
{"type":"init","session_id":"abc123","model":"gemini-2.5-pro"}
{"type":"message","role":"assistant","content":"分析结果...","delta":true}
{"type":"tool_use","tool_name":"Read","parameters":{"file":"src/main.ts"}}
{"type":"tool_result","tool_id":"123","output":"文件内容..."}
{"type":"result","status":"success","stats":{"tokens":1234}}
```

### Codex json-lines

```json
{"type":"thread.started","thread_id":"xyz789"}
{"type":"item.completed","item":{"type":"reasoning","text":"思考过程..."}}
{"type":"item.completed","item":{"type":"agent_message","text":"最终回答..."}}
{"type":"turn.completed","usage":{"input_tokens":500,"output_tokens":200}}
```

---

## 会话管理

### 保存位置

```
~/.cc-workflow/
└── projects/
    └── <project-id>/
        ├── history.json      # 执行历史索引
        └── sessions/
            └── <id>.json     # 完整执行记录
```

### Resume 支持

```bash
# 继续上次会话
ccw cli -p "继续..." --tool gemini --resume

# 内部调用
gemini -r latest -o stream-json
```

---

## 最佳实践

1. **明确意图**: 使用结构化 PURPOSE/TASK/EXPECTED 格式
2. **限定范围**: 通过 CONTEXT 指定相关文件
3. **选择合适工具**: 分析用 gemini，实现用 codex
4. **利用 resume**: 复杂任务分多轮完成
5. **检查输出**: 关注 agent_message 类型的内容
