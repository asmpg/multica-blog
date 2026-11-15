---
slug: blog-v1-design-contract
title: 博客 v1 的内容与视觉契约
excerpt: 本项目用 Astro 静态输出和 Git 内 Markdown 管理内容，先固定字段、URL 与视觉规范，再进入实现和验收。
status: published
publishedAt: "2026-11-14"
updatedAt: "2026-11-14"
authorId: blog-team
tagSlugs:
  - architecture
  - design
categorySlug: project-notes
series:
  slug: building-blog-v1
  order: 1
cover:
  src: /content/blog-v1-design-contract/cover.png
  alt: 博客内容模型与视觉规范两份文档的示意图
  width: 1600
  height: 900
seo:
  title: 博客 v1：固定内容与视觉契约
  description: 记录博客 v1 采用的静态内容方式，以及 URL、发布状态和可访问性规范的边界。
  ogImage:
    src: /content/blog-v1-design-contract/og.png
    alt: 博客 v1 规格文档封面
    width: 1200
    height: 630
---

这个博客采用 Astro 静态输出，文章由 Git 内的 Markdown 文件管理。

## 先固定契约 {#contracts-first}

内容模型定义 slug、发布日期、作者和标签；视觉规范记录参考站 CSS 中实际取得的值。

### 字段与校验 {#fields}

- 必填字段缺失时构建直接失败。
- 草稿与归档文章不进入公开列表。
- 引用必须指向已注册的作者与标签。

## 再按规范验收 {#verify-contracts}

> 规格先于实现：URL、状态和元数据在写页面前已经确定。

正文需要覆盖常见排版元素，例如行内代码 `npm run build`、强调与[外部链接](https://docs.astro.build/en/guides/content-collections/)。

![构建管线示意](/content/blog-v1-design-contract/pipeline.png)

#### 有序步骤 {#ordered-steps}

1. 安装依赖。
2. 构建站点。
3. 运行测试。

##### 细节 {#details}

围栏代码保留原始缩进：

```sh
npm ci
npm run build
```

###### 备注 {#notes}

阅读[关于页](/about)可以了解项目介绍，也可以继续读[构建管线](/posts/static-site-build-pipeline)。
