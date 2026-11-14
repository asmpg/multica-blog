# oiloil.org 技术选型取证摘要（2026-11-14）

## 目的与证据等级

为 METI-2 判断渲染、样式及内容站架构提供证据，不是 METI-3 的最终 design-spec。本轮实际下载三页 HTML 和所引用 CSS；仅报告响应及 CSS 中能确认的值。没有执行浏览器 JavaScript、取得截图或测量 computed style；因此**以下是源 CSS 提取，不是浏览器运行验证，也不是已冻结的视觉 token**。

本轮不产出 `docs/design-spec.md`，不提前把未知值填成“原样复刻”。最终 token 分类、级联/响应式核验、页面骨架和可访问性替换都留在 METI-3。

## 采集清单

采集窗口：2026-11-14 04:16–04:21 UTC（北京时间 12:16–12:21）。使用公开 HTTP GET，不需要登录；首页另取响应头。首页 `/` 的响应为 307 到 `/en`，最终为 200；下列三页最终均成功取得 HTML。

| 角色 | 请求 URL | 页面证据 |
| --- | --- | --- |
| 首页 | `https://www.oiloil.org/` → `https://www.oiloil.org/en` | title 为 Oil® 的 Products / Design / Open Source 页面；h2 包含 Products、Consulting & learning、Skills、Articles、About、Elsewhere。 |
| 文章页 | `https://www.oiloil.org/articles/lark-cli-personal-workbench` | 初始 HTML 有文章标题、日期区域和正文段落，不需要先运行浏览器才能取得正文。 |
| 列表页 | `https://www.oiloil.org/en/articles` | 初始 HTML 有 Articles 标题及文章链接/卡片。 |

三页均引用以下两份 CSS（query 中 deployment id 是本次响应实际给出值）：

```text
https://www.oiloil.org/_next/static/css/9c1ceec4ce7ae3dd.css?dpl=dpl_DdSWSLEPPMSJYfth5WDyJ8tKtHXf
https://www.oiloil.org/_next/static/css/9e9e15dc9c706fd7.css?dpl=dpl_DdSWSLEPPMSJYfth5WDyJ8tKtHXf
```

首页响应头包括 `server: Vercel`、`x-powered-by: Next.js`、`x-nextjs-prerender: 1`。HTML 也包含 `/_next/static/` 资源。只能据此记录公开响应的技术特征，不能证明参考站版本、数据库、CMS、仓库结构或全站所有路由的实现。

### 内容指纹

以下 SHA-256 针对本轮保存的响应正文；原始下载保留在本运行私有取证区，**没有将整篇参考文章/整站样式重新分发为交付物**。摘要、指纹与来源可用于核对；未来站点更新后哈希不一致不应解释为原取证造假。需要原样离线复核的后续工作须另行获得允许的快照/截图，不能把摘要称作原始快照。

| 资源 | 字节数 | SHA-256 |
| --- | ---: | --- |
| 首页 HTML | 200217 | `3cc63a889bcb0cebd65c74330aa21c9d400b85c7cc1b298f2634a41336664aed` |
| 文章 HTML | 48245 | `2b3103ccdf132418cc2c8101a1f018dc1a3171d1a3568de03b87db6fde786ca8` |
| 列表 HTML | 303605 | `4c12a296a3779247766eebdf04b47b0a5207f88ea82ef2bb851a52ad9a572d9b` |
| `9c1ceec4ce7ae3dd.css` | 49867 | `dd0d6b35b576c8365a2c664ef48b8345ae09f8bf2463d08a4745d345c2110fd5` |
| `9e9e15dc9c706fd7.css` | 51751 | `6f74316b94453119fdc002c45072373089ab809fe756bc2de9559a16001ce03e` |

## 源 CSS 观察值

下表只列支撑选型的有限技术事实，非完整样式表，也未把不同媒体查询的声明混作单一最终值。METI-3 必须核对选择器确实命中对应元素及级联顺序后再冻结数值。

