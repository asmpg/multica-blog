# ADR 0001：博客 v1 技术栈与交付边界

- 日期：2026-11-14（Asia/Shanghai）。
- 状态：提请 PM 验收；本文技术选择已定稿，不代表实现已获启动许可。
- 对应任务：METI-2；范围基线：METI-7 于 2026-11-14 发布的验收标准评论 `01a1d844-b6db-7761-a6ca-b350c8066b44`。
- 后续规格：METI-3 负责 `docs/content-model.md`、`docs/design-spec.md`，本 ADR 不提前定义字段、分页数量、视觉 token 或增加产品能力。

## 1. 背景与仓库实况

v1 是公开、只读的博客：主页、文章、归档及分页、标签、关于、404，以及 RSS 和 sitemap。没有 CMS、登录、评论、数据库管理、搜索、多语言或实时数据需求。工程验收要求内容校验失败即停止构建、草稿不公开、页面元数据完整、构建字节级可复现。

本轮先读取 METI-7、METI-3、METI-4、METI-5，再检查仓库。首次 `git ls-remote https://github.com/asmpg/multica-blog.git` 成功但无任何 ref；平台 `repo checkout` 因没有可用默认分支失败，初始工作目录也不是 Git 工作树。没有假定已有应用、依赖锁文件或测试。本 ADR 的目录树是待实现方案，不是已存在的源码。

**空仓库基线交付**：首次交付时曾将无默认分支列为入库阻碍。随后任务协调者 Mika 在本 issue 明确要求以 ADR 和最小 README 直接建立 `main`，不创建缺少 base 的 PR。本轮据此只提交文档基线，使用普通 Git 初始化本地仓库并以非强制推送创建远端 `main`；不修改平台共享缓存，不提交运行时 AGENTS、私有取证下载或代理临时文件。实际提交 SHA 与推送结果记录在 issue 最终评论；后续 METI-3/4/5 从该 `main` 基线开 PR。本次直接落 `main` 是空仓库引导例外，不取消后续 PR 审阅要求，也不代表 PM 已验收规格。

## 2. 参考站调查如何影响选型

已实际通过 HTTP 取得首页、一篇文章页、一个列表页的 HTML 及其共同引用的两份 CSS。完整来源、SHA-256、提取值和未取得项见 `docs/reference/2026-11-14-tech-observations.md`。

- `/` 本次重定向到 `/en`；当前首页是作品/咨询/技能/文章等版块的个人站，不是单纯的博客列表。METI-7 的博客功能范围优先，不能据此擅自增加产品展示、咨询、技能市场或多语言。
- 响应头和资源路径表明本站响应来自 Next.js，且本次首页响应带预渲染标记；文章正文、列表内容已在初始 HTML 中。只能确认这些公开响应，不能反推其私有源码、内容存储和所有页面的渲染策略。
- 主容器 `.col` 的 `max-width:820px`、两列文章卡片、`760px` 媒体查询、系统字体、文章段落和黄色强调都来自普通 CSS。文章排版和栅格不要求 React、RSC 或服务端常驻进程。
- CSS 包含滚动显现、悬停、减弱动态效果相关规则。可用 CSS 和少量渐进增强达到必要效果，不应为了复制参考站的技术实现而引入完整交互框架。无 JS 时正文和导航必须可见、可用。
- 仅确认已取得 CSS 没有暗色模式选择器，未取得浏览器主题/滚动的实际运行证据；不据此承诺暗色模式。最终是否要求相关交互，由 METI-3 依据证据和 PM 范围冻结。

## 3. 决策总表

