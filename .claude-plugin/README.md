# CC-Workflow Plugin

Claude Code 插件：多 CLI 协作框架 + llmdoc 文档驱动开发

## 安装方式

### 方式 1: Plugin 安装（推荐）

完整的文档驱动开发工作流，包含所有 agents、commands、skills。

```bash
# 添加插件市场
/plugin marketplace add https://github.com/your-org/cc-workflow

# 安装插件
/plugin install ccw@cc-workflow
```

### 方式 2: 仅使用 CLI 工具

只需要 CLI 工具进行多模型协作，不需要完整的 Plugin 系统。

```bash
# 全局安装
npm install -g cc-workflow

# 使用 CLI
ccw cli -p "分析代码" --tool gemini
ccw cli -p "实现功能" --tool codex --mode write
```

**说明**: 此方式只提供 CLI 工具，不包含 llmdoc 工作流。如需完整功能，请使用 Plugin 方式。

---

## 快速开始

### 1. 初始化文档系统

```bash
/ccw:initDoc
```

这会创建 `llmdoc/` 目录结构并生成初始文档。

### 2. 可用 Skills（自动触发）

| Skill | 触发词 | 描述 |
|-------|--------|------|
| `/investigate` | "什么是"、"X怎么工作"、"分析" | 快速代码库调查 |
| `/commit` | "提交"、"commit" | 生成提交信息 |
| `/update-doc` | "更新文档"、"同步文档" | 更新 llmdoc |
| `/read-doc` | "了解项目"、"读文档" | 阅读 llmdoc 概览 |

### 3. 可用 Commands（显式调用）

| 命令 | 描述 |
|------|------|
| `/ccw:initDoc` | 初始化 llmdoc 文档系统 |
| `/ccw:withScout` | 复杂任务：先深度调研，再执行 |
| `/ccw:what` | 通过结构化问题澄清模糊请求 |
| `/ccw:cli` | 使用多 CLI 工具进行分析或实现（需要 CLI 工具） |

### 4. 内部 Agents

| Agent | 用途 | 调用方式 |
|-------|------|----------|
| `worker` | 精确执行明确定义的计划 | `ccw:worker` |
| `investigator` | 快速、无状态的代码库分析 | `ccw:investigator` |
| `recorder` | 创建和维护 llmdoc 文档 | `ccw:recorder` |
| `scout` | 为 initDoc 进行深度调查 | `ccw:scout` |

## 工作流示例

### 新项目

```bash
/ccw:initDoc
```

### 日常开发

自然对话即可：

```
"认证系统是怎么工作的？"
# -> 自动触发 /investigate，优先读取 llmdoc

"添加一个用户资料的 API 端点"
# -> 读取 llmdoc，调研，实现，询问是否更新文档

"commit"
# -> 自动触发 /commit，生成智能提交信息
```

### 使用 CLI 工具（需要安装 NPM 包）

```
"/ccw:cli 分析认证模块的安全漏洞"
# -> 使用 Gemini 进行深度安全分析

"/ccw:cli 实现 Redis 缓存层"
# -> 使用 Codex 进行复杂实现
```

## 文档说明

详细的 Agent 使用说明请参考 `AGENTS.md`。

## 成本与效果

**诚实评估**：这套方案大概用 **1.5 倍的价钱**完成了从 85 分到 90 分的效果提升。

- 简单项目：效果一般
- 复杂项目：收益显著
- 生产级代码库（10万+ 行）：效果出色

---

由 **JRZhang** 精心打造
