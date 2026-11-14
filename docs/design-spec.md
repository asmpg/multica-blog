# 博客 v1 视觉与页面契约

- 版本：1.0；采集日期：2026-11-14（Asia/Shanghai）；任务 METI-3，范围依据 METI-7，栈依据 ADR 0001。
- 本文是提交验收的完整规格，不是已完成的页面；**PM 尚需确认第 2 节首页映射边界，确认前不得宣布页面实现可开工**。数值均已确定，不用“待定”代替 token。
- 取证入口：`docs/reference/2026-11-14-visual-evidence.md`。原始三页 HTML、两份完整 CSS、浏览器 computed style、交互状态、截图和 SHA-256 清单保存在 `docs/reference/oiloil-2026-11-14/`。

## 1. 证据等级与分类

实际 HTTP GET 首页 `/`（curl 本次307到 `/en`）、文章 `/articles/lark-cli-personal-workbench`、列表 `/en/articles`。三页按相同顺序加载 `9c1ceec4ce7ae3dd.css` 和 `9e9e15dc9c706fd7.css`。浏览器这次访问首页则停留 `/` 中文版；响应有语言/Cookie/User-Agent等Vary项，不能将curl结果说成所有访客固定重定向。两种首页共享本文取用的基础CSS，首页截图明确是浏览器中文版本；博客映射以实际列表页为准。

不能把 CSS 中不命中元素的声明当 computed style；本次补充 Chrome 157.0.8103.51 / macOS、DPR 1、1440/768/761/760/375 × 1000px 的实际测量。

下表分类用于 METI-7 V1–V6 验收；没有标为 R 的项目不能被称为参考站原值：

| 标记 | 含义 | 验收方式 |
| --- | --- | --- |
| R 原样复刻 | 真实 CSS 声明且有对应页面用途；包含明确注明的继承值 | CSS 表达式/稳定态 computed style 同值；浏览器矩阵舍入差不应当作不同 token |
| E 等价替换 | 因 Next.js → Astro/静态输出的结构差异替换，视觉角色不变 | 按本文具体值验收；说明等价依据，不声称运行机制相同 |
| A 可访问性替换 | 参考值不能满足已批准的 AA 或键盘/减弱动态要求 | 按替换后的明确值验收，不偷偷保留不可读原值 |
| N 博客适配新增 | 标签、作者、分页、无封面等博客语义或参考站未取得的元素 | 按本文确定值；组合已有 CSS 值时仍不是该元素的“原样”证据 |

**未取得**：参考站私有源组件/字体许可、所有设备上的实际落字、完整滚动脚本的阈值/物理参数、禁用分页状态（参考列表没有该组件）、H3–H6 实际文章样本。没有截图推断的数值冒充 CSS 值。本次有截图的部分仅辅助核对，数值以保存的 CSS 和 computed 为准。

## 2. 首页视觉映射边界（提请 PM 明确批准）

参考首页是个人产品/咨询/技能站，不是博客首页。本规格采用 **“参考列表页作为博客首页骨架”** 的映射：

| 参考语言/版块 | 博客 v1 的明确映射 |
| --- | --- |
| 共用窄容器、顶部品牌/链接、网格纸背景与淡黄光晕 | 保留其视觉数值；品牌显示 `site.name`，不用 OIL® 商标 |
| 文章列表 `.label + .alist + .acard` | 作为 `/` 最新 6 篇、归档、标签页的共同语言 |
| 超大 `Oil makes things` Hero、人物/吉祥物、首屏高度 | 不映射、不搬文案/图形；首页直接出现“最新文章”和文章卡片 |
| 产品 demo、咨询/学习、技能市场 | 不进入博客，METI-7 明确没有相应功能，不新增空壳入口 |
| About/Elsewhere、大型背景字与社交服务阵列 | About 改为批准的 `/about` 内容页；不照搬联系地址、履历或外链阵列 |
| 进度条、自定义光标、加载遮罩、滚动透视、跨页封面动画 | 不移植；静态内容默认可见，保留轻量 hover/focus 的视觉反馈 |
| 语言切换 | 不移植，v1 只支持 zh-CN；这不允许改动真实的 760px 断点 |

这不是“完整复刻全部业务”。PM 需要在本 issue 对上表首页映射答复同意或指出差异；**开放的是范围映射批准，不是 token 数值**。其他页面与字段可审阅，但本轮不自行启动 METI-4/5/6。