| 领域 | 选定方案 | 原因与必须满足的约束 |
| --- | --- | --- |
| 页面框架 | Astro 7.4.12，TypeScript 严格检查，静态输出 | 初始 HTML 承载完整内容，适合内容站；无需 React/Vue renderer、SSR adapter、服务器会话或数据库连接。 |
| 内容存储 | Git 内 Markdown 正文和 YAML frontmatter；作者/标签/站点配置使用本地 JSON；Astro build-time Content Collections 校验 | 内容改动通过 PR；没有在线发布后台；所有源数据在构建前可获得。详细集合、字段及关系以 METI-3 为准。 |
| 内容语言 | 仅 Markdown，不接入 MDX，不允许内容文件包含可执行组件或脚本 | 降低内容执行面、前端依赖和作者学习成本；未经授权不复制参考站文章和图片作为本站内容。 |
| 样式 | 原生 CSS、自有 CSS 自定义属性、Astro 组件局部样式；全局令牌和正文排版归 `/styles` | 可精确保留参考站声明值；不引入预设主题、组件库或会取整的间距尺度。 |
| 页面数据 | 构建期读取同一份经校验的已发布内容视图；前端只消费只读契约 | 发布过滤、排序、分页和 canonical 计算只有一个权威来源，防止页面、RSS、sitemap 各算一遍而不一致。 |
| RSS | 官方 `@astrojs/rss` 4.0.19，在构建期生成 `/rss.xml` | 使用内容记录的显式日期与规范 URL；不引入运行时接口。 |
| sitemap | Dev1 根据公共路由清单生成 XML；Dev2 提供静态端点薄封装，输出 `/sitemap.xml` | 固定满足 PM 要求的文件名；不依赖 sitemap 插件的默认分片/index 命名或默认 URL 推断。 |
| 测试 | Vitest 5.1.0：纯数据单元测试、构建产物集成测试；Node 脚本做两次构建比对 | 一条非 watch 命令可供本地和 CI 使用；截图和浏览器交互验证仍是 Dev2 的独立交付责任。 |
| 构建与发布 | npm 锁文件驱动的全量静态构建；GitHub Actions 验证后上传 `dist/` artifact | CI 不要求公网主机或第三方账号；发布单元是不可变静态产物，无应用运行时。 |
| 生产承载 | 按本文 HTTP 契约配置的 Nginx 静态站点，人工发布同一份 `dist/` | 不绑定云厂商；没有获批主机、域名和凭据时只交付 artifact，不自动部署公网。 |

这些版本于本轮通过 npm registry 查询，不是未经核验的“latest”。此后升级必须通过独立依赖变更和回归测试，不允许安装命令使用浮动 `latest`。

### 3.1 运行环境与依赖锁定

| 项目 | 冻结值 | 说明 |
| --- | --- | --- |
| Node.js | 24.22.3 LTS | `.nvmrc` 固定精确版本；Node 官方发布索引记录其日期为 2026-11-10。 |
| npm | 11.19.1 | 与上述 Node 官方发行版一致；`packageManager` 声明此版本。 |
| `astro` | 7.4.12 | registry 声明 Node `>=22.23.4`，npm `>=9.6.5`；不能使用当前代理环境的 Node 22.22.2。 |
| `typescript` | 6.0.3 | 不选 registry 当前最高的 7.0.2：`@astrojs/check` 0.9.12 的 peer 范围仅为 `^5.0.0 || ^6.0.0`。 |
| `@astrojs/check` | 0.9.12 | 构建前检查 Astro 与 TypeScript。 |
| `vitest` | 5.1.0 | Node 24 在其 engines 范围内；Vite peer 范围包含 Astro 使用的 Vite 8。 |
| `@types/node` | 24.19.2 | 对应运行环境的 Node 24 类型主版本。 |
| `@astrojs/rss` | 4.0.19 | RSS 生成依赖。 |

Dev1 使用精确版本声明和单一 `package-lock.json`，同时锁定自动解析的 peer/传递依赖；禁止用 `--force`、`--legacy-peer-deps` 隐藏不兼容。首次完整安装和实际组合兼容性验证属于 METI-4，本轮仅核对元数据与官方文档，不宣称依赖安装或构建已经通过。

