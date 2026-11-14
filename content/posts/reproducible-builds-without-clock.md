---
slug: reproducible-builds-without-clock
title: 不读时钟的可复现构建
excerpt: 页面日期、RSS 时间与 sitemap 的 lastmod 都只取内容里的显式字段，构建结果不随执行时刻变化。
status: published
publishedAt: "2026-10-21"
authorId: blog-team
tagSlugs:
  - build
series:
  slug: building-blog-v1
  order: 4
---

可复现意味着同一输入得到同一输出。

## 时间的来源 {#time-source}

文章日期来自 `publishedAt` 与 `updatedAt`，不使用系统时钟，也不读取 Git checkout 时间。

## 验证方式 {#how-to-check}

连续构建两次，按相对路径排序后比较每个文件的 SHA-256。产物中不允许出现当前时间、随机 ID 或机器相关路径。

排序规则与 URL 规则见[一条命令产出整站](/posts/static-site-build-pipeline)。
