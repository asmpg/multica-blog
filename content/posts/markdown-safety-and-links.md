---
slug: markdown-safety-and-links
title: 从原始 HTML 到可渲染正文：Markdown 安全边界与链接校验的完整实践记录
excerpt: 内容来自 Git，但正文仍然不可信：构建期拒绝原始 HTML、危险协议与失效链接，只放行经过校验的 Markdown 子集。
status: published
publishedAt: "2026-10-30"
updatedAt: "2026-11-02"
authorId: blog-team
tagSlugs:
  - design
  - build
series:
  slug: building-blog-v1
  order: 3
cover:
  src: /content/markdown-safety-and-links/cover.png
  alt: 一叠标有安全检查标记的文档
  width: 1600
  height: 900
---

正文是构建输入的一部分，因此校验必须发生在渲染之前。

## 允许的语法 {#allowed-syntax}

支持段落、H2–H6、列表、引用、强调、链接、图片与代码。每个标题都要写明 id：

```md
## 一个标题 {#heading-id}
```

## 拒绝的内容 {#rejected}

- 原始 HTML 与脚本。
- `javascript:`、`data:` 等危险协议。
- 指向草稿或不存在页面的本站链接。

> 危险内容不会静默丢弃，而是让构建失败并指出文件与字段。

正文图片必须提供有意义的 alt，例如[构建管线示意](/content/blog-v1-design-contract/pipeline.png)所用的示意图。
