# CC-Workflow

多 CLI 协作框架 + llmdoc 文档驱动开发

## 项目结构

本项目包含两部分：

### 1. NPM 包（CLI 工具）

提供 `ccw cli` 命令行工具，用于调用 Gemini/Qwen/Codex 等 AI 模型。

**安装**:
```bash
npm install -g cc-workflow
```

**使用**:
```bash
# 分析任务
ccw cli -p "分析认证模块的安全性" --tool gemini --mode analysis

# 实现任务
ccw cli -p "实现用户登录功能" --tool codex --mode write

# 继续上次会话
ccw cli -p "继续分析" --tool gemini --resume
```

### 2. Claude Code Plugin

提供文档驱动开发工作流、智能 Agents 和自动化技能。

**安装**:
```bash
# 添加插件市场
/plugin marketplace add https://github.com/your-org/cc-workflow

# 安装插件
/plugin install ccw@cc-workflow
```

详细说明请查看 [.claude-plugin/README.md](.claude-plugin/README.md)

## 特性

- **文档驱动开发**: 基于 llmdoc 的 LLM 友好文档系统
- **多 CLI 协作**: 支持 Gemini/Qwen/Codex 统一调用
- **智能 Agent**: investigator、worker、recorder、scout
- **自动化工作流**: 代码调查、文档生成、提交信息

## 快速开始

### 方式 1: Plugin 安装（推荐）

适合需要完整 llmdoc 文档驱动开发工作流的用户。

```bash
# 添加插件市场
/plugin marketplace add https://github.com/your-org/cc-workflow

# 安装插件
/plugin install ccw@cc-workflow

# 初始化文档系统
/ccw:initDoc
```

### 方式 2: 仅使用 CLI 工具

适合只需要 CLI 工具进行多模型协作的用户。

```bash
# 全局安装 CLI 工具
npm install -g cc-workflow

# 使用 CLI 命令
ccw cli -p "分析认证模块" --tool gemini
ccw cli -p "实现登录功能" --tool codex --mode write
```

## 项目目录

```
cc-workflow/
├── .claude-plugin/          # Claude Code Plugin
│   ├── manifest.json        # Plugin 配置
│   ├── README.md            # Plugin 说明
│   ├── CLAUDE.md            # 主配置文件
│   ├── AGENTS.md            # Agent 使用说明
│   ├── agents/              # Agent 定义（5个）
│   ├── commands/            # 命令定义（4个）
│   ├── skills/              # 技能定义（5个）
│   └── references/          # 参考文档
├── src/                     # CLI 工具实现
│   ├── cli.js               # 命令行接口
│   └── tools/
├── bin/                     # CLI 入口
│   └── ccw.js
├── package.json             # NPM 包配置
└── README.md                # 项目说明
```

## 开发

```bash
# 安装依赖
npm install

# 本地测试 CLI
node bin/ccw.js cli -p "test" --tool gemini

# 本地测试 Plugin
# 在 Claude Code 中使用本地路径安装
/plugin install ccw@file:///path/to/cc-workflow/.claude-plugin
```

## 文档

- [Plugin 使用说明](.claude-plugin/README.md)
- [Agent 说明](.claude-plugin/AGENTS.md)
- [CLI 使用规范](references/cli-tools-usage.md)
- [CLI 执行代理](agents/cli-execution-agent.md)

## License

MIT

---

由 **JRZhang** 精心打造