## 3. 字体与字号阶梯

### 3.1 字体引入

| token | 值 | 来源/分类 |
| --- | --- | --- |
| `font.sans` | `"Helvetica Neue", -apple-system, "PingFang SC", "Noto Sans SC", sans-serif` | R：`body`；系统字体，不使用 @font-face、Google Fonts 或远程字体请求 |
| `font.mono` | `ui-monospace, "SF Mono", Menlo, monospace` | R：`.acard-date`、`.article-date`、`.article-body code` |
| `font.smoothing` | `-webkit-font-smoothing: antialiased` | R：body；其他引擎遵循原生行为，不伪造跨平台同字形 |
| `type.base` | `16px / 400 / 1.5 / normal` | R：body computed + HTML 基础行高；margin/padding 归零 |

列值顺序为 **字号 / 字重 / 行高（无单位）/ 字距**。除 mono 角色外均使用 font.sans；所有标题和段落的颜色见第 4 节。全站 border-box、默认元素 margin/padding=0 为 R 的 reset 语义；E：用最小 reset 等价替代参考站 Tailwind preflight，不安装 Tailwind。

| token / 用途 | 宽屏 W > 760px | 窄屏 W ≤ 760px | 分类与来源 |
| --- | --- | --- | --- |
| `type.nav-brand` 品牌 | `14px / 400 / 1.5 / .12em` | `12px / 400 / 1.5 / .08em` | R：`.col>header` |
| `type.nav-link` 顶部导航 | `14px / 400 / 1.5 / .12em` | `10px / 400 / 1.5 / 0` | R：末尾 `.header-links>a` 覆盖继承字号；不要错抄成12px |
| `type.label` 列表页 H1/分区标签 | `14px / 400 / 1.5 / .4em` | 相同 | R：`.label`；其 H1/H2 weight 被末尾规则明确设400 |
| `type.post-title` 文章/关于/404 H1 | `clamp(30px,5vw,44px) / 800 / 1.25 / -.02em` | 同一 clamp | R：`.article-title`；映射关于/404 为 N，不改数值 |
| `type.body` 正文 p、li | `16px / 400 / 2 / .01em` | `15px / 400 / 1.95 / .01em` | R：`.article-body` + mobile 覆盖；正文 p 颜色为#333 |
| `type.h2` 正文 H2 | `clamp(21px,3vw,26px) / 800 / 1.4 / -.01em` | 同一 clamp | R：`.article-body h2`；不以框架默认 heading 替代 |
| `type.h3` 正文 H3 | `19px / 800 / 1.4 / -.01em` | `17px / 800 / 1.4 / -.01em` | N：参考正文 H3 未取得；借 `.acard-title` 已取得阶梯 |
| `type.h4` 正文 H4 | `16px / 800 / 1.4 / -.01em` | `15px / 800 / 1.4 / -.01em` | N：body 字号 + 已取得 H2 字重/行高/字距的组合，不是原站 H4 |
| `type.h5` 正文 H5 | `14px / 600 / 1.7 / normal` | 相同 | N：excerpt 字号/行高 + `.articles-more` 字重 |
| `type.h6` 正文 H6 | `14px / 400 / 1.7 / normal` | 相同 | N：excerpt 阶梯；层级靠语义和字重，不制造未取得字号 |
| `type.card-title` 卡片标题 | `19px / 800 / 1.4 / -.01em` | `17px / 800 / 1.4 / -.01em` | R：`.acard-title` |
| `type.excerpt` 卡片摘要/辅助说明 | `14px / 400 / 1.7 / normal` | 相同 | R：`.acard-excerpt`；宽屏2行、窄屏3行截断，保留完整可访问文本 |
| `type.card-date` 卡片日期 | `12px / 400 / 1.5 / .08em`，mono | 相同 | R：`.acard-date`；行高从base继承 |
| `type.post-meta` 文章日期/作者 | `13px / 400 / 1.5 / .12em`，mono | 相同 | 日期 R `.article-date`；作者 N 同角色，不新增字号 |
| `type.back` 返回链接 | `14px / 400 / 1.5 / .06em` | 相同 | R：`.article-back` |
| `type.more` 更多/文章末尾返回 | `15px / 600 / 1.5 / .04em` | 相同 | R：`.articles-more`、`.article-end a` |
| `type.chip` 标签/分页 | `12px / 500 / 1.3 / .04em`，mono | 相同 | N：借 `.article-copy` 的字体规则，不意味着新增复制按钮 |
| `type.footer` 页脚 | `14px / 400 / 1.5 / .2em` | `11px / 400 / 1.5 / .12em` | R：`.col>footer`；footer 必须限定为直接子元素，不能误取 demo 的内嵌 footer |
| `type.inline-code` 行内代码 | `.88em / 400 / inherit / inherit`，mono | 相同 | R：`.article-body code` |
| `type.pre` 围栏代码容器 | `14px / 400 / 1.7 / inherit` | 相同 | R：pre 字号/行高；字距继承正文已计算的宽.16px/窄.15px，不在pre重新计算.01em |

