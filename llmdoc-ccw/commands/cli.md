---
description: 使用多 CLI 工具（Gemini/Qwen/Codex）进行代码分析或实现任务
---

## 动作 (Actions)

**用途**: 当需要使用外部 CLI 工具进行深度分析或复杂实现时使用。

**注意**: 此命令不会自动触发，需要用户显式调用。

### 使用场景

- **深度代码分析**: 需要多模型交叉验证的架构分析
- **复杂实现任务**: 需要专门工具（如 Codex）的开发任务
- **性能优化**: 需要专业分析的性能瓶颈诊断
- **安全审计**: 需要全面扫描的安全漏洞检查

---

## 执行流程

1. **理解用户意图**
   - 解析任务类型：analyze（分析）、plan（规划）、execute（实现）
   - 评估复杂度：simple、medium、complex
   - 提取关键词和约束条件

2. **上下文发现**（遵循 llmdoc 优先原则）
   - 首先阅读 `llmdoc/` 相关文档
   - 使用 MCP 工具或 ripgrep 发现相关文件
   - 构建文件引用列表（@pattern 格式）

3. **构建结构化提示词**
   ```
   PURPOSE: [目标] + [原因] + [成功标准]
   TASK: • [步骤1] • [步骤2] • [步骤3]
   MODE: [analysis|write]
   CONTEXT: @[文件模式] | Memory: [llmdoc 上下文]
   EXPECTED: [交付格式] + [质量标准]
   CONSTRAINTS: [约束条件]
   ```

4. **选择工具并执行**
   - **分析任务** → `gemini` (qwen fallback) + `--mode analysis`
   - **简单实现** → `gemini` + `--mode write`
   - **复杂实现** → `codex` + `--mode write`

5. **执行 CLI 命令**
   ```bash
   # 通过 Bash 工具后台执行
   Bash({
     command: "llmdoc-ccw cli -p '...' --tool gemini --mode analysis",
     run_in_background: true
   })
   ```

6. **输出结果**
   - 解析 CLI 输出（stream-json 或 json-lines）
   - 提取关键信息（agent_message）
   - 向用户展示分析结果或实现建议
   - 询问是否需要后续操作

---

## 工具选择规则

| 任务类型 | 复杂度 | 推荐工具 | 模式 |
|---------|--------|---------|------|
| 分析/理解 | 任意 | gemini | analysis |
| 规划/设计 | 任意 | gemini | analysis |
| 实现（简单） | simple | gemini | write |
| 实现（中等） | medium | gemini | write |
| 实现（复杂） | complex | codex | write |

**复杂度评分标准**:
- 包含 "system"、"architecture" → +3
- 包含 "refactor"、"migrate" → +2
- 包含 "component"、"feature" → +1
- 涉及多个技术栈 → +2
- **总分 ≥5**: complex | **≥2**: medium | **<2**: simple

---

## 命令示例

### 示例 1: 安全分析

```
用户: "/llmdoc-ccw:cli 分析认证模块的安全漏洞"

执行:
1. 阅读 llmdoc/architecture/authentication.md
2. 发现相关文件: src/auth/**/*.ts
3. 构建提示词:
   PURPOSE: 识别认证模块中的 OWASP Top 10 漏洞
   TASK: • 扫描 SQL 注入 • 检查 XSS 漏洞 • 验证 CSRF 防护
   MODE: analysis
   CONTEXT: @src/auth/**/* | Memory: 使用 bcrypt + JWT
   EXPECTED: 安全报告（严重级别 + 修复建议）
   CONSTRAINTS: 仅关注认证模块
4. 调用: llmdoc-ccw cli --tool gemini --mode analysis
5. 输出分析结果
```

### 示例 2: 功能实现

```
用户: "/llmdoc-ccw:cli 添加 API 限流功能"

执行:
1. 阅读 llmdoc/architecture/middleware.md
2. 发现相关文件: src/middleware/**/*.ts
3. 评估复杂度: medium (涉及 Redis + 中间件)
4. 构建提示词:
   PURPOSE: 实现可配置的 API 限流中间件
   TASK: • 创建限流中间件 • 集成 Redis • 添加配置支持
   MODE: write
   CONTEXT: @src/middleware/**/* | Memory: 现有中间件模式
   EXPECTED: 生产级代码 + 单元测试
   CONSTRAINTS: 遵循现有中间件模式
5. 调用: llmdoc-ccw cli --tool gemini --mode write
6. 展示实现建议
```

---

## 提示词模板

### 意图验证清单

执行 CLI 前，验证以下维度：
- [ ] 目标是否具体可衡量？
- [ ] 成功标准是否定义？
- [ ] 范围是否明确界定？
- [ ] 约束和限制是否说明？
- [ ] 预期输出格式是否清晰？
- [ ] 操作级别（读/写）是否明确？

---

## 注意事项

1. **llmdoc 优先**: 始终先阅读相关文档再执行 CLI
2. **不自动触发**: 仅在用户明确请求时使用
3. **结果确认**: CLI 执行后，向用户展示结果并询问下一步
4. **工具回退**: gemini 失败时自动尝试 qwen
5. **会话管理**: 支持 `--resume` 继续上次会话

---

## 参考文档

- **CLI 使用规范**: `references/cli-tools-usage.md`
- **CLI 执行代理**: `agents/cli-execution-agent.md`
- **提示词模板**: 参考 CLI 执行代理的模板部分
