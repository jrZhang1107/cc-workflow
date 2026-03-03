# CC-Workflow Marketplace

Claude Code 插件市场：多 CLI 协作框架 + llmdoc 文档驱动开发

## 安装

```bash
npx cc-workflow
```

然后在 Claude Code 中：

```
/plugin marketplace add <安装脚本输出的路径>
/plugin install llmdoc-ccw@cc-workflow-marketplace
```

重启 Claude Code 后即可使用。

## 包含插件

| 插件 | 描述 |
|------|------|
| llmdoc-ccw | 多 CLI 协作框架 + llmdoc 文档驱动开发 |

## 卸载

```bash
npx cc-workflow uninstall
```

在 Claude Code 中：

```
/plugin marketplace remove cc-workflow-marketplace
```
