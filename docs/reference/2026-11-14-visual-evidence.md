# oiloil.org 视觉取证与复核说明

采集日期：2026-11-14（Asia/Shanghai）。这是 METI-3 对 ADR 配套取证的补充，不改写 `2026-11-14-tech-observations.md` 历史结论。本轮保存了原始响应并补浏览器测量；源文件 SHA 与前轮摘要一致。

## 1. 实际取得的资源

目录：`docs/reference/oiloil-2026-11-14/`；`manifest.json` 记录 URL、原始响应落盘时间、字节数、SHA-256、浏览器和视口条件。**原始资源只作离线取证，不是本站可发布资源或素材授权**，不得复制到 public、正文或最终dist。

| 文件 | 来源/作用 | 字节数 |
| --- | --- | ---: |
| `home.html` | HTTP GET `https://www.oiloil.org/`，本次307后 `/en` 的200响应 | 200217 |
| `article.html` | `https://www.oiloil.org/articles/lark-cli-personal-workbench` | 48245 |
| `list.html` | `https://www.oiloil.org/en/articles` | 303605 |
| `base.css` | HTML首个stylesheet，构建名 `9c1ceec4ce7ae3dd.css` | 49867 |
| `components.css` | 第二个stylesheet，构建名 `9e9e15dc9c706fd7.css` | 51751 |
| `home-http-headers.txt` | 首页这次307与后续200的公开响应头 | 以manifest为准 |
| `key-rules.json` | 对原始CSS进行浏览器CSS解析后提取的相关规则，保留媒体/层上下文；不是原始文件的替代品 | 以manifest为准 |
| `computed.json` | 三页×五个宽度的元素getComputedStyle、布局矩形、实际URL与标题；无命中元素就不记录该选择器 | 以manifest为准 |
| `states.json` | 列表页默认、真实鼠标hover、Tab焦点、dark偏好与reduce偏好的computed结果 | 以manifest为准 |
| `cascade.json` | 原始base.css在隔离markup中的行内/围栏代码级联验证，不是原文章DOM测量 | 以manifest为准 |
| `home-1440.png` | 浏览器根路径中文首页，1440×1000，首屏 | 以manifest为准 |
| `article-1440.png` | 上述文章，1440×1000，首屏 | 以manifest为准 |
| `list-1440.png`、`list-375.png` | 上述列表，1440×1000 / 375×1000，首屏 | 以manifest为准 |

curl落盘时间为04:31–04:32 UTC（12:31–12:32上海时间）；浏览器测量随后完成。响应头date可以是CDN缓存内容的旧时间，不能把它误作本轮采集时间。

### 首页语言差异（必须保留）

curl本次收到307 `/en`，Vary包括 Accept-Language、Cookie、X-Vercel-IP-Country、User-Agent。Chrome本轮新会话根路径保持 `/`，标题“Oil® — 欧呦”，截图中中文入口为当前项。**没有证据能确定是哪一个协商因子造成此差异**，不宣称根路径恒定重定向或站点坏了。`computed.json` 的home URL与 `manifest.json` 的HTTP最终URL故意分开记录，不把不同变体拼成同一份HTML证据。

## 2. 采集和提取方法

1. 公开HTTP用 `curl -L --fail` 保存三页；从每页 `<link rel="stylesheet">` 获取两份CSS，保持文件字节不改写；dpl查询参数完整保存在manifest，未拿旧构建地址猜新值。
2. 原始CSS用Chrome的CSS解析器离线解析，遍历样式规则，媒体查询/层上下文一起保存到key-rules；不把源文件压平后丢失级联。注意现代CSSStyleRule本身也有cssRules，提取时必须先处理selectorText再递归分组，不能因为空cssRules漏掉全部规则。
3. Playwright驱动本机Chrome，headless，DPR1，viewport高1000；按1440→768→761→760→375宽度记录。每次读取getComputedStyle，不用屏幕量尺估字号；布局矩形只作数值交叉核验。浏览器默认zoom100%。
4. 截图前等待networkidle，并滚至页底/返回页首，等待约1.6s使普通reveal完成。动态背景仍按源站自行运行，截图不是固定动画帧基线；静态等价方案在design-spec另作说明。
5. hover用真实鼠标移入首卡、等待过渡结束；keyboard用Tab，不用给DOM硬塞focus类。每个状态保存active元素和activeStyle；laterTab命中第二张卡，所以不能拿第一张卡的样式判断键盘焦点是否生效。
6. emulateMedia分别设置colorScheme dark、reducedMotion reduce；dark时body仍为rgb(255,255,255)，reduce时卡片transition-duration为.01s。未实现博客代码，不能把参考站的通过情况当作本项目实现测试。

