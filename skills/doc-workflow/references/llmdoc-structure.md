# llmdoc 结构参考

## 目录布局

```
llmdoc/
├── index.md              # 从这里开始 - 导航与概览
├── overview/             # "这是什么项目？"
│   └── project-overview.md
├── architecture/         # "它是如何工作的？" (LLM 检索映射)
│   └── *.md
├── guides/               # "我该如何做 X？"
│   └── *.md
├── reference/            # "具体细节是什么？"
│   └── *.md
└── agent/                # 临时智能体报告 (自动清理)
    └── *.md
```

## 各类别用途

| 类别 | 回答的问题 | 内容类型 |
|----------|------------------|--------------|
| `overview/` | "这是什么项目？" | 高层上下文、目的、技术栈 |
| `architecture/` | "它是如何工作的？" | LLM 检索映射、组件关系 |
| `guides/` | "我该如何做 X？" | 分步工作流 (最多 5-7 步) |
| `reference/` | "具体细节是什么？" | 规范、数据模型、API 规格 |

## 阅读优先级

1. **始终**先阅读 `index.md`
2. **始终**阅读所有的 `overview/*.md` 文档
3. 在修改相关代码前，阅读相关的 `architecture/` 文档
4. 参考 `guides/` 了解分步工作流
5. 查看 `reference/` 了解规范和规格

## 文档规范

- **简洁性**: 每个文档不超过 150 行
- **无代码块**: 使用 `path/file.ext:line` 引用
- **Kebab-case**: 文件名使用 `project-overview.md` 格式
- **LLM 优先**: 为机器消费而编写
