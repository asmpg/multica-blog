# 博客网站 v1

复刻 oiloil.org 视觉风格的静态博客（Astro + 构建期内容校验）。

- 技术选型：`docs/adr/0001-tech-stack.md`
- 内容模型与视觉规范：`docs/content-model.md`、`docs/design-spec.md`
- 内容管线、构建命令、部署契约：`docs/development.md`

## 快速开始

```sh
nvm use        # 读取 .nvmrc，Node 24.22.3（用 fnm 则 fnm use）
npm ci
npm run build
```

`npm run build` 依次执行 `astro sync`、`astro check`、`astro build`，产物在 `dist/`。内容校验失败会在构建前直接非零退出。

跑完整检查（构建 + 单元测试 + 两次构建的 SHA-256 可复现校验）：

```sh
npm test
```

## 本地预览

```sh
npm run dev        # 开发服务器，http://localhost:4321，按部署契约处理 308/404
npm run preview    # 预览已构建的 dist/，http://localhost:4321
```

`npm run dev` 会带上与 Nginx 一致的公开资源与 URL 契约（`.html` 地址、未知路径、草稿图片都返回 404），所以本地看到的行为就是部署后的行为。

在 Multica 工作区里也可以直接用受管预览环境（自动 `npm ci` 并起 dev 服务器）：

```sh
multica env start web   # 起预览，日志与端口由平台托管
multica env stop web    # 用完停掉
```

## 发文

文章是 `content/posts/*.md`，frontmatter 字段、`status`（`draft` / `published` / `archived`）与图片要求见 `docs/content-model.md` §2–§4；新建一篇时直接复制 `content/posts/blog-v1-design-contract.md` 改字段最省事。