围栏内部 `pre code` 保留 `.88em`，所以实际代码文字字号为 **12.32px**；继承的是无单位行高 **1.7**，内部code的computed line-height为 **20.944px**，不是pre容器的23.8px。字体为font.mono，字距宽.16px/窄.15px。这是对保存CSS做隔离级联验证的结果，原文章样本没有pre节点；不得错误地把内部字当14px。行内code字号宽14.08px/窄13.2px，继承无单位行高后computed分别28.16px/25.74px，段落行框仍由整行内容决定。N：为便于语言无关AA验收，全部代码文字统一第4节code-fg，不引入未定义的低对比语法高亮色。

关键 computed 基准（1000px 高度）：1440 宽文章 H1=44px/55px、H2=26px/36.4px、body=16px/32px；761 宽 H1=38.05px；760 宽 H1=38px、body=15px/29.25px；375 宽 H1=30px/37.5px、H2=21px/29.4px。字距分别按表中 em 乘当前字号，允许浏览器序列化精度差。

## 4. 色板、背景与明暗模式

| token | 精确值 | 用途与分类 |
| --- | --- | --- |
| `color.bg` | `#ffffff` / rgb(255,255,255) | R：body 与卡片底色 |
| `color.ink` | `#1a1a1a` / rgb(26,26,26) | R：标题、链接、主要文字；A：聚焦轮廓 |
| `color.body` | `#333333` / rgb(51,51,51) | R：正文 p/列表 |
| `color.secondary` | `#555555` / rgb(85,85,85) | R：摘要、导航默认 |
| `color.muted-reference` | `#999999` / rgb(153,153,153) | 原站 R 取证值；**不用于博客可读文字**，只可用于 aria-hidden 装饰 |
| `color.muted` | `#555555` | A：标签标题、日期、作者、返回链接、页脚从#999替换，白底对比度从2.85升至7.46 |
| `color.line` | `#e8e8e8` / rgb(232,232,232) | R：卡片/封面/正文图片/文章末线；装饰性分隔，不单独作为控件状态唯一标识 |
| `color.line-hover` | `#d5d5d5` / rgb(213,213,213) | R：卡片 hover/focus-within 边框 |
| `color.highlight` | `#ffe28a` / rgb(255,226,138) | R：标题划亮、链接 hover、H2短横、引用左线；N：当前页/标签hover |
| `color.surface` | `#f9f0d8` / rgb(249,240,216) | R：封面空底、引用、行内代码 |
| `color.code-bg` | `#161616` / rgb(22,22,22) | R：pre 背景 |
| `color.code-fg` | `#f5f0e1` / rgb(245,240,225) | R：pre 文字 |
| `color.grid` | `#00000008` / rgba(0,0,0,8/255) | R：32px网格细线，不误记为8%透明度 |
| `color.fade` | `#ffe28a33` / rgba(255,226,138,.2) | R：顶部静态渐变起色 |

背景：R 保留 `.bg-grid` 的两层 `linear-gradient(#00000008 1px,#0000 0)` 与 `linear-gradient(90deg,#00000008 1px,#0000 0)`，`background-size:32px 32px`；R 保留 `.bg-fade` 的 `radial-gradient(80% 50% at 50% -10%,#ffe28a33,#0000 70%)`。均 fixed/inset0/pointer-events none，z0；内容 z2。

E：参考 `.field` 的漂浮光晕改为静止初始位置，opacity `.16`、不使用滚动/鼠标 transform。保留 b1 的40vmax方形/top -12vmax/left -10vmax，b2 的32vmax方形/top40vh/right -12vmax、圆角50%，背景 `radial-gradient(circle,#ffe28af5 0,#ffe28a94 45%,#ffe28a00 74%)`。这是从源关键帧起点保留视觉氛围的静态等价替换，不保证与原站任意动画帧像素相同。