### 3.2 被放弃的替代方案

| 替代方案 | 不选的理由 | 接受的代价或重新评估条件 |
| --- | --- | --- |
| Next.js / React，包括其静态导出 | 参考站使用 Next.js 不代表像素依赖该框架；当前范围不需要 RSC、SSR、应用状态和 React 组件生态。 | 放弃直接套用 Next 专属组件的便利；若 PM 后续批准登录或强交互应用，新增 ADR 再讨论。 |
| Hugo / Eleventy | 都能生成静态博客，但本项目需要统一的 TS 类型、内容 schema 和组件消费契约；不再引入第二种模板/配置语言或单独串接同等类型管线。 | Astro 有 `.astro`、内容集合和构建器的学习成本，不能声称其他方案无法还原视觉。 |
| Headless CMS / SQL / 在线 Markdown API | PM 已排除后台与在线发布；账号、备份、访问控制、网络抓取增加 Dev1 工作量并破坏离线构建前提。 | 作者必须走 Git；内容更新需要重新构建，没有即时发布。 |
| MDX / 前端 SPA | v1 正文无交互组件需求；SPA 首屏与可发现性增加额外工作，MDX 让内容成为可执行代码。 | 后续如需交互文章，再评估内容信任边界和必要的局部增强。 |
| Tailwind / CSS-in-JS / 现成 UI 主题 | 不是无法使用，而是此阶段不能带来比准确保留原始声明更直接的收益；预设样式易偏离逐 token 验收。 | 接受手工维护少量 CSS 与 token 的成本；不复制整站的无关 CSS。 |
| SSR / Serverless / 自动部署到 Vercel | 页面可在构建期确定；引入运行环境、云凭据和供应商配置没有 MVP 收益。 | 静态站没有按请求个性化；生产 Nginx 的 TLS/备份/运维需要人类提供资源。 |

## 4. 内容、路由与 SEO 的架构约束

1. 正文放在 `/content/posts`，作者/标签等本地数据也归 `/content`。集合入口为 Astro 的 `src/content.config.ts`，使用 build-time loaders；运行时不请求 GitHub、CMS 或参考站。集合定义、交叉引用、重复 slug 和非法日期必须在页面输出前校验。
2. 明确提供发布状态的公共视图。主页、文章路径、归档/分页、标签、RSS、sitemap 均从此视图生成；草稿及其私有元数据不能进入 HTML、客户端 JS、feed 或 sitemap。不能靠 CSS 隐藏或仅在列表中过滤。
3. `/`、`/posts/<slug>`、`/archive`、`/tags/<slug>`、`/about` 是 PM 已定页面入口。分页 URL、排序同日次序、标签 slug、空集合、未知路由和草稿访问规则由 METI-3 明确定义后才实现；不得由某个页面私自选择。无效文章/标签及超范围分页不得回退成首页的 HTTP 200。
4. 静态导出固定 `output: static`、站点根路径部署、`trailingSlash: never`、`build.format: file`。首页生成 `index.html`，其他页面按路由生成 `.html`，对外 URL 仍然不带 `.html`。具体分页 URL 规则仍归内容模型。
5. canonical 必须来自统一路由契约与 `SITE_URL`，不能直接照抄构建时可能带 `.html` 的 `Astro.url`。所有公开页面、RSS、sitemap 用同一规则；草稿和 404 不纳入公共路由清单。404 提供错误页 title/description，但不添加可索引的成功页面 canonical。
6. `SITE_URL` 为唯一站点源配置，传入 Astro `site` 和元数据生成器。本地缺省为 `http://localhost:4321`，便于不依赖域名运行；生产发布必须显式传入获批的 HTTPS origin，禁止将 localhost、参考站域名或虚构域名发布到公网。不支持子路径部署。
7. sitemap 确定性列出全部公开规范 URL；RSS 只含 published 文章。更新时间仅取内容的显式字段，不写构建时钟；若没有可信更新时间，不伪造 `lastmod`。XML 必须正确转义、能被解析。
8. Markdown 不接受任意原始 HTML、脚本、内联事件或危险 URL；非装饰图片必须有 alt。渲染安全校验和资源引用校验由 Dev1 负责，正文展示样式由 Dev2 负责。示例文本和资源使用自有/明确授权内容，构建时不得下载参考站素材。

