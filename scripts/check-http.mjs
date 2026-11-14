import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';

import { join } from 'node:path';

/**
 * 在真实 `astro dev` 上核对 content-model §5 的公开契约（非 watch）：
 * 公开路由 200、尾斜杠 308 且 Location 精确、`.html` 404、私有内容资源 404、XML 200 + XML Content-Type。
 * 公开路由取自 sitemap，不硬编码内容。
 *
 * 用法：node scripts/check-http.mjs
 */

const root = process.cwd();
const astroBin = join(root, 'node_modules/astro/bin/astro.mjs');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const dev = spawn(
  process.execPath,
  [astroBin, 'dev', '--port', String(port), '--host', '127.0.0.1', '--ignore-lock'],
  { cwd: root, env: { ...process.env, SITE_URL: origin }, stdio: ['ignore', 'pipe', 'pipe'] },
);

let log = '';
dev.stdout.on('data', (chunk) => (log += chunk));
dev.stderr.on('data', (chunk) => (log += chunk));

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (dev.exitCode !== null) throw new Error(`开发服务器提前退出：\n${log}`);
    try {
      const response = await fetch(`${origin}/`);
      if (response.ok) return;
    } catch {
      // 尚未监听。
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`开发服务器 60s 内未就绪：\n${log}`);
}

const failures = [];
function check(name, condition, detail) {
  if (condition) return;
  failures.push(detail ? `${name}：${detail}` : name);
}

async function probe(path) {
  const response = await fetch(`${origin}${path}`, { redirect: 'manual' });
  const body = response.status === 200 ? await response.text() : '';
  return { status: response.status, location: response.headers.get('location'), type: response.headers.get('content-type') ?? '', body };
}

try {
  await waitForServer();

  const sitemap = await probe('/sitemap.xml');
  check('/sitemap.xml 200', sitemap.status === 200, String(sitemap.status));
  check('/sitemap.xml XML Content-Type', /xml/.test(sitemap.type), sitemap.type);

  const rss = await probe('/rss.xml');
  check('/rss.xml 200', rss.status === 200, String(rss.status));
  check('/rss.xml XML Content-Type', /xml/.test(rss.type), rss.type);

  const routes = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  check('sitemap 含公开路由', routes.length >= 5, `只有 ${routes.length} 条`);

  const htmlByPath = new Map();
  for (const path of routes) {
    const page = await probe(path);
    htmlByPath.set(path, page.body);
    check(`${path} 200`, page.status === 200, String(page.status));
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(page.body)?.[1];
    check(`${path} 唯一 canonical 指向自身`, canonical !== undefined && new URL(canonical).pathname === path, canonical ?? '缺少 canonical');
    if (path === '/') continue;
    const slash = await probe(`${path}/`);
    check(`${path}/ 308`, slash.status === 308, String(slash.status));
    check(`${path}/ Location 精确`, slash.location === path, String(slash.location));
    const html = await probe(`${path}.html`);
    check(`${path}.html 404`, html.status === 404, String(html.status));
  }

  for (const path of ['/nope', '/nope/', '/archive/page/0', '/archive/page/1', '/archive/page/02']) {
    const page = await probe(path);
    check(`${path} 404`, page.status === 404, String(page.status));
  }

  // 草稿与归档文章：真实内容里出现的私有 slug 必须不可访问。
  for (const name of readdirSync(join(root, 'content/posts'))) {
    const source = readFileSync(join(root, 'content/posts', name), 'utf8');
    if (!/^status: (draft|archived)$/m.test(source)) continue;
    const slug = /^slug: (.+)$/m.exec(source)?.[1]?.trim();
    check(`${name} 有 slug`, Boolean(slug), name);
    if (!slug) continue;
    const page = await probe(`/posts/${slug}`);
    check(`私有文章 /posts/${slug} 404`, page.status === 404, String(page.status));
  }

  // 内容资源：草稿独有图片不可访问；页面实际引用的公开图片仍可访问。
  const draftAsset = '/content/draft-editorial-workflow/cover.png';
  check('草稿独有图片存在于 public/', existsSync(join(root, 'public', draftAsset)), draftAsset);
  const privateResponse = await probe(draftAsset);
  check(`草稿独有图片 ${draftAsset} 404`, privateResponse.status === 404, String(privateResponse.status));

  const referenced = new Set([...htmlByPath.values()].flatMap((html) => [...html.matchAll(/\/content\/[^"'\s)]+/g)].map((match) => match[0])));
  check('页面引用了公开内容图片', referenced.size > 0, '未找到 /content/ 引用');
  for (const assetPath of referenced) {
    const response = await probe(assetPath);
    check(`公开图片 ${assetPath} 200`, response.status === 200, String(response.status));
  }

  if (failures.length > 0) {
    console.error(`公开契约检查失败（${failures.length} 项）：`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`公开契约检查通过：${routes.length} 条公开路由、尾斜杠 308、.html 404、资源过滤、XML Content-Type。`);
  }
} finally {
  if (dev.exitCode === null) {
    dev.kill('SIGTERM');
    await new Promise((resolve) => dev.once('exit', resolve));
  }
}