**只做明亮模式**。本次 CSS 未发现 prefers-color-scheme、data-theme、.dark；浏览器模拟 dark 后 body 仍白底黑字。博客 dark 系统偏好下所有 token 不变，不新增主题开关；暗色运行中的所有第三方页面行为不在此证据范围内。

## 5. 间距刻度与尺寸

不把真实 `26px` 强行取整为24，也不套用通用4px系统。下表是此博客的**完整允许间距 token 集**；所有额外数值须经规格变更，不由 Dev 随手添加。单位保持原始 px/em/vh，不把相对值锁成某张截图的px。

| token | 值 | 用途 / 分类 |
| --- | --- | --- |
| `space.zero` | `0` | R：reset、无阴影态、blockquote p margin |
| `space.chip-x` / `space.chip-y` | `12px` / `8px` | N：标签/分页 padding，借 article-copy |
| `space.card-flow` | `8px` | R：卡片信息内部竖向gap；N：标签换行gap |
| `space.more-gap` | `10px` | R：更多文字与箭头 |
| `space.mobile-nav` | `14px` | R：窄屏导航gap；R：H2横线与文字gap、引用上下padding |
| `space.meta` | `16px` | R：文章元信息gap与底margin、label图文gap、footer gap |
| `space.card-top` | `18px` | R：卡片信息上padding；R：pre上下padding、引用左右padding |
| `space.mobile-gutter` | `20px` | R：窄屏容器左右padding；R：pre左右padding |
| `space.card-x-bottom` | `22px` | R：卡片信息左右及底padding |
| `space.nav` | `24px` | R：宽屏导航gap |
| `space.grid` | `26px` | R：卡片横/纵gap |
| `space.gutter` | `32px` | R：宽屏容器左右padding；R：窄屏footer底padding |
| `space.title` | `34px` | R：文章标题底margin、文章末区padding-top、更多链接margin-top、宽屏header padding-top |
| `space.footer-bottom` | `46px` | R：宽屏footer底padding |
| `space.label-bottom` | `48px` | R：列表label底margin，两种视口均不变 |
| `space.p-end` | `1.4em` | R：p/ul/ol底margin，em相对于该元素字号；R：列表左padding |
| `space.li` | `.4em` | R：li上下margin |
| `space.block` | `1.6em` | R：blockquote/pre上下margin，各自元素字号决定px |
| `space.image-top` / `space.image-bottom` | `2em` / `.8em` | R：正文图片上下margin，水平auto |
| `space.h2-top` / `space.h2-bottom` | `2.4em` / `1em` | R：H2上下margin；N：H3–H6用同系数，按各自字号算 |
| `space.inline-code-y` / `space.inline-code-x` | `.15em` / `.45em` | R：行内code padding，按code字号 |
| `space.back-bottom` | `5vh` | R：文章返回链接底margin |
| `space.cover-bottom` | `6vh` | R：文章封面底margin |
| `space.list-top` | `8vh` | R：列表section上padding；首页/归档/标签同值 |
| `space.article-top` | `9vh` | R：article上padding，窄屏不覆盖 |
| `space.content-bottom` | `12vh` | R：列表/article下padding；不要因通用section规则盖掉 `.articles-index` 的最终声明 |
| `space.end-top` | `8vh` | R：文章末返回区上margin |
| `space.footer-top` | 宽`12vh`，窄`8vh` | R：footer上padding，与前面main底padding叠加，不“优化掉” |
| `space.header-top-mobile` | `22px` | R：窄屏header上padding |

N：分页区距卡片列表 `34px`、项目间gap `8px`；标签组距前项gap `8px`、允许换行。N：文章标签区与正文之间 `16px`；封面存在时仍在标签区之后并有6vh底距，无封面则标签区后直接正文。关于页采用 article top/bottom 和正文段落节奏，不引入独立间距。

### 圆角、边框与阴影

