---
description: 为该项目生成优秀的文档系统
---

## 动作 (Actions)

0. **步骤 0 (STEP 0):**
   - 获取当前项目结构。
   - 读取关键文件，如各种 README.md / package.json / go.mod / pyproject.toml ...

1. **步骤 1: 全局调查 (使用 `scout`)**
   - 启动并发的 `scout` 代理来探索代码库并生成报告。
   - **最多使用 4 个 `scout` 代理进行探索！**
   - **最多使用 4 个 `scout` 代理进行探索！**
   - 切勿在后台运行 `scout`，切勿使用获取任务输出的方法来获取运行中的 `scout` 输出，只需运行并等待！

2. **步骤 2: 提出核心概念并获取用户选择**
   - 侦察完成后，执行综合步骤：阅读所有侦察报告并生成候选核心概念列表（例如，“身份验证”、“计费引擎”、“API 网关”）。
   - 使用 `AskUserQuestion` 工具将此列表作为多选题呈现给用户：“我分析了该项目并发现了这些潜在的核心概念。请选择您现在想要记录的概念：”。

3. **步骤 3: 生成简明的基础文档**
   - 并行启动专门的 `recorder` 代理来创建重要的、项目范围的文档。
   - **Recorder A 的任务 (项目概览):** “创建 `overview/project-overview.md`。分析所有侦察报告，定义项目的目的、主要功能和技术栈。”
   - **Recorder B 的任务 (编码规范):** “创建一个简明的 `reference/coding-conventions.md`。分析项目配置文件 (`.eslintrc`, `.prettierrc`) 并仅提取最重要的、高层级的规则。”
   - **Recorder C 的任务 (Git 规范):** “创建一个简明的 `reference/git-conventions.md`。分析 `git log` 以推断并记录主要的分支策略和提交消息格式。”
   - **模式:** 这些记录器必须以 `content-only` (仅内容) 模式运行。

4. **步骤 4: 记录用户选择的概念**
   - 根据用户在步骤 2 中的选择，为每个选定的概念并发调用 `recorder` 代理。
   - 该 `recorder` 的提示将非常具体，以控制范围和细节：
     "**任务:** 全面记录 **`<selected_concept_name>`**。
     **1. 阅读所有相关的侦察报告和源代码...**
     **2. 生成一组小型的、分层的文档:**
     - **(可选) 创建一个 `overview` 文档**，如果该概念足够大，需要自己的高层级摘要（例如 `overview/authentication-overview.md`）。
     - **创建 1-2 个主要的 `architecture` 文档。** 这是强制性的，应该是核心的‘LLM 检索地图’。
     - **创建 1-2 个主要的 `guide` 文档**，解释该概念最常见的工作流（例如 `how-to-authenticate-a-user.md`）。
     - **(可选) 创建 1-2 个简明的 `reference` 文档**，仅当存在关键的、明确定义的数据结构或 API 规范时。不要为次要细节创建参考文档。
     **3. 以 `content-only` 模式运行。**"

5. **步骤 5: 最终索引**
   - 在步骤 3 和步骤 4 中的所有 `recorder` 代理完成后，以 `full` 模式调用单个 `recorder`，从头开始构建最终的 `index.md`。

6. **步骤 6: 清理**
   - 删除 `/llmdoc/agent/` 中的临时侦察报告。