## 5. 仓库骨架与唯一文件归属

以下是规划树，只定义文件落点和职责，不要求机械照抄组件拆分。目录中的具体文件名由所有者决定；已指明的框架入口、命令配置与公共规格路径除外。

```text
content/                         Dev1：posts/*.md、作者/标签/站点数据、示例内容
lib/                             Dev1：纯数据校验、发布过滤、排序/分页、URL/SEO/XML
src/
  content.config.ts              Dev1：内容集合配置，属于数据/构建配置例外
  server/                        Dev1：构建期内容适配及供页面消费的公共入口
  components/                    Dev2：页面组件、布局、SEO 标签展示
  pages/                         Dev2：全部 .astro 页面及静态 XML 端点薄封装
    index.astro
    posts/[slug].astro
    archive/                     分页文件布局在 METI-3 定规则后确定
    tags/[slug].astro
    about.astro
    404.astro
    rss.xml.ts
    sitemap.xml.ts
styles/                          Dev2：token、全局排版、响应式及组件样式
public/
  content/                       Dev1：经授权的内容图片等静态资源
  ui/                            Dev2：本站 UI 静态资源；不包含参考站版权素材
scripts/                         Dev1：产物校验、可复现检查等工程脚本
tests/
  content/                       Dev1：解析、schema、状态、URL/分页、XML
  build/                         Dev1：路由、元数据、草稿泄露及产物检查
  ui/                            Dev2：视口、computed style、键盘/交互证据
docs/
  adr/0001-tech-stack.md          架构；后续变更须架构审阅
  content-model.md               架构，METI-3 产出
  design-spec.md                 架构，METI-3 产出
  reference/                     架构：公开参考取证及限制说明
  development.md                 Dev1：实际安装/构建/部署说明
  verification/                  Dev1/Dev2 各写自身证据子目录，PM 写验收报告
.github/workflows/               Dev1：安装、构建、测试、artifact
.nvmrc                           Dev1
package.json                     Dev1：唯一依赖与 scripts 写入者
package-lock.json                Dev1
astro.config.mjs                 Dev1：共享框架/构建配置
tsconfig.json                    Dev1
vitest.config.ts                 Dev1
README.md                        Dev1：开发入口；不得覆盖架构规格
```

### 5.1 跨边界协作规则

- 保留 METI-4/5 的原边界：Dev1 不编辑 `/src/pages`、`/src/components`、`/styles`；Dev2 不编辑 `/content`、`/lib`、`/src/server`。没有“为了打通构建临时越界”的例外。
- `src/server` 只是构建期适配代码的归属名，不意味着新增运行时服务器或 HTTP API。Dev1 向页面提供经 schema 校验的只读数据、规范路径/SEO 信息、分页结果及 XML 数据/生成能力；Dev2 的页面只负责接入与渲染，不重复实现数据规则。
- Dev2 拥有所有文件路由，包括 RSS/sitemap 的静态端点文件；Dev1 拥有它们所调用的生成能力。Dev1 不通过擅自写 `src/pages/*.ts` 完成自己的 SEO 指标；前端 SEO 组件同样由 Dev2 消费 Dev1 产出的元数据。
- 两个 Dev issue 都提及构建配置，实际按文件分开：Dev1 是上述根配置和锁文件的唯一写入者；Dev2 的局部 Astro 样式和 `/styles` 无需另加构建器。Dev2 如确需依赖、CSS 处理器或全局构建调整，在 issue 提出需求，由 PM 协调 Dev1；不得抢改共享配置。
- schema/数据消费契约先在 METI-3 冻结，Dev1 再提供经过类型检查的公共入口和契约用例，Dev2 接入。两位开发不能各自补字段、URL 或 mock 契约。
- Dev1 可先验证数据、XML 和构建基础；**完整页面输出、所有 HTML 元数据、HTTP 404 等必须在 Dev2 页面接入后联合验证**。这是既有文件归属的必然依赖，不是放宽 METI-4 的完成标准；无完整页面时不得声称 METI-4 已满足全部验收。

