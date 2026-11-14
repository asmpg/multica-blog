---
slug: static-site-build-pipeline
title: 一条命令产出整站
excerpt: 从内容校验到静态产物，构建管线把解析、过滤、排序、SEO 与 XML 生成串成一条可重复执行的命令。
status: published
publishedAt: "2026-11-08"
authorId: blog-team
tagSlugs:
  - architecture
  - build
categorySlug: project-notes
series:
  slug: building-blog-v1
  order: 2
seo:
  description: 静态构建管线的组成：内容校验、公开过滤、SEO 派生与可复现检查。
---

构建入口只有一条命令，失败时立即以非零状态退出。

## 管线组成 {#pipeline-parts}

1. 读取并校验内容。
2. 过滤出已发布文章并排序。
3. 生成页面数据与 SEO 元数据。
4. 输出 HTML、RSS 与 sitemap。

## 幂等性 {#idempotency}

同一份源码与锁文件重复构建，产物应逐字节一致。任何读取构建时钟或遍历顺序不稳定的代码都会破坏这一点。

可以回到[内容与视觉契约](/posts/blog-v1-design-contract)查看字段定义。
