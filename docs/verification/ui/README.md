# 前端验收证据（METI-5）

采集方式：Chromium（Chrome for Testing 157，DPR 1，视口高 1000px），对本地预览环境逐页实测 computed style、布局尺寸、交互状态与对比度。以下数值均为浏览器实测，不是源码推断。

## 目录

| 路径 | 内容 |
| --- | --- |
| `screenshots/<page>-<width>.png` | 各页面在 375 / 760 / 761 / 768 / 1440px 下的整页截图 |
| `env/<page>-1440.png` | 通过 `multica env start web` 起的预览环境（`http://localhost:41000`）截图 |
| `computed-style.json` | 各断点下逐选择器的 computed style 与布局测量 |
| `contrast-targets.json` | 对比度实测用的元素坐标与前景色（背景由隐藏文字后的合成截图取样） |
| `rss.xml` / `sitemap.xml` | 实测产出的 feed 与站点地图 |

## 断点与布局实测

| 视口 | 容器 border-box | 内容宽 | 卡片列 / 每列宽 | 根 scrollWidth === clientWidth |
| ---: | ---: | ---: | --- | --- |
| 1440 | 820 | 756 | 2 列 / 365px | 是 |
| 768 | 768 | 704 | 2 列 / 339px | 是 |
| 761 | 761 | 697 | 2 列 / 335.5px | 是 |
| 760 | 760 | 720 | 1 列 / 720px | 是 |
| 375 | 375 | 335 | 1 列 / 335px | 是 |

卡片 gap 恒为 26px，两种视口一致。760 与 761 分别实测，没有用 768 替代。

## 字号与排版实测（文章页）

| token | 1440 | 761 | 760 | 375 |
| --- | --- | --- | --- | --- |
| H1 `clamp(30px,5vw,44px)` / 1.25 | 44 / 55 | 38.05 / 47.56 | 38 / 47.5 | 30 / 37.5 |
| H2 `clamp(21px,3vw,26px)` / 1.4 | 26 / 36.4 | 22.83 / 31.96 | 22.8 / 31.92 | 21 / 29.4 |
| 正文 / 行高 | 16 / 32 | 16 / 32 | 15 / 29.25 | 15 / 29.25 |
| H3 / H4 | 19 / 16 | 19 / 16 | 17 / 15 | 17 / 15 |
| H5 / H6 | 14 600 / 14 400 | 同左 | 同左 | 同左 |
| 导航 | 14px / .12em | 14px / .12em | 10px / 0 | 10px / 0 |
| 品牌 | 14px / .12em | 14px / .12em | 12px / .08em | 12px / .08em |
| 页脚 | 14px / .2em | 14px / .2em | 11px / .12em | 11px / .12em |
| 围栏 `pre` / `pre code` | 14 / 23.8 · 12.32 / 20.944 | 同左 | 同左 | 同左 |
| 行内 code | 14.08 / 28.16 | 14.08 / 28.16 | 13.2 / 25.74 | 13.2 / 25.74 |

H2 黄色短横实测 `22×3px`、`#ffe28a`、`border-radius: 2px`、与文字 `gap: 14px`（`display: flex`，同参考声明）。

## 对比度实测（WCAG 2.2 相对亮度）

页面背景由网格（`#00000008` 双层）与 `.16` 不透明度光晕叠加，因此按最终合成背景取样，而不是只算纯白：

| 前景 | 最暗合成底 | 实测最低对比度 | 门槛 |
| --- | --- | ---: | --- |
| `#555`（次字/导航/日期/页脚/标签） | rgb(241,237,223) @1440 | **6.36:1** | 4.5:1 |
| `#333`（正文） | rgb(241,237,223) | **10.78:1** | 4.5:1 |
| `#1a1a1a`（标题/聚焦轮廓） | rgb(241,237,223) | **14.85:1** | 3:1（图形） |
| `#f5f0e1` on `#161616`（围栏代码） | — | **15.88:1** | 4.5:1 |
| `#333` on `#f9f0d8`（引用/行内代码） | — | **11.12:1** | 4.5:1 |
| `#1a1a1a` on `#ffe28a`（当前页/标签 hover） | — | **13.67:1** | 4.5:1 |

规格里的 `#999999` 弱字（2.85:1）没有用于任何可读文字，只保留为 token 备查。

## 交互状态实测

| 状态 | 实测值 |
| --- | --- |
| 卡片默认 | `transform: matrix(1,0,0,1,0,0)`、`box-shadow: none`、`border-color: rgb(232,232,232)`、标题划亮 `0% 42%` |
| 卡片 hover | `translateY(-5px)`、`rgba(0,0,0,.04) 0 3px 6px, rgba(0,0,0,.18) 0 26px 48px -18px`、`border-color: rgb(213,213,213)`、标题 `100% 42%` |
| 卡片 focus-within | 与 hover 同值，另加链接自身 `2px solid rgb(26,26,26)` outline / offset 2px |
| 禁用分页 | `<span aria-disabled>`，无 href / 无 tabindex，`opacity: 1`、`#555` 文字、`#e8e8e8` 边框 |
| 跳至正文 | Tab 首站；聚焦后 `2px solid rgb(26,26,26)` outline / offset 2px，不被裁切 |
| 键盘顺序 | 跳至正文 → 品牌 → 首页 → 归档 → 关于 → 卡片标题 → 标签 …，无正 tabindex |
| 减弱动态 | `transition-duration: 0.01s`，`scroll-behavior: auto`，卡片不位移、封面不放大、箭头不移动 |
| 触摸设备 `(hover:none)` | 卡片 `transform: none`、`box-shadow: none`、封面 `scale(1)` |

## 运行与错误

- 所有核心路由在 5 个视口下：`documentElement.scrollWidth === clientWidth` 全部成立，无横向滚动。
- 除刻意访问的 404 路由外，无 console error、无失败子资源（`badResponses` 为空）。
- `/archive/page/0`、`/archive/page/1`、`/archive/page/9`、`/posts/draft-editorial-workflow`、`/tags/unknown-tag`、`/posts/not-a-post` 均返回 HTTP 404。
- RSS 只含 published 文章，sitemap 只含公开路由；草稿 slug 未出现在任一产物。

## 说明

- 截图中的封面图为 Dev1 提供的占位素材，属 `/content` 与 `/public/content`，不在本 issue 的改动范围。
- 分页（`/archive/page/2`）的截图是在本地临时追加 4 篇示例文章后采集的：正式内容只有 4 篇 published，不足以产生第二页。临时内容未提交，已复原。