## 6. 可直接执行的本地流程与命令契约

**适用前提**：仓库已初始化，PM 已验收 METI-2/3，Dev1 已落地配置、锁文件和脚本，Dev2 已落地页面。当前纯文档交付没有 `package.json`，下面不是已经运行成功的日志，也不能在今天的空目录直接启动应用。

### 6.1 Dev1 首次建骨架

安装 Node 24.22.3（例如使用已安装的 nvm），确认 `node --version` 为 `v24.22.3`、`npm --version` 为 `11.19.1`。在仓库根目录按本文版本清单完成配置与依赖初始化；可使用以下精确安装命令生成锁文件，之后所有人改用 `npm ci`：

```sh
npm install --save-exact astro@7.4.12 @astrojs/rss@4.0.19
npm install --save-dev --save-exact typescript@6.0.3 @astrojs/check@0.9.12 vitest@5.1.0 @types/node@24.19.2
```

这两条命令只初始化依赖，不自动实现配置、测试或页面。Dev1 不运行未经固定版本的脚手架，不安装 React、CMS、Tailwind 或 sitemap 插件。所有新增必需依赖仍需保留锁文件与兼容性证据。

### 6.2 从干净 checkout 开始

在仓库根目录，使用 nvm 的开发者可执行：

```sh
nvm install 24.22.3
nvm use 24.22.3
npm ci
```

不用 nvm 时，预装相同 Node/npm 后直接 `npm ci`。网络仅用于首次依赖安装；不要求数据库账号、部署平台账号或生产域名。

| 目的 | 开发者命令 | Dev1 必须提供的 package script / 行为 |
| --- | --- | --- |
| 一条命令本地开发 | `npm run dev` | `astro dev --host 127.0.0.1 --port 4321`，地址 `http://localhost:4321`；启动前也能发现不合法内容。 |
| 一条命令完整构建 | `npm run build` | `astro sync && astro check && astro build`；有校验/类型错误立即非零退出；生成 `dist/`，无外部内容抓取。 |
| 一条命令测试 | `npm test` | `npm run build && vitest run && node scripts/check-reproducible.mjs`；禁止 watch，禁止无测试时以成功代替覆盖。 |
| 构建结果预览 | `npm run preview` | `astro preview --host 127.0.0.1 --port 4321`；先停止占用同端口的 dev 服务。预览工具不是生产服务器。 |

命令失败不能忽略退出码继续发布。通过同一命令覆盖 PM 的 F/E 检查点，不把必须的前置步骤藏在本机缓存里。`npm run build` 的源内容/资源语义校验必须在出站之前执行；仅运行 `astro check` 不足以代替内容交叉校验。

### 6.3 测试与可复现检查的验收含义