| token | 值 | 用途/分类 |
| --- | --- | --- |
| `radius.none` | `0` | R：label、H2文字；N：焦点轮廓不强制圆形 |
| `radius.mark` | `2px` | R：H2黄色短横，尺寸22px × 3px |
| `radius.inline-code` | `6px` | R |
| `radius.quote` | `0 12px 12px 0` | R |
| `radius.body-media` | `14px` | R：正文图片/pre |
| `radius.cover` | `16px` | R：文章封面 |
| `radius.card` | `18px` | R：列表卡片 |
| `radius.pill` | `999px` | N：标签/分页，借 article-copy |
| `border.decorative` | `1px solid color.line` | R：卡片/封面/正文图片/文章末线 |
| `border.quote` | `3px solid color.highlight`（左侧） | R |
| `shadow.rest` | `none` | R：默认卡片；其余文字布局无额外阴影 |
| `shadow.card-active` | `0 3px 6px #0000000a, 0 26px 48px -18px #0000002e` | R：hover/focus-within；rgba序列化分别约.04与.18 |

## 6. 容器、栅格与断点

- R：容器 width100%、max-width **820px（包含padding）**、水平auto margin、border-box、min-width0。宽屏左右padding32px，窄屏20px；最大内容宽 **756px**，不是820px。不要再套一层820px内容容器。
- R：只用 **760px** 这个布局断点，`max-width:760px` 为窄屏；W>760用基础宽屏规则。原站另外的 min-width761仅控制英文作品tab，本博客无该tab；不增加768/1024等断点。760.5px仍按宽屏基础样式，不制造媒体查询空档。
- R：卡片宽屏 `repeat(2,minmax(0,1fr))`、gap26px；窄屏1列、gap仍26px。文章/关于只有一列，不新增浮动目录或侧栏。
- R：卡片封面16/9，内部 img width/height100%、object-fit cover。文章封面与正文图片width100%、height auto，按原始图片比例，不裁成长条。
- N：无cover卡片仍保留16/9的color.surface空底，无额外图标或“未上传”文字，不伪造示例图；该区域aria-hidden。文章无cover则整个封面区省略。
- N：导航与元信息允许flex-wrap，gap沿用相应token；不隐藏“关于”、不做汉堡菜单。长标题/URL/tags允许 `overflow-wrap:anywhere`，卡片title可自动换行，不设固定卡片高度。
- R/E：同排卡片等高、信息区流式；标签是N新字段，位于摘要之后，不能要求卡片高度与无标签的参考截图完全相同。
- 不得通过全页 overflow-x hidden/clip 隐藏实际布局错误；单独pre可内部横向滚动。正文、分页、导航在375px及所有验收视口不得造成根元素横向滚动。

| 视口宽 | 容器border-box宽 | 内容宽 | 卡片列/每列宽 |
| ---: | ---: | ---: | --- |
| 1440 | 820 | 756 | 2 / 365px |
| 768 | 768 | 704 | 2 / 339px |
| 761 | 761 | 697 | 2 / 335.5px |
| 760 | 760 | 720 | 1 / 720px |
| 375 | 375 | 335 | 1 / 335px |

## 7. 页面骨架与语义

全站顺序：键盘跳至正文链接 → aria-hidden静态背景 → `.col`内header/nav → `main#main` → footer。header是正常文档流，非sticky/fixed。品牌链接首页，导航依次“首页 / 归档 / 关于”；当前页面 `aria-current=page` 并用2px highlight下划线（offset4px）识别。N：不在文章页错误地把关于标为当前页。

footer：site.name + “RSS”（`/rss.xml`）+ “站点地图”（`/sitemap.xml`），按文档顺序，flex-wrap，gap16px，不显示动态年份、参考站品牌或未经授权联系方式。空数据状态仍保留header/footer。

| 页面 | main 内从上到下（不可交换） | 响应式/空态 |
| --- | --- | --- |
| 首页 `/` | 列表section → H1 label“最新文章” → 最新6篇alist → “全部文章 →”链接 `/archive` | 窄屏一列；空集合显示“暂无文章”，不显示占位卡片；仍有归档链接 |
| 归档 `/archive`及分页 | 列表section → H1 label“文章归档”（n>1附“第n页”）→ alist → 分页nav | 标题超长换行；空第一页显示“暂无文章”及不可点击上一/下一页；规则见content-model |
| 标签 `/tags/<slug>` | 列表section → H1 label“标签：{name}” → 存在时description（type.excerpt、底距16px）→ alist | 名称不截断；仅有公开文章才有此页；不新增侧边标签云 |
| 文章 `/posts/<slug>` | article → 返回“← 全部文章” `/archive` → 日期/作者元信息 → H1 title → 标签组（非空时）→ 可选cover → 完整body → 文章末返回区 | 元信息gap16px可换行；author显示name；日期显示YYYY.MM.DD，datetime仍YYYY-MM-DD；标签不改变数据顺序 |
| 关于 `/about` | article → H1（about.title）→ author.name（type.post-meta、底距16px）→ 完整about.body | 不渲染发布时间/虚构头像/个人履历；正文同文章排版，无cover模块 |
| 404 | article → H1“页面不存在” → p“请求的页面不存在。” → “返回首页”与“文章归档”链接组（gap16px） | HTTP404；不伪造成功canonical；正常header/footer可导航 |

