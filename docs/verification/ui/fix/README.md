# METI-9 UI 修复验证（减弱动态 / 触摸 hover / 44px 命中区）

针对 METI-6 验收报告打回的三条 UI 偏差。本目录由 `scripts/check-ui.mjs` 生成：
所有判定都读**浏览器实际计算值与真实命中测试**，不是"CSS 规则存在即通过"。

- `getComputedStyle` 的 transform / box-shadow / border-color / transition-duration / outline
- `document.elementFromPoint` 逐点扫描（命中区宽高、中心可命中、命中区互相覆盖）
- `Input.dispatchTouchEvent`（真实 touch tap，不是给元素加 class）
- `Emulation.setEmulatedMedia` / `setTouchEmulationEnabled`（真实媒体查询求值）

## 怎么复现

```sh
export PATH=/Users/cwc/.local/share/fnm/node-versions/v24.22.3/installation/bin:$PATH
npm ci
npm run build
node scripts/check-ui.mjs                        # 只跑断言，退出码 0/1
node scripts/check-ui.mjs \
  --screenshots docs/verification/ui/fix \
  --json docs/verification/ui/fix/report.json   # 同时落截图与逐项 JSON
node scripts/check-ui.mjs --origin http://localhost:41030   # 对运行中的预览环境复测
```

- 默认直接服务 `dist/`（产物即被测对象，不依赖任何进程）；`--origin` 可对 `astro dev` / `npm run preview` 起的地址复测。
- 脚本自带静态文件服务器与 headless Chrome 驱动（CDP），无额外依赖，可在任意干净 checkout 复现。
- 需要本机 Chrome/Chromium，可用 `CHROME_PATH` 指定；找不到会明确报错，不静默跳过。
- 对 `astro dev` 复测时脚本会隐藏 `astro-dev-toolbar`（开发工具条，不属于站点产物，会浮在页脚上方遮住链接），并在输出里注明。要让预览也不显示它，需在根配置设 `devToolbar: { enabled: false }`（`astro.config.mjs` 属 Dev1 文件边界，本次未改）。

## 断言覆盖（103 项 = 5 视口 × 5 页面 × 4 类 + 3 个状态机）

| 类别 | 断言内容 |
| --- | --- |
| 布局不回退 | 容器 820/768/761/760/375 含 padding、内容宽 756/704/697/720/335、宽屏 2 列窄屏 1 列、gap 26px、卡片圆角 18px、基础字号 16px、正文 16/15px |
| 无根横滚 | `documentElement.scrollWidth === clientWidth` |
| 命中区 | 每个 `a[href]`/可聚焦控件：`elementFromPoint` 实测命中矩形 ≥ 44×44、中心可命中、命中区互不覆盖造成误路由；跳至正文聚焦后单独测 |
| 焦点 | 逐次 Tab：2px solid `#1a1a1a` outline / offset 2px、不被 `overflow` 祖先裁切、Tab 顺序等于 DOM 顺序 |
| fine pointer hover | 卡片 `translateY(-5px)`、封面 `scale(1.04)`、阴影、边框 `#d5d5d5`、标题划亮 `100% 42%`（确认修复没把正常 hover 一起降级） |
| reduce | hover 与 focus-within 均无位移无缩放、箭头不移动、`transition-duration` 全为 0.01s、键盘轮廓仍可见 |
| 触摸 `(hover:none)` | 真实 tap 卡片非链接区域后无 sticky 升起/阴影/放大，边框回默认，键盘焦点仍 2px ink |

## 本次结果（2026-11-14，Chrome 157，DPR 1，视口高 1000px）

`103/103 项通过`，逐项见 `report.json`（产物）与 `report-preview-41030.json`（`astro dev` 预览环境 `http://localhost:41030` 的同一套断言）。
`report.json` 里每条 `hit-targets` 都带 `items` 逐个元素的实测命中矩形，复验时可直接对照，不必信汇总值。