## 3. 可复核的关键源规则

以下是取自 `base.css` 的有限样式片段（选择器语义保持，不附整篇文章内容）；完整版/媒体查询顺序以源文件为准。

```css
:root{--bg:#fff;--ink:#1a1a1a;--t2:#555;--t3:#999;--line:#e8e8e8;--hl:#ffe28a;--illo:#f9f0d8;--ease:cubic-bezier(.19,1,.22,1)}
.col{width:100%;max-width:820px;margin:0 auto;padding:0 32px}
.alist{grid-template-columns:repeat(2,minmax(0,1fr));gap:26px;min-width:0;display:grid}
.acard-info{flex-direction:column;gap:8px;padding:18px 22px 22px;display:flex}
.acard-title{letter-spacing:-.01em;font-size:19px;font-weight:800;line-height:1.4}
.article-title{letter-spacing:-.02em;margin-bottom:34px;font-size:clamp(30px,5vw,44px);font-weight:800;line-height:1.25}
.article-body{letter-spacing:.01em;font-size:16px;line-height:2}
.article-body h2{letter-spacing:-.01em;gap:14px;margin:2.4em 0 1em;font-size:clamp(21px,3vw,26px);font-weight:800;line-height:1.4}
@media(max-width:760px){.col{padding:0 20px}}
@media(max-width:760px){.alist{grid-template-columns:1fr}.acard-excerpt{-webkit-line-clamp:3}.acard-title{font-size:17px}.article-body{font-size:15px;line-height:1.95}}
```

该片段是关键声明摘录，省去了与结论无关的同选择器属性及变量 `--eye-x/--eye-y`，不是完整CSS复制。字体栈、背景、hover shadow、focus-within、font inheritance等应同时查完整base.css/key-rules和design-spec。

## 4. computed 与状态核验结论

- 列表页：1440宽容器820含64px左右内距，内容756，卡片365；761宽内容697、两列335.5；760宽内容720、单列；375宽内容335。768不是断点。
- 文章：1440宽H1=44px/55px，正文16px/32px；760宽H1=38px、正文15px/29.25px；375宽H1=30px/37.5px。H2的clamp来自CSS，不是截图猜测。
- 卡片hover：translateY -5px、边框rgb(213,213,213)、两层阴影；标题background-size 100% 42%。键盘Tab至第二张卡时activeStyle也有 -5px与相同阴影。
- 焦点：当前Chrome对实际获焦链接的UA outline为 `rgb(0,95,204) auto 1px`、offset1px；**未取得参考站自定义的全局focus ring**。因此博客规定的2px ink轮廓明确标A，不谎称原样。
- 字体跨OS的实际fallback落字未取得；有的选择器继承HTML line-height1.5，必须保留继承而不是把未声明误写成normal。pre的内部code仍保留.88em，需要级联计算，样本文章没有pre节点，不称为该样本computed测量。
- `cascade.json` 另行验证pre=14px/23.8px、内部code=12.32px/20.944px；原因是1.7无单位行高继承后在子元素重新计算。字距则继承正文已计算的.16px/窄屏.15px，不能在pre上重新设.01em混淆两种继承规则。
- 参考弱字#999/白底只有2.85:1；design-spec明确替换成已存在的#555，所有可读信息按替换值验收。

## 5. 未取得与不可推断

- 未取得禁用分页组件、标签/作者的博客扩展组件、原站正文H3–H6样本；这些在规格中标N并给具体映射，不将其它页面的样式冒充原站组件。
- 未取得参考站全部滚动脚本阈值、视差/透视算法、任意动画帧的截图一致性。静态博客不移植这类效果，不能称“动画逐帧复刻”。
- 未取得私有数据模型、源码仓库、资源许可或全平台字体渲染证据。参考原文/封面/人物/商标只在取证文件中保留，不允许作为本站示例内容发布。
- CSS两份均已取得，没有把“需JS”当成字号/颜色拿不到的借口；不在三页或已取CSS里的其它页面/状态仍可能未知，报告不扩大为全站断言。

## 6. 复核命令与输出边界

仓库根目录可用 `shasum -a 256 docs/reference/oiloil-2026-11-14/base.css` 与manifest比对；其他文件同理。完整性检查应遍历manifest所有resources，不靠只核一个文件推断整个包未改。

复采必须另建带日期/版本的目录，记录新URL、截图条件与指纹，不能静默覆盖本轮证据。原始HTML是证据文件，可能包含Next序列化数据与外链，不要打开后将其误当离线可运行产品，也不要把参考站网络请求纳入博客构建依赖。