列表卡片的信息顺序：cover或空底 → date → title → excerpt → tags（非空时）。N：标签/作者是博客必需字段，不能直接复制参考站“中文”语言提示当标签。卡片至少有一个以文章title为可访问名称的详情链接，标签是独立链接；**禁止嵌套a/button**。不强制哪种DOM拆分，必须同时满足独立标签激活、键盘顺序和视觉状态。

正文：H2前有22×3px黄色短横，与文字gap14px；H3–H6不加短横；p/列表/图片/code/blockquote按token表。有序列表显示decimal，无序列表显示disc（N：补齐参考reset移除默认marker的语义可读性），左缩进1.4em。blockquote p无底距。pre内部滚动不拖动全页，键盘可聚焦滚动并有“代码示例”可访问名称。正文默认可见，禁JS不影响内容、导航、分页和RSS。

## 8. 默认、悬停、聚焦与禁用状态

| 组件 | 默认 | hover（fine pointer） | focus-visible / focus-within | 禁用/当前 |
| --- | --- | --- | --- | --- |
| 导航/返回/页脚链接 | #555，导航无下划线；返回无背景 | color.ink；返回仅变色 | A：2px solid ink outline、offset2px；不取消文字语义 | 导航无禁用态；当前页见第7节 |
| 正文链接 | ink，highlight下划线2px、offset4px | highlight背景 | 同上轮廓 + highlight背景 | 不输出无href的伪正文链接 |
| 文章卡片 | 白底、line边框、无阴影、translateY0；封面scale1 | 边框line-hover、shadow.card-active、translateY(-5px)、封面scale1.04、title划亮从0×42%到100%×42%，位置0 68% | focus-within同hover；实际获焦链接另有2px ink outline/offset2px | 卡片无“禁用文章”状态；draft/archived不渲染 |
| 标签/分页pill | 文字#555，白底，line边框1px，padding8px12px，radius999px | ink字+highlight底/边框 | 同hover加2px ink outline/offset2px | 当前页ink字+highlight底+ink边框1px，aria-current；不可用prev/next用span、#555字+白底+line边框、opacity1，无href/tabindex |
| 更多/文章末链接 | ink、无底纹 | 文章末highlight背景；更多箭头translateX6px | 同hover并有轮廓 | 不提供禁用“更多”，即使空集合也可去归档 |

轮廓新增值是 A，不声称源CSS存在通用focus ring；源站本次卡片键盘聚焦只有UA outline与卡片focus-within样式，详见states.json。博客卡片外层不得裁切内层焦点：圆角封面自身可clip，但交互轮廓周围至少保留2px+2px可见空间。N：链接/分页可点击区域最小44×44px（通过布局命中区实现，不强行放大文字/卡片内部gap），全程使用原生鼠标指针。

### 运动与滚动

| token | 值 | 来源/使用 |
| --- | --- | --- |
| `motion.ease` | `cubic-bezier(.19,1,.22,1)` | R：root |
| `motion.nav` | `color .5s motion.ease` | R：header/back；N：footer用同值 |
| `motion.link` | `background .4s motion.ease` | R：正文链接 |
| `motion.card` | `transform .45s motion.ease, box-shadow .7s motion.ease, border-color .7s motion.ease` | R |
| `motion.cover` | `transform .8s motion.ease` | R |
| `motion.title` | `background-size .6s motion.ease` | R |
| `motion.more` | `transform .5s motion.ease` | R |
| `motion.chip` | `color .3s motion.ease, background-color .3s motion.ease, border-color .3s motion.ease` | N：借 article-copy，不引入其active位移 |
| `motion.reduce` | 全部transition/animation duration **10ms** | R：prefers-reduced-motion reduce；A：此时卡片不位移、封面不放大、箭头不移动 |

