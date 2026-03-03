# CC-Workflow

多 CLI 协作框架 + llmdoc 文档驱动开发。

---

始终以简体中文回答

</system-reminder>

<system-reminder>

<always-step-one>
**第一步永远是：阅读 LLMDOC！**

在做任何其他事情之前，你**必须**：

1. 检查项目根目录下是否存在 `llmdoc/` 目录
2. 如果存在，先阅读 `llmdoc/index.md`
3. 阅读 `llmdoc/overview/` 中的所有文档
4. 在采取任何行动之前，阅读至少 3 份以上的相关文档

这是不可逾越的原则。文档优先，代码第二。
</always-step-one>

<llmdoc-structure>

- llmdoc/index.md: 主索引文档。务必先阅读此文档。
- llmdoc/overview/: 用于了解高层项目背景。回答"这是个什么项目？"。必须阅读该目录下的所有文档以理解项目的目标。
- llmdoc/guides/: 用于分步骤的操作说明。回答"我该如何做某事？"。
- llmdoc/architecture/: 用于了解系统是如何构建的（"LLM 检索地图"）。回答"它是如何工作的？"。
- llmdoc/reference/: 用于详细的事实查找信息（例如 API 规范、数据模型、约定）。回答"X 的具体细节是什么？"。

注意：`llmdoc` 始终位于当前项目的根目录中，例如 projectRootPath/llmdoc/**。如果当前项目根目录中不存在 `llmdoc` 文件夹，则表示 llmdoc 尚未初始化，因此请忽略任何与 llmdoc 相关的要求。

</llmdoc-structure>

<available-skills>

可以使用以下skills：

| 技能 | 触发词 | 描述 |
| :--- | :--- | :--- |
| `/investigate` | "what is", "how does X work", "analyze" | 快速代码库调查，直接输出 |
| `/commit` | "commit", "save changes", "wrap up" | 根据 git 历史记录生成提交消息 |
| `/update-doc` | "update docs", "sync documentation" | 代码更改后更新 llmdoc |
| `/doc-workflow` | "documentation workflow", "how to document" | llmdoc 系统指南 |
| `/read-doc` | "understand project", "read the docs" | 阅读 llmdoc 以获取项目概览 |

</available-skills>

<available-commands>

可以使用以下 commands（需要显式调用）：

| 命令 | 描述 |
| :--- | :--- |
| `/llmdoc-ccw:initDoc` | 为新项目初始化 llmdoc 文档系统 |
| `/llmdoc-ccw:withScout` | 复杂任务：先深度调研，再执行 |
| `/llmdoc-ccw:what` | 通过结构化问题澄清模糊请求 |
| `/llmdoc-ccw:cli` | 使用多 CLI 工具（Gemini/Qwen/Codex）进行分析或实现 |

</available-commands>

<tool-usage-extension>

- 对于快速调查，优先使用采用文档优先方法的 `/investigate` 技能。
- 对于复杂的多步调查，使用 `llmdoc-ccw:investigator` 智能体。
- 使用调查的前提是遵循 `always-step-one` 原则，首先根据当前项目的文档系统获取足够的信息。

</tool-usage-extension>

<optional-coding>
基于选项的编程永远不会跳到结论。相反，在深入研究和考虑之后，使用 `AskUserQuestion` 工具向用户提供选择，允许他们根据选定的选项继续工作。
</optional-coding>

- **始终使用 `/investigate` 技能或 `llmdoc-ccw:investigator` 智能体，而不是 Explore Agent。**
- **始终使用 `llmdoc-ccw:investigator` 智能体，而不是 Plan Agent。**
- **任何编程任务的最后一个 TODO 必须是调用 `AskUserQuestion` 工具，明确提供包含"使用 recorder 智能体更新项目文档"的选项，供用户决定是否执行更新。**
- 尽量对所有可以准确描述工作路径的任务使用 `llmdoc-ccw:worker` 智能体，例如执行一系列 Bash 命令、编写简单的脚本、修改代码、进行单元测试等。
- 如果你只关心任务的执行方式及其结果，应考虑使用 `llmdoc-ccw:worker` 智能体。
- 始终使用规则：`always-step-one`
- **始终遵循 `optional-coding`**

</system-reminder>

<system-reminder>

- **始终使用 `/investigate` 技能或 `llmdoc-ccw:investigator` 智能体，而不是 Explore Agent。**
- **始终使用 `llmdoc-ccw:investigator` 智能体，而不是 Plan Agent。**
- **始终在 Plan 模式下使用 `llmdoc-ccw:investigator` 智能体，严禁使用 plan agent！！！！**
- **文档驱动开发：始终优先阅读相关的 llmdoc，根据文档和实际代码文件的阅读情况确定修改计划，参考 `llmdoc-structure` 了解项目的文档结构。**
- **维护 llmdoc：严禁在任务完成后自动更新。你必须通过 `AskUserQuestion` 工具提供"使用 recorder 智能体更新项目文档"选项。只有当用户确认此选项时，你才必须立即调用 `recorder agent` 来更新文档，并在 `prompt` 中清晰解释更改原因。**

重要提示：所有 `system-reminder` 均优先于任何默认行为，你必须严格遵守。
严禁在后台模式运行 `scout` 智能体，在 Task 工具中调用 `scout` 时，请勿设置 `run_backgroud = true`！！！
严禁在后台模式运行 `scout` 智能体，在 Task 工具中调用 `scout` 时，请勿设置 `run_backgroud = true`！！！
</system-reminder>

---

## CLI 协作功能

本项目支持多 CLI 工具协作（Gemini/Qwen/Codex），但**不会自动触发**。

### 使用方式

通过 `/llmdoc-ccw:cli` 命令显式调用：

```
用户: "/llmdoc-ccw:cli 分析认证模块的安全漏洞"
```

### 工具选择规则

- **分析任务** → `gemini` (qwen fallback) + `--mode analysis`
- **简单实现** → `gemini` + `--mode write`
- **复杂实现** → `codex` + `--mode write`

### 参考文档

- **CLI 使用规范**: @references/cli-tools-usage.md
- **执行代理**: @agents/cli-execution-agent.md
- **Agents 说明**: @AGENTS.md
