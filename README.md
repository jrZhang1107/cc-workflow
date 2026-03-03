# CC-Workflow

多 CLI 协作框架 + llmdoc 文档驱动开发（Claude Code Plugin）

## 🚀 安装

### 方式 1: npx 安装（推荐）

```bash
npx cc-workflow
```

运行后按提示在 Claude Code 中执行：

```
/plugin marketplace add C:\Users\<你的用户名>\.claude\plugins\cc-workflow
/plugin install llmdoc-ccw@cc-workflow-marketplace
```

重启 Claude Code 即可使用。

### 方式 2: 本地开发测试

```bash
claude --plugin-dir ./llmdoc-ccw
```

### 方式 3: GitHub marketplace

将项目推到 GitHub 后：

```
/plugin marketplace add your-username/cc-workflow
/plugin install llmdoc-ccw@cc-workflow-marketplace
```

### 卸载

```bash
npx cc-workflow uninstall
```

然后在 Claude Code 中执行：

```
/plugin marketplace remove cc-workflow-marketplace
```

## 快速开始

安装后在 Claude Code 中：

```bash
# 初始化 llmdoc 文档系统
/llmdoc-ccw:initDoc
```

### Commands（显式调用）

| 命令 | 描述 |
|------|------|
| `/llmdoc-ccw:initDoc` | 初始化 llmdoc 文档系统 |
| `/llmdoc-ccw:withScout` | 复杂任务：先深度调研，再执行 |
| `/llmdoc-ccw:what` | 通过结构化问题澄清模糊请求 |
| `/llmdoc-ccw:cli` | 使用多 CLI 工具进行分析或实现 |

### Skills（自动触发）

| Skill | 触发词 | 描述 |
|-------|--------|------|
| investigate | "什么是"、"分析" | 快速代码库调查 |
| commit | "提交"、"commit" | 生成提交信息 |
| update-doc | "更新文档"、"同步文档" | 更新 llmdoc |
| read-doc | "了解项目"、"读文档" | 阅读 llmdoc 概览 |

### Agents

| Agent | 用途 |
|-------|------|
| worker | 精确执行明确定义的计划 |
| investigator | 快速、无状态的代码库分析 |
| recorder | 创建和维护 llmdoc 文档 |
| scout | 为 initDoc 进行深度调查 |

## 项目结构

```
cc-workflow/
├── .claude-plugin/
│   └── marketplace.json       # marketplace 清单
├── llmdoc-ccw/                # 插件目录
│   ├── .claude-plugin/
│   │   └── plugin.json        # 插件清单
│   ├── commands/              # 斜杠命令
│   ├── skills/                # 自动触发技能
│   ├── agents/                # Agent 定义
│   ├── references/            # 参考文档
│   └── doc/                   # 文档
├── bin/                       # CLI 入口
│   ├── setup.js               # npx 安装脚本
│   └── ccw.js                 # CLI 工具入口
├── src/                       # CLI 工具实现
├── package.json
└── README.md
```

## CLI 工具（可选）

独立于 Claude Code 使用多模型协作：

```bash
npm install -g cc-workflow

llmdoc-ccw cli -p "分析认证模块" --tool gemini
llmdoc-ccw cli -p "实现登录功能" --tool codex --mode write
```

## 开发

```bash
git clone https://github.com/your-org/cc-workflow.git
cd cc-workflow

# 本地测试插件
claude --plugin-dir ./llmdoc-ccw

# 或安装到本地 marketplace
node bin/setup.js
```

## 发布

```bash
npm login
npm publish
```

## License

MIT

---

由 **JRZhang** 打造
