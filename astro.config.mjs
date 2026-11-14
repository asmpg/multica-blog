import { rmSync, readdirSync, rmdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { createSiteView } from './lib/site.ts';
import { normalizeSiteUrl } from './lib/url.ts';

// Astro copies public/ verbatim; remove content assets that no public page may reference.
function pruneContentAssets() {
  return {
    name: 'prune-content-assets',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const view = await createSiteView(process.cwd(), process.env.SITE_URL);
        const contentDir = fileURLToPath(new URL('./content/', dir));
        let removed = 0;
        const walk = (directory, relative) => {
          let entries;
          try {
            entries = readdirSync(directory);
          } catch {
            return;
          }
          for (const entry of entries) {
            const diskPath = join(directory, entry);
            const assetPath = `${relative}/${entry}`;
            if (statSync(diskPath).isDirectory()) {
              walk(diskPath, assetPath);
              try {
                rmdirSync(diskPath);
              } catch {
                // Directory still holds referenced assets.
              }
            } else if (!view.publicAssets.includes(assetPath)) {
              rmSync(diskPath);
              removed += 1;
            }
          }
        };
        walk(contentDir, '/content');
        logger.info(`pruned ${removed} unreferenced content asset(s)`);
      },
    },
  };
}

function notFound(response) {
  response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><meta charset="utf-8"><title>页面不存在</title><h1>页面不存在</h1><p>请求的页面不存在。</p>');
}

// 生产由 Nginx 执行 content-model §5 的公开契约（见 docs/development.md）。
// 开发服务器默认把 public/ 原样公开，并把 `.html` 当成可访问路由；这里在请求进入 Astro 路由前执行同一份契约，
// 使本地预览与部署行为一致。预览（astro preview）只读已裁剪的 dist/，不需要这段。
function devPublicContract(root) {
  let viewPromise;
  const load = () => {
    viewPromise ??= createSiteView(root, process.env.SITE_URL).then(
      (view) => ({
        routes: new Set(view.routes.map((route) => route.path)),
        assets: new Set(view.publicAssets),
      }),
      () => undefined, // 内容校验失败时让 Astro 自己报错
    );
    return viewPromise;
  };

  return {
    name: 'dev-public-contract',
    configureServer(server) {
      server.watcher.on('all', () => {
        viewPromise = undefined;
      });
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();
        const [rawPath = '/', search] = (request.url ?? '/').split('?');
        // 下游静态服务按解码后的路径找文件，这里必须同样解释：`/%63ontent/...` 曾绕过资源过滤。
        let pathname;
        try {
          pathname = posix.normalize(decodeURIComponent(rawPath));
        } catch {
          return notFound(response); // 异常编码不进入路由
        }
        const view = await load();
        if (!view) return next();

        // `.html` 不是外部成功 URL。
        if (pathname.endsWith('.html')) return notFound(response);

        // 已存在公开路径的尾斜杠变体 308 到规范路径；未知路径仍 404。
        if (pathname !== '/' && pathname.endsWith('/')) {
          const canonical = pathname.replace(/\/+$/, '');
          if (view.routes.has(canonical)) {
            response.writeHead(308, { Location: search ? `${canonical}?${search}` : canonical });
            response.end();
            return;
          }
          return notFound(response);
        }

        // 内容资源只公开被 published/关于页/站点默认图引用的文件。
        if (pathname.startsWith('/content/') && !view.assets.has(pathname)) return notFound(response);

        next();
      });
    },
  };
}

// `astro dev` 的尾斜杠中间件在路由前直接 404，早于任何插件中间件，所以 dev 先放开（ignore），
// 再由 devPublicContract 统一发 308；构建产物固定 never（ADR 0001 §4.4）。
const isDev = process.argv[2] === 'dev';

export default defineConfig({
  site: normalizeSiteUrl(process.env.SITE_URL),
  output: 'static',
  trailingSlash: isDev ? 'ignore' : 'never',
  build: { format: 'file' },
  integrations: [pruneContentAssets()],
  vite: { plugins: [devPublicContract(process.cwd())] },
});
