# 开发与构建说明

本文件记录 Dev1 交付的内容管线、构建命令与部署契约；规格以 `docs/adr/0001-tech-stack.md`、`docs/content-model.md`、`docs/design-spec.md` 为准。

## 环境

- Node.js 24.22.3（`.nvmrc`），npm 11.19.1。
- 使用 nvm 时：`nvm install && nvm use`；使用 fnm 时：`fnm use`。
- 首次安装：`npm ci`。依赖版本全部精确锁定，禁止用 `--force` / `--legacy-peer-deps` 绕过。

## 命令

| 命令 | 行为 |
| --- | --- |
| `npm run dev` | 本地开发，`http://localhost:4321`；启动前完成内容校验 |
| `npm run build` | `astro sync && astro check && astro build`，产出 `dist/` |
| `npm test` | 构建 + `vitest run` + 两次完整构建的 SHA-256 可复现检查 |
| `npm run preview` | 预览 `dist/`，`http://localhost:4321` |
| `npm run check:http` | 启动一次性 `astro dev`（非 watch），按 content-model §5 核对公开契约后退出 |
| `npm run check:acceptance` | 在临时目录构建隔离 fixture，核对 6+1 分页、空集合与构建期校验失败 |

构建不联网抓取内容；内容校验失败时 `astro build` 前即非零退出。

## 目录职责

```text
content/                文章、作者/标签/分类/系列、站点配置、关于页
lib/                    纯数据校验、Markdown 安全渲染、发布过滤、排序分页、URL/SEO/XML
src/content.config.ts   Astro 内容集合（glob loader + 字段 schema）
src/server/content.ts   页面消费入口（构建期读取并校验全部内容）
scripts/                可复现性检查
tests/                  内容/URL/SEO/XML 测试与构建产物检查
public/content/         内容图片；仅公开内容引用的文件会进入 dist
```

页面与组件（`src/pages`、`src/components`、`styles`）由 Dev2 实现；页面只通过 `src/server/content.ts` 消费数据，不重复实现过滤、排序或 URL 规则。

## 页面消费入口

`src/server/content.ts` 在模块加载时完成一次校验，并导出：

- `home`、`about`、`posts`、`archivePages`、`tagPages`、`routes`、`notFound`。
- `getPost(slug)`、`getArchivePage(n)`、`getTagPage(slug)`、`getRoute(path)`：未命中返回 `null`，页面据此输出真实 404。
- `getRssXml()`、`getSitemapXml()`：XML 端点直接返回，`Content-Type: application/xml`。
- `getPublicAssets()`：可公开的内容资源清单。

所有 `PageSEO` 已包含最终 title、description、canonical 与 OG 字段；页面不再拼接站名或后缀。

## 环境变量

`SITE_URL` 是唯一站点源配置：

- 未设置时使用 `http://localhost:4321`，仅用于本地。
- 部署时必须显式传入获批的 HTTPS origin，例如 `SITE_URL=https://blog.example.com npm run build`。
- 不接受子路径、query、fragment、userinfo；`http` 只允许 localhost。

## 静态部署（Nginx）

`dist/` 以站点根目录提供：

```nginx
server {
    listen 443 ssl;
    server_name blog.example.com;
    root /srv/blog/dist;

    # .html 不是规范 URL；$request_uri 不受内部 try_files 重写影响
    if ($request_uri ~ "^/[^?]*\.html(\?|$)") {
        return 404;
    }

    # 已存在路径的尾斜杠变体 308 去尾斜杠（根路径除外）
    if ($request_uri ~ "^/(.+/)(\?.*)?$") {
        return 308 $1$2;
    }

    location = / {
        try_files /index.html =404;
    }

    location / {
        try_files $uri.html $uri =404;
    }

    error_page 404 /404.html;
    location = /404.html {
        internal;
    }
}
```

要求：

- `/`、`/posts/<slug>`、`/archive`、`/archive/page/<n>`、`/tags/<slug>`、`/about` 返回 200。
- 未知文章、未知标签、草稿 URL、非法页码返回 `404.html` 与 HTTP 404，不回退首页。
- `/rss.xml`、`/sitemap.xml` 返回 200 与 XML Content-Type。
- 发布时整份切换 `dist/`，不要只上传部分文件。

## 本地预览的 HTTP 契约

`astro dev` 默认把 `public/` 原样公开，并把 `about` 也当成 `/about.html` 可访问，和部署后的 Nginx 行为不一致。`astro.config.mjs` 的 `dev-public-contract` 插件在请求进入 Astro 路由前执行同一份契约：

- 公开路由（来自 `lib` 的同一份路由清单）返回 200。
- 已存在公开路径的尾斜杠变体返回 **308**，`Location` 精确为规范路径（查询串保留）。
- `.html` 地址、未知路径的尾斜杠变体、未知路由返回 **404**。
- `/content/` 下只公开被 published 文章、关于页或站点默认图引用的文件；草稿/归档独有图片返回 404。
- `/rss.xml`、`/sitemap.xml` 返回 200 与 XML Content-Type。

`trailingSlash` 只在 dev 下为 `ignore`：Astro 的尾斜杠中间件会在任何插件之前直接 404，先放开再由插件统一发 308。构建产物仍是 `trailingSlash: 'never'` + `build.format: 'file'`。

`npm run check:http` 在随机端口启动一次 dev 服务器、跑完检查后退出，可与已运行的预览并存（`--ignore-lock`，不写锁）。

`astro preview` 只提供已裁剪的 `dist/`，不经过这段 dev 插件；`.html` 与尾斜杠行为以 Nginx 配置为准。

## 验收 fixture

`npm run check:acceptance` 不读写正式 `content/`：把 `tests/fixtures/acceptance/` 复制到临时目录，连同 `src`/`lib`/`styles`/构建配置一起真实构建，再按静态主机契约提供 HTTP。覆盖：

- 7 篇 published（含同日两篇）、1 篇 draft、1 篇 archived、仅被私有文章使用的标签；归档 6+1、顺序、不重不漏、第二页 canonical 自指、越界页码 404、私有内容与独有图片不可达。
- 0 篇 published：首页与归档 200 且显示“暂无文章”，空标签与第 2 页 404。
- 缺 `title`、错误类型、非法 slug、非法日期各触发一次真实构建非零退出，日志含条目与字段。

## 验证

```sh
npm ci
npm run build
npm test
```

`npm test` 内含一次构建与两次可复现构建；两次产物的相对路径清单与逐文件 SHA-256 必须一致。构建产物不得包含构建时间、随机 ID 或机器路径。

## 已知限制

- 页面文件由 Dev2 提供。本 revision 已包含页面，`npm test` 会联合检查 HTML、canonical/OG 与 XML 端点；单独合入本 PR 到不含页面的基线时，这些断言会自动跳过。
- 构建按内容量全量执行，未做增量构建。
- 内容图片尺寸在构建期按真实像素校验；修改图片需同步更新 frontmatter 的 width/height。
- `public/content/` 中未被公开内容引用的文件会在构建结束时从 `dist/` 删除；开发服务器由 `dev-public-contract` 插件按同一份清单拦截，不再直接提供。
- `astro preview` 不执行 dev 契约（不处理 308/`.html`），生产行为以 Nginx 为准。