| 场景 | 修复前（METI-6 复现） | 修复后实测 |
| --- | --- | --- |
| reduce + hover 卡片 | `matrix(1,0,0,1,0,-5)` | `none` |
| reduce + hover 封面 | `matrix(1.04,0,0,1.04,0,0)` | `none` |
| reduce + focus-within 卡片/封面 | 同上，未取消 | 均 `none` |
| reduce + 更多箭头 | `matrix(1,0,0,1,6,0)` | `none` |
| reduce transition-duration | 0.01s（当时已正确） | `0.01s`（三项全部） |
| hover:none tap 后卡片 | 升起 -4.27px、hover 阴影、边框 `rgb(219,219,219)` | `matrix(1,0,0,1,0,0)`、`box-shadow: none`、`rgb(232,232,232)` |
| hover:none tap 后封面 | `scale(1.0255)` | `matrix(1,0,0,1,0,0)` |
| 375px 导航 首页/归档/关于 | 34×39 / 33.5×39 / 34×39 | 44×44 / 44×44 / 44×44 |
| 375px 品牌 | 59×42（高度不足） | 45×44 |
| 375px 页脚 RSS / 站点地图 | 26×17 / 63×17 | 44×44 / 50×44 |
| 375px 卡片标题链接 | 196×33（短标题横向不足） | ≥ 196×44 |
| 375px 标签 pill | 51×34（高度不足） | 51×44 |
| 5 视口 × 5 页面最小命中区 | 34×39 | 44×44 |
| fine pointer hover（不得回退） | -5px / 1.04 | -5px / 1.04 |

截图：`<page>-<width>.png` 为 5 页面 × 5 视口整页；`state-reduced-motion-375.png`（reduce + hover）、
`state-touch-tap-375.png`（触摸 tap 后）、`state-focus-375.png` / `state-focus-1440.png`（键盘焦点）为状态证据。

## 与规格的三点说明（需要 PM / 架构确认，已写进 issue）

1. **375px 导航链接盒加宽到 44px（唯一改动布局盒的地方）**：窄屏 `type.nav-link` 10px 两字约 20px 宽、
   `space.mobile-nav` gap 14px。相邻命中区若各向外扩 12px 会重叠 10px，实测后一个会吃掉前一个的命中区
   （首页只剩 34×39），"≥44×44" 与 "不重叠误触" 无法同时成立。按 §8「通过布局命中区实现，不强行放大文字」
   把链接盒本身在窄屏设为 `min-width: 44px`（文字居中），**字号 10px 与 gap 14px 令牌不变**；
   宽屏（14px 文字 + 24px gap）命中区外扩不重叠，不需要此项，也不受影响。
2. **正文内联链接不强制 44×44**：WCAG 2.2 SC 2.5.8 对句子内联链接有例外；强撑 44×44 会覆盖行内相邻
   文字与其他链接，并破坏 §3 的正文行高与 §5 的段落节奏。断言对内联链接只验证中心可命中。
   若验收要求连内联链接也计入，需要先改规格里的正文行高/间距，再改实现。
3. **命中区用居中伪元素按需扩展**（`.tap::after`：`min-width/min-height: 44px` + `translate(-50%,-50%)`），
   替代原来固定 `inset: -12px -7px`。盒本身已够 44 时不额外外扩，避免不必要的互相覆盖；
   伪元素属于链接自身，不产生第二个可聚焦节点，也不会造成错误路由。
   卡片标题链接同时改为 `display: inline-block`（标题本身多行时整块算命中区），标题文字样式未变。

## 未覆盖 / 需要根配置的事项

- `astro dev` 会注入 `astro-dev-toolbar`（右下浮动开发工具条），它会盖住页脚链接。它是 dev 服务器的开发工具，
  不属于站点产物（`dist/` 与 `npm run preview` 无此元素）；本次未改 `astro.config.mjs`（Dev1 文件边界），
  复测脚本自动隐藏并在输出里注明。若希望预览也不显示，需在根配置加 `devToolbar: { enabled: false }`。
