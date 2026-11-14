import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

/**
 * 隔离的端到端验收：不读写正式 content/，全部在临时目录构建。
 *
 * 1. 7 篇 published（含同日两篇）+ 1 draft + 1 archived + 仅私有文章标签：
 *    真实构建后按 Nginx 契约提供 HTTP，核对 6+1 分页、顺序、不重不漏、第二页 canonical、越界 404、私有内容不可达；
 *    再对同一份 fixture 起真实 dev 服务，核对草稿/归档独有图的普通与编码路径都 404、共享图片仍 200。
 * 2. 空集合（0 published）：首页/归档 200 且显示“暂无文章”，空标签与第 2 页 404。
 * 3. 缺 title / 错误类型 / 非法 slug / 非法日期：真实构建非零退出，日志含条目与字段。
 *
 * 用法：node scripts/verify-acceptance.mjs
 */

const root = process.cwd();
const astroBin = join(root, 'node_modules/astro/bin/astro.mjs');
const fixture = join(root, 'tests/fixtures/acceptance');
const origin = 'http://127.0.0.1:4321';
const expectedOrder = ['post-01', 'post-02', 'post-03', 'post-04', 'post-05', 'post-06', 'post-07'];

const failures = [];
function check(name, condition, detail) {
  if (condition) return;
  failures.push(detail === undefined ? name : `${name}：${detail}`);
}

const temps = [];
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

// `/%63ontent/...`：下游静态服务解码后仍指向同一文件，权限检查必须给出同一结论。
const encoded = (path) => path.replace('/content/', '/%63ontent/');