- `tests/content` 覆盖必填字段缺失、错误类型、非法 slug/日期、重复项、作者/标签引用、草稿排除、排序和分页、路径与 SEO 元数据规则。具体边界值采用 METI-3，不在测试中另定协议。
- `tests/build` 从实际 `dist/` 检查所有要求页面、规范 URL、唯一非空元数据、RSS/sitemap 可解析且与页面一致；对 HTML、XML、JS 等全部公开产物检查草稿标识/私有内容未泄露。不能只有 schema 测试而没有产物检查。
- `scripts/check-reproducible.mjs` 是 Dev1 的交付：串行执行两次清理缓存的完整构建，在 `dist/` 之外保存首轮清单；以相对路径排序并逐文件比较 SHA-256。比较全部 HTML、CSS、JS、图片、RSS、sitemap；不得忽略日期字段、hash 文件名或动态片段。临时目录须隔离，构建不能与同目录的其他构建并行。
- 可复现的输入包括同一源码/内容、锁文件、Node/npm、操作系统/架构、构建配置与 `SITE_URL`。CI 在相同 runner 环境执行上述比较；不承诺跨平台的二进制图片处理结果天然相同。
- 输出不能含当前时间、随机 ID、环境机器路径、网络内容或不稳定的集合遍历顺序；页面/文章日期取显式内容字段。源码允许更新时间字段，但不得用 `Date.now()` 或当前 Git checkout 时间生成页面/feed 日期。
- Dev2 仍需在 375/768/1440px 及 design-spec 断点真实运行浏览器、验证键盘焦点和 computed style，并附截图。静态文件测试不等于已经验证 HTTP 状态、CSS 或可访问性；本 ADR 不新增强制的浏览器框架。

## 7. CI 与静态部署契约

### 7.1 CI

Dev1 的 GitHub Actions 使用同一 Node/npm 和锁文件，依次执行 `npm ci`、`npm run build`、`npm test`，全部通过后上传最终 `dist/` 为 artifact（保留 7 天）。`npm test` 内含构建是为了本地单命令可独立执行，CI 中重复构建是有意接受的成本，不得改成依赖上一步残留产物。

CI 不带部署 token，不自动覆盖生产。GitHub Actions 额度、仓库权限和 artifact 功能由仓库所有者提供；本地构建不依赖 Actions 可用。未取得 CI 运行结果时不得把工作流文件存在说成 CI 已通过。

### 7.2 对外 HTTP 行为

交付 `dist/` 给获批的 Nginx 静态主机，以站点根目录提供服务：

- `/` 返回 `index.html`；成功的 extensionless 页面 URL 映射到对应 `.html` 并返回 HTTP 200，canonical 不出现 `.html`。不能直接使用会暴露 `.html` 路由的默认目录服务配置。
- 请求 `.html` 或非根路径尾斜杠变体时，主机应重定向至内容模型中的唯一规范 URL；不能制造重复可索引页面。
- 未知文章、未知标签、草稿 URL、超范围分页（若模型规定 404）返回 `404.html` 与 **HTTP 404**；禁止 SPA fallback 到 `index.html` 的 HTTP 200。404 页面不能成为 sitemap 成员。
- `/rss.xml`、`/sitemap.xml` 返回 HTTP 200 和 XML Content-Type。指纹资源可长期缓存；HTML/XML 必须能重新验证，发布时整份切换产物，不能只上传部分页面。
- 静态主机不运行 Node，不需要数据库；TLS、DNS、Nginx 账号和发布凭据是外部资源，不在本 issue 默认可用。

Dev1 在 `docs/development.md` 写出实际主机配置与验证命令，最终用真实 HTTP 检查确认，而不是只检查 dist 文件存在。生产资源未提供时，本地 preview + artifact 是工程交付路径，不能谎称已经完成公网发布；PM 既定 MVP DoD 并未要求上线域名。

## 8. 代价、限制与风险