| 类别/选择器 | 实际声明值 | 对选型的含义 |
| --- | --- | --- |
| `body` 字体 | `Helvetica Neue,-apple-system,PingFang SC,Noto Sans SC,sans-serif` | 系统 fallback 栈，不需要为了复刻字体而引入字体下载服务；实际落字仍依 OS。 |
| `:root` 基础颜色 | 背景 `#fff`；主字 `#1a1a1a`；次字 `#555`；弱字 `#999`；线 `#e8e8e8`；强调 `#ffe28a`；浅底 `#f9f0d8` | 普通 CSS 自定义属性即可表达；弱字色还需逐用途做对比度审核。 |
| `.col` | 宽 `100%`，最大 `820px`，水平 auto margin，水平 padding `32px` | 单主容器，不需要布局组件库。 |
| `.alist` 基础声明 | 两列 `repeat(2,minmax(0,1fr))`；gap `26px` | 原生 grid 可直接表达。 |
| `.acard` | 圆角 `18px`，边框 `1px solid var(--line)`；`.acard-info` padding `18px 22px 22px`，gap `8px` | 固定 CSS 值，不依赖框架 token 的取整尺度。 |
| `.acard-title` | `19px`、字重 `800`、行高 `1.4`、字距 `-.01em` | 标题不必依赖远程字体/第三方排版插件。 |
| `.acard-excerpt` | `14px`、行高 `1.7`、两行截断声明 | 摘要显示样式可与内容解析解耦。 |
| `.article-title` | `clamp(30px,5vw,44px)`、`800`、`1.25`、`-.02em`；底距 `34px` | 流式标题字号为原生 CSS。 |
| `.article-body` 基础声明 | `16px`、行高 `2`、字距 `.01em`；段落色 `#333`、底距 `1.4em` | Markdown 渲染出的语义元素可按选择器精确排版。 |
| `.article-body h2` | `clamp(21px,3vw,26px)`、`800`、`1.4`、`-.01em`；margin `2.4em 0 1em` | 不需要移植参考站的页面框架。 |
| 正文图片/代码块/引用 | 图片圆角 `14px`；pre 圆角 `14px`、padding `18px 20px`；blockquote 左边框 `3px`、padding `14px 18px`、圆角 `0 12px 12px 0` | CSS 足以复刻这些形态；内容资源仍需合法来源。 |
| 响应式规则 | `max-width:760px` 与 `min-width:761px`；窄屏 `.alist` 一列、标题 `17px`、正文 `15px/1.95` | 后续规范必须保留真实断点，不能默认使用框架常见的 768px。 |
| 过渡缓动 | `--ease` 为 `cubic-bezier(.19,1,.22,1)` | 使用原生 transition 可表达。 |
| 正文链接 hover | 背景变为强调色；基础链接有强调色下划线；背景过渡 `.4s var(--ease)` | 已取得规则，尚未运行鼠标交互。 |
| `.article-back:hover` | 文字变为主字色；基础颜色过渡 `.5s var(--ease)` | 不要求客户端路由或 React state。 |
| `.rev` | 初始 opacity `0`、translateY `30px`；opacity/transform 过渡 `1.3s` | 类切换可能需要 JS；不能把“初始隐藏”直接移植，导致静态页无 JS 时不可读。 |
| 媒体能力查询 | 包含 reduced-motion、hover/pointer 能力规则 | METI-3 需确认完整规则和降级行为，不能只移植动画时长。 |

## 未取得与必须后续确认的部分

- **浏览器 computed style、实际 hover/focus、滚动触发时机、禁用态、运行截图：未取得。** 没有截图依据，不作“基于截图推断”的数值承诺。
- **暗色模式运行行为：未取得。** 两份已取得 CSS 未发现 `prefers-color-scheme`、`data-theme`、`.dark`；不能据此证明其他资源或后续版本绝对没有暗色模式。
- **参考站内容存储、框架精确版本、源 schema、私有部署逻辑：未取得。** 不从 Next.js 资源名推导 CMS/数据库。
- **完整视觉规范：尚未产出。** 阴影、全部间距、所有状态、页面骨架、对比度及原样/替换分类属于 METI-3，不将本文件的一部分 CSS 观察冒充完整规范。
- **范围映射：需 PM 在 METI-3 明确。** 当前参考首页的作品/咨询/技能版块不是已批准博客功能；本轮不增加相关页面或后台能力。

## 可复核方式

用公开 HTTP 工具 GET 上述三个 URL 并保存响应，再从 HTML 的 stylesheet link 获取 CSS；核对相关选择器、媒体查询上下文和当前页面元素。若 deployment 资源已失效，记录新的采集日期与指纹，不用新响应覆盖旧证据而不标版本。实际视觉结论必须补浏览器视口与状态记录后进入 design-spec。