function freePort() {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function prepareSite(mutate) {
  const site = tempDir('blog-acceptance-');
  for (const entry of ['src', 'lib', 'styles']) cpSync(join(root, entry), join(site, entry), { recursive: true });
  for (const entry of ['astro.config.mjs', 'package.json', 'tsconfig.json']) cpSync(join(root, entry), join(site, entry));
  cpSync(join(fixture, 'content'), join(site, 'content'), { recursive: true });
  cpSync(join(fixture, 'public'), join(site, 'public'), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(site, 'node_modules'), 'dir');
  mutate?.(site);
  return site;
}

function build(site) {
  try {
    const output = execFileSync(process.execPath, [astroBin, 'build'], {
      cwd: site,
      env: { ...process.env, SITE_URL: origin },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { ok: true, output };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};

// 与 ADR 0001 §7.2 的静态主机契约一致：extensionless → <path>.html；尾斜杠与 .html 不是成功 URL。
// 路径按百分号解码后解释（Nginx 同样先解码），异常编码直接 404。
async function serve(dist) {
  const server = createServer((request, response) => {
    const notFound = () => {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('404');
    };
    let pathname;
    try {
      pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
    } catch {
      return notFound();
    }
    if (pathname !== '/' && (pathname.endsWith('/') || pathname.endsWith('.html'))) return notFound();
    const candidates = pathname === '/' ? ['index.html'] : [pathname.slice(1), `${pathname.slice(1)}.html`];
    const file = candidates.map((candidate) => join(dist, candidate)).find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    if (!file) return notFound();
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    response.end(readFileSync(file));
  });
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

function postLinks(html) {
  const links = [...html.matchAll(/href="\/posts\/([a-z0-9-]+)"/g)].map((match) => match[1]);
  return [...new Set(links)];
}

function canonicalOf(html) {
  return /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
}

try {
  // 1. 分页与公开性
  const site = prepareSite();
  const built = build(site);
  if (!built.ok) throw new Error(`验收 fixture 构建失败：\n${built.output}`);
  const server = await serve(join(site, 'dist'));
  const get = async (path) => {
    const response = await fetch(`${server.base}${path}`, { redirect: 'manual' });
    return { status: response.status, body: response.status === 200 ? await response.text() : '', type: response.headers.get('content-type') ?? '' };
  };

  const page1 = await get('/archive');
  const page2 = await get('/archive/page/2');
  check('/archive 200', page1.status === 200, String(page1.status));
  check('/archive/page/2 200', page2.status === 200, String(page2.status));
  check('第一页 6 篇', postLinks(page1.body).length === 6, JSON.stringify(postLinks(page1.body)));
  check('第二页 1 篇', postLinks(page2.body).length === 1, JSON.stringify(postLinks(page2.body)));
  check('第一页顺序', JSON.stringify(postLinks(page1.body)) === JSON.stringify(expectedOrder.slice(0, 6)), JSON.stringify(postLinks(page1.body)));
  check('第二页顺序', JSON.stringify(postLinks(page2.body)) === JSON.stringify(expectedOrder.slice(6)), JSON.stringify(postLinks(page2.body)));
  const combined = [...postLinks(page1.body), ...postLinks(page2.body)];
  check('两页不重不漏', JSON.stringify(combined) === JSON.stringify(expectedOrder), JSON.stringify(combined));
  check('第二页 canonical 自指', canonicalOf(page2.body) === `${origin}/archive/page/2`, canonicalOf(page2.body));
  check('第一页 canonical 自指', canonicalOf(page1.body) === `${origin}/archive`, canonicalOf(page1.body));
  for (const path of ['/archive/page/0', '/archive/page/1', '/archive/page/02', '/archive/page/3']) {
    const page = await get(path);
    check(`${path} 404`, page.status === 404, String(page.status));
  }

  const home = await get('/');
  check('首页 6 篇且顺序一致', JSON.stringify(postLinks(home.body)) === JSON.stringify(expectedOrder.slice(0, 6)), JSON.stringify(postLinks(home.body)));

  for (const path of ['/posts/draft-private', '/posts/archived-gamma', '/tags/private-only', '/tags/empty-tag']) {
    const page = await get(path);
    check(`${path} 404`, page.status === 404, String(page.status));
  }
  const architectureTag = await get('/tags/architecture');
  check('/tags/architecture 200', architectureTag.status === 200, String(architectureTag.status));

  // 私有资源：普通路径与百分号编码变体都不可访问，共享图片两种写法都可用。
  for (const path of ['/content/draft-only.png', encoded('/content/draft-only.png'), '/content/archived-only.png', encoded('/content/archived-only.png'), '/%63ontent/%E0%A4%A']) {
    const page = await get(path);
    check(`${path} 404`, page.status === 404, String(page.status));
  }
  for (const path of ['/content/shared.png', encoded('/content/shared.png')]) {
    const page = await get(path);
    check(`${path} 200`, page.status === 200, String(page.status));
  }

  const rss = await get('/rss.xml');
  check('RSS 7 篇', (rss.body.match(/<item>/g) ?? []).length === 7, String((rss.body.match(/<item>/g) ?? []).length));
  check('RSS 不含草稿/归档', !rss.body.includes('draft-private') && !rss.body.includes('archived-gamma'));
  check('RSS XML Content-Type', /xml/.test(rss.type), rss.type);

  const sitemap = await get('/sitemap.xml');
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  check('sitemap 13 条公开路由', locs.length === 13, String(locs.length));
  check('sitemap 不含私有路径', !locs.some((path) => /draft-private|archived-gamma|private-only|empty-tag/.test(path)), JSON.stringify(locs));
  await server.close();

  // 同一份 fixture 上的真实 dev 服务：静态产物靠构建裁剪，dev 靠 dev-public-contract 插件，
  // 编码路径不能绕过它。
  const devPort = await freePort();
  const devOrigin = `http://127.0.0.1:${devPort}`;
  const dev = spawn(process.execPath, [astroBin, 'dev', '--port', String(devPort), '--host', '127.0.0.1', '--ignore-lock'], {
    cwd: site,
    env: { ...process.env, SITE_URL: devOrigin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let devLog = '';
  dev.stdout.on('data', (chunk) => (devLog += chunk));
  dev.stderr.on('data', (chunk) => (devLog += chunk));
  try {
    const deadline = Date.now() + 60_000;
    let ready = false;
    while (!ready && Date.now() < deadline) {
      if (dev.exitCode !== null) throw new Error(`fixture dev 提前退出：\n${devLog}`);
      try {
        ready = (await fetch(`${devOrigin}/`)).ok;
      } catch {
        // 尚未监听。
      }
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error(`fixture dev 60s 内未就绪：\n${devLog}`);
    for (const path of ['/content/draft-only.png', encoded('/content/draft-only.png'), '/content/archived-only.png', encoded('/content/archived-only.png')]) {
      const status = (await fetch(`${devOrigin}${path}`, { redirect: 'manual' })).status;
      check(`dev ${path} 404`, status === 404, String(status));
    }
    for (const path of ['/content/shared.png', encoded('/content/shared.png')]) {
      const status = (await fetch(`${devOrigin}${path}`, { redirect: 'manual' })).status;
      check(`dev ${path} 200`, status === 200, String(status));
    }
  } finally {
    if (dev.exitCode === null) {
      dev.kill('SIGTERM');
      await new Promise((resolve) => dev.once('exit', resolve));
    }
  }

  // 2. 空集合
  const emptySite = prepareSite((dir) => {
    for (const name of ['post-01', 'post-02', 'post-03', 'post-04', 'post-05', 'post-06', 'post-07']) {
      const file = join(dir, 'content/posts', `${name}.md`);
      writeFileSync(file, readFileSync(file, 'utf8').replace('status: published', 'status: draft'));
    }
  });
  const emptyBuilt = build(emptySite);
  if (!emptyBuilt.ok) throw new Error(`空集合 fixture 构建失败：\n${emptyBuilt.output}`);
  const emptyServer = await serve(join(emptySite, 'dist'));
  const emptyGet = async (path) => {
    const response = await fetch(`${emptyServer.base}${path}`, { redirect: 'manual' });
    return { status: response.status, body: response.status === 200 ? await response.text() : '' };
  };
  for (const path of ['/', '/archive']) {
    const page = await emptyGet(path);
    check(`空集合 ${path} 200`, page.status === 200, String(page.status));
    check(`空集合 ${path} 显示暂无文章`, page.body.includes('暂无文章'), '未找到“暂无文章”');
  }
  for (const path of ['/archive/page/2', '/tags/architecture', '/tags/empty-tag']) {
    const page = await emptyGet(path);
    check(`空集合 ${path} 404`, page.status === 404, String(page.status));
  }
  await emptyServer.close();

  // 3. 构建期校验必须真实失败。缺字段/类型错误由内容集合 schema 先拦下（带文件 Location），
  //    slug/日期由 lib 的 content-model 校验拦下；两者都必须给出条目与字段。
  const cases = [
    { name: '缺 title', edit: (text) => text.replace(/^title: .*\n/m, ''), expect: ['post-03', 'title', 'Required'] },
    { name: '错误类型', edit: (text) => text.replace(/^title: .*\n/m, 'title: 123\n'), expect: ['post-03', 'title', 'Expected type'] },
    { name: '非法 slug', edit: (text) => text.replace('slug: post-03', 'slug: Post_03'), expect: ['content/posts/post-03.md', 'slug', '小写 slug'] },
    { name: '非法日期', edit: (text) => text.replace('publishedAt: "2026-11-08"', 'publishedAt: "2026-02-29"'), expect: ['content/posts/post-03.md', 'publishedAt', '不是真实存在'] },
  ];
  for (const testCase of cases) {
    const broken = prepareSite((dir) => {
      const file = join(dir, 'content/posts/post-03.md');
      writeFileSync(file, testCase.edit(readFileSync(file, 'utf8')));
    });
    const result = build(broken);
    check(`${testCase.name}：构建非零退出`, !result.ok, '构建意外成功');
    for (const fragment of testCase.expect) {
      check(`${testCase.name}：日志含 ${fragment}`, result.output.includes(fragment), result.output.split('\n').slice(0, 8).join(' / '));
    }
  }

  if (failures.length > 0) {
    console.error(`验收检查失败（${failures.length} 项）：`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('验收检查通过：6+1 分页与顺序、第二页 canonical、越界 404、私有内容与编码路径不可达、共享图片可用、空集合 200/404、4 类构建期校验非零退出。');
  }
} finally {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
}