| 项目 | 明确代价/限制 | 应对与验收 |
| --- | --- | --- |
| 构建时长 | 内容修改需要全量构建，工作量随文章、分页和资源数量增加；测试还会额外构建多次。当前没有实现，**构建耗时未测**，不虚报秒数。 | Dev1 在真实示例规模下记录内容数、环境、耗时；增长到无法接受时另立增量构建 ADR，性能门槛由 PM 决定。 |
| 包体积 | `.astro` 默认静态渲染不要求页面 hydration；本文不引入客户端框架。图片、代码高亮及少量增强仍会占体积，**实际压缩后 HTML/CSS/JS/图片大小未测**。 | Dev1/Dev2 报告 dist 分类体积和页面资源；不承诺“完全没有 JS”或“零运行成本”，不擅设未获批准的性能阈值。 |
| 学习成本 | 团队需要了解 Astro 文件路由、build-time Collections、严格 TS 和 Vitest；既有熟悉程度未取得。 | 固定命令和归属，纯数据逻辑避免绑定页面框架；不拿未经调查的学习天数作承诺。 |
| 锁定风险 | `.astro` 模板、Collections loader 和构建集成与 Astro 绑定；依赖锁定后不能自动吸收修复。 | Markdown/JSON 可迁移，纯规则留在 `/lib`；通过升级 PR 维护锁文件；产物可换静态主机。 |
| 内容工作流 | 不能浏览器内编辑、定时发布或多人实时协作；Git 合并冲突需要处理。 | 满足 v1 边界；发布流程由 PR 触发重新构建。 |
| 字体与视觉 | 系统字体栈在不同 OS 上可能实际落到不同字体；参考站低对比文字不能未经检查照搬。 | METI-3 标清原样/等价替换并计算对比度，按 PM 的 AA 标准处理；跨平台不承诺逐像素截图相同。 |
| 发布行为 | 纯静态框架本身不能确保任意主机的 404、尾斜杠和 extensionless URL 行为。 | Nginx 必须满足上一节契约并验证；不宣称上传任意平台就可验收。 |

## 9. 冻结点、开放事项与下一步

**本 ADR 没有未决关键技术选择**：框架、内容来源、运行版本、样式、静态输出方式、测试入口、部署产物和文件所有者均已明确。

仍需记录且不得擅自填空的事项：

1. **仓库基线**：按 Mika 在本 issue 的明确补充，以文档直接建立 `main`；不创建无 base 的 PR。最终推送验证和提交标识以 issue 交付记录为准；若推送权限不足，应明确报告，不能声称已入库。
2. **PM 在 METI-3**：确认当前参考站首页已是个人作品站时，博客主页的视觉映射边界；技术选型不依赖这一选择，但不冻结设计之前不得让 Dev2 自行发明页面。
3. **仓库所有者，若以后要求公网发布**：提供获批 HTTPS origin、可用 Nginx 主机与发布权限。没有这些资源仍可本地运行与构建；不能将本地默认 origin 当生产配置。

验收与启动顺序保持 METI-7：PM 审阅本 ADR → 授权 METI-3 → 冻结字段/URL/视觉规格 → PM 决定启动 METI-4/5。**本轮不宣布页面/内容实现可以开始，不把下游 issue 从 backlog 改成 todo，也不把开放的设计问题伪装成已经解决。**

## 10. 官方依据与取证来源

以下链接用于复核技术事实；参考站原始响应摘要与提取限制见配套取证文件。

- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)：build-time 集合、loader、schema、内容渲染。
- [Astro configuration](https://docs.astro.build/en/reference/configuration-reference/)：`output`、`site`、`trailingSlash`、`build.format`；特别注意构建时 `Astro.url` 与静态主机行为的差异。
- [Astro deploy](https://docs.astro.build/en/guides/deploy/)：`dist/` 输出与静态部署。
- [Astro testing](https://docs.astro.build/en/guides/testing/)：Vitest 与实际浏览器测试的职责区别。
- [Node 官方发布索引](https://nodejs.org/dist/index.json)：Node 24.22.3 与随附 npm 版本。
- npm registry 的精确版本记录：`astro@7.4.12`、`@astrojs/rss@4.0.19`、`@astrojs/check@0.9.12`、`typescript@6.0.3`、`vitest@5.1.0`、`@types/node@24.19.2`。可用 `npm view <包>@<版本> version engines peerDependencies --json` 复核，不能以可安装元数据替代实际测试。