R：html scroll-behavior smooth；A：reduce时改auto。N：正文标题 `scroll-margin-top:34px`，标题锚点不被顶部正常流导航覆盖。E：不移植`.rev`默认opacity0/translateY30与1.3s显现，全部内容opacity1、transform none，没有观察器时也能读。无滚动劫持、首屏loading、滚动透视、全屏转场、脉动状态点或必需JS。reduce并不移除颜色/下划线/边框反馈。

触摸设备 `(hover:none)` 禁用仅由hover造成的卡片阴影/升起/封面缩放，键盘focus-visible仍显示轮廓；不以触屏的sticky hover保留放大图。参考hover:none覆盖部分边框/阴影/缩放规则，博客额外去掉位移为 A 的稳定阅读修正。

## 9. 可访问性与对比度

采用 WCAG 2.2 相对亮度算法：sRGB分量归一化，≤.04045除12.92，否则`((v+.055)/1.055)^2.4`；L=.2126R+.7152G+.0722B；contrast=(Lmax+.05)/(Lmin+.05)。下表四舍五入2位，仅显示值舍入、门槛判定使用未舍入值。

| 前景 / 背景 | 对比度 | 结论与用途 |
| --- | ---: | --- |
| #333 / #fff | **12.63:1** | 正文AA通过，正文无半透明文字 |
| #1a1a1a / #fff | **17.40:1** | 标题/主要链接通过 |
| #555 / #fff | **7.46:1** | 摘要、导航及替换后的次字通过 |
| #999 / #fff | **2.85:1** | 原站弱字连大字3:1也未达标；禁止用于可读信息 |
| #555 / #f9f0d8 | **6.56:1** | 引用/行内代码等浅底通过 |
| #555 / #ffe28a | **5.86:1** | 替换文字在高亮/最浓黄光晕下也通过 |
| #1a1a1a / #ffe28a | **13.67:1** | hover/当前页文字通过 |
| #f5f0e1 / #161616 | **15.88:1** | 代码文字通过 |
| #1a1a1a / #e8e8e8 | **14.20:1** | 聚焦轮廓即使邻接边框仍高于3:1 |

背景网格交叉可有两层8/255黑线叠加：即使保守取全浓度highlight再叠两层黑线的更暗背景，#555对比度仍约 **5.12:1**；实际渐变峰值与.16光晕均更淡。Dev2须用最终复合背景实测，不能只测透明层本身。卡片内容在不透明白底上。

AA门槛为普通文字≥4.5:1、大字≥3:1、必须辨识的控件/焦点≥3:1。line/highlight单独的浅色分隔不拿来作为唯一焦点/状态提示，信息有文字、下划线或ink轮廓。禁用分页使用可读文字而非opacity淡化。

语义：每页一个H1、header/nav/main/footer、归档/标签/首页文章集合用列表语义、分页nav有“文章分页”名称、time有机器日期、图片alt取内容字段且不得为空。跳至正文链接默认仅视觉隐藏，focus后展示（白底ink字、2px ink outline/offset2px、padding8px12px），不被clip；键盘顺序与阅读顺序一致，无正tabindex、无只靠hover显示的必要内容。

## 10. 验收矩阵与交付边界

1. 在375/760/761/768/1440px宽、1000px高、100% zoom记录首页/文章/归档/标签/关于；760和761都必须测，不能用768替代。分别核验第6节宽度/列数和第3节computed字体；根scrollWidth等于clientWidth。
2. 文章样例至少有H2–H6、长中文标题、超长URL、列表、引用、代码、带alt图片；无封面与有封面各一篇。核验所有默认/hover/focus/reduce状态，不用单张静态截图冒充状态测试。
3. 检查低对比弱字已经替换为#555；夜间系统设置仍是本规范明亮模式。无障碍树中的标题/链接名称非空，独立标签链接可激活，禁用分页不可点击。
4. 禁JS依旧能读正文、跳转与翻页；200/404/308和SEO按content-model执行。无首屏opacity0遗留或JS加载失败空白页。
5. CSS提取与截图是参考证据，**不是博客实现测试通过记录**；最终本地截图、键盘证据、产物测试由Dev在实现后提交。所有参考站原文、头像、封面、商标、demo均不作为本站资源发布。

数值与数据契约已完整提请验收；开放事项仅为第2节映射的PM审批。本轮不新增主题、产品/咨询入口或后台功能，不修改下游issue状态。
