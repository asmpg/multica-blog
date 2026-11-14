#!/usr/bin/env node
/**
 * 浏览器断言（METI-9）：减弱动态 / 触摸 hover / 44×44 命中区 / 焦点不裁切 / 无根横滚。
 *
 * 全部断言都读**浏览器实际计算值**与**实际命中测试**结果（getComputedStyle /
 * elementFromPoint / Input 事件），不检查 CSS 文本是否存在。
 *
 * 用法（先构建，脚本自带静态服务器，不依赖预览服务）：
 *
 *   node scripts/check-ui.mjs
 *   node scripts/check-ui.mjs --screenshots docs/verification/ui/fix --json docs/verification/ui/fix/report.json
 *   node scripts/check-ui.mjs --origin http://localhost:41030   # 对运行中的预览环境复测
 *
 * 需要本机 Chrome/Chromium。可用 CHROME_PATH 指定可执行文件。
 * 退出码 0 表示全部通过，1 表示存在失败项。
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const VIEWPORT_HEIGHT = 1000;
const VIEWPORTS = [375, 760, 761, 768, 1440];
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'archive', path: '/archive' },
  { name: 'tag', path: '/tags/design' },
  { name: 'article', path: '/posts/blog-v1-design-contract' },
  { name: 'about', path: '/about' },
];
const MIN_TARGET = 44;
/** 规格 §6 的容器/栅格基准，修复不得顺手改动。 */
const LAYOUT_EXPECTATION = {
  1440: { container: 820, content: 756, columns: 2 },
  768: { container: 768, content: 704, columns: 2 },
  761: { container: 761, content: 697, columns: 2 },
  760: { container: 760, content: 720, columns: 1 },
  375: { container: 375, content: 335, columns: 1 },
};

/* ------------------------------------------------------------------ args */

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};
const SHOT_DIR = argValue('--screenshots') ? resolve(ROOT, argValue('--screenshots')) : null;
const JSON_PATH = argValue('--json') ? resolve(ROOT, argValue('--json')) : null;
const ONLY = argValue('--only');
const EXTERNAL_ORIGIN = argValue('--origin');

/* --------------------------------------------------------- static server */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function startStaticServer() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const candidates = [
      join(DIST, pathname.endsWith('/') ? join(pathname, 'index.html') : pathname),
      join(DIST, `${pathname}.html`),
      join(DIST, pathname, 'index.html'),
    ];
    const found = candidates.find(
      (candidate) => candidate.startsWith(DIST) && existsSync(candidate) && statSync(candidate).isFile(),
    );
    if (!found) {
      const notFound = join(DIST, '404.html');
      res.writeHead(404, { 'content-type': MIME['.html'] });
      res.end(existsSync(notFound) ? readFileSync(notFound) : 'not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(found)] ?? 'application/octet-stream' });
    createReadStream(found).pipe(res);
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

/* ----------------------------------------------------------------- chrome */

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`找不到 Chrome，可用 CHROME_PATH 指定：${CHROME_CANDIDATES.join(', ')}`);
  return found;
}

async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'meti9-chrome-'));
  const child = spawn(
    findChrome(),
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-features=Translate,BackForwardCache',
      '--hide-crash-restore-bubble',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const wsUrl = await new Promise((done, fail) => {
    let log = '';
    child.stderr.on('data', (chunk) => {
      log += chunk.toString();
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) done(match[1]);
    });
    child.on('exit', (code) => fail(new Error(`Chrome 退出（${code}）：\n${log}`)));
    setTimeout(() => fail(new Error(`Chrome 启动超时：\n${log}`)), 20000);
  });
  const cleanup = () => {
    try {
      child.kill('SIGKILL');
    } catch {}
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  };
  return { wsUrl, cleanup };
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { done, fail } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) fail(new Error(`${message.error.message} (${JSON.stringify(message.error.data ?? '')})`));
        else done(message.result);
        return;
      }
      if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params, message.sessionId);
      }
    });
  }

  static async connect(wsUrl) {
    const socket = new WebSocket(wsUrl);
    await new Promise((done, fail) => {
      socket.addEventListener('open', done, { once: true });
      socket.addEventListener('error', fail, { once: true });
    });
    return new Cdp(socket);
  }

  send(method, params = {}, sessionId) {
    return new Promise((done, fail) => {
      const id = ++this.nextId;
      this.pending.set(id, { done, fail });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(method, listener) {
    const list = this.listeners.get(method) ?? [];
    list.push(listener);
    this.listeners.set(method, list);
  }

  close() {
    this.socket.close();
  }
}

/* --------------------------------------------------------------- helpers */

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const PAGE_LIB = String.raw`
window.__ui = {
  isVisible(el) {
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },
  interactive() {
    const nodes = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')];
    return nodes.filter((el) => {
      const tabindex = el.getAttribute('tabindex');
      if (tabindex !== null && Number(tabindex) < 0) return false;
      return this.isVisible(el);
    });
  },
  hits(el, x, y) {
    const top = document.elementFromPoint(x, y);
    return !!top && (top === el || el.contains(top));
  },
  hitRect(el) {
    const fragments = [...el.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    const rect = fragments.reduce((best, r) => (r.width * r.height > best.width * best.height ? r : best), fragments[0] ?? el.getBoundingClientRect());
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (!this.hits(el, cx, cy)) return { hittable: false };
    const scan = (dx, dy) => {
      const step = 0.5;
      let distance = 0;
      while (distance < 200 && this.hits(el, cx + dx * (distance + step), cy + dy * (distance + step))) {
        distance += step;
      }
      return distance;
    };
    const left = scan(-1, 0);
    const right = scan(1, 0);
    const up = scan(0, -1);
    const down = scan(0, 1);
    return {
      hittable: true,
      width: left + right,
      height: up + down,
      box: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      hit: { left: cx - left, right: cx + right, top: cy - up, bottom: cy + down },
    };
  },
  async measureAll() {
    const els = this.interactive();
    els.forEach((el, index) => { el.dataset.uiIndex = String(index); });
    const out = [];
    for (const el of els) {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const rect = this.hitRect(el);
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      // 未聚焦时被移出视口的元素（跳至正文）在焦点检查里单独测量
      const offscreen = !rect.hittable && (box.bottom <= 0 || box.top >= innerHeight);
      const shift = { x: scrollX, y: scrollY };
      const toDoc = (r) =>
        r && { left: r.left + shift.x, right: r.right + shift.x, top: r.top + shift.y, bottom: r.bottom + shift.y };
      out.push({
        index: Number(el.dataset.uiIndex),
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        href: el.getAttribute('href') || '',
        inline: !!el.closest('.article-body') && el.tagName === 'A',
        offscreen,
        hit: toDoc(rect.hit ?? null),
        box: toDoc(rect.box ?? null),
        hittable: rect.hittable,
        hitWidth: rect.width ?? 0,
        hitHeight: rect.height ?? 0,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
      });
    }
    return out;
  },
  activeInfo() {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const pad = 4; // 2px outline + 2px offset
    const outline = { left: rect.left - pad, right: rect.right + pad, top: rect.top - pad, bottom: rect.bottom + pad };
    let clip = { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
    const clippedBy = [];
    for (let node = el.parentElement; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const r = node.getBoundingClientRect();
      clippedBy.push({ tag: node.tagName.toLowerCase(), className: node.className || '' });
      clip = {
        left: Math.max(clip.left, r.left),
        right: Math.min(clip.right, r.right),
        top: Math.max(clip.top, r.top),
        bottom: Math.min(clip.bottom, r.bottom),
      };
    }
    const inside = (value, min, max) => value >= min - 0.01 && value <= max + 0.01;
    return {
      index: el.dataset.uiIndex ? Number(el.dataset.uiIndex) : -1,
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      href: el.getAttribute('href') || '',
      outlineWidth: style.outlineWidth,
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      outlineOffset: style.outlineOffset,
      outlineInsideClip: clippedBy.length === 0
        ? true
        : inside(outline.left, clip.left, clip.right) && inside(outline.right, clip.left, clip.right) &&
          inside(outline.top, clip.top, clip.bottom) && inside(outline.bottom, clip.top, clip.bottom),
      clippedBy,
      outline,
      clip,
      box: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
    };
  },
  transformOf(el) {
    const value = getComputedStyle(el).transform;
    if (value === 'none') return { raw: value, scale: 1, translateX: 0, translateY: 0 };
    const numbers = value.replace(/matrix(3d)?\(|\)/g, '').split(',').map(Number);
    if (numbers.length === 6) {
      return { raw: value, scale: numbers[0], translateX: numbers[4], translateY: numbers[5] };
    }
    return { raw: value, scale: numbers[0], translateX: numbers[12], translateY: numbers[13] };
  },
  stateOf(selector) {
    const el = document.querySelector(selector);
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      transform: style.transform,
      boxShadow: style.boxShadow,
      borderColor: style.borderColor,
      transitionDuration: style.transitionDuration,
      backgroundSize: style.backgroundSize,
      outlineWidth: style.outlineWidth,
    };
  },
  centerOf(selector) {
    const el = document.querySelector(selector);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const rect = el.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  },
  async hitRectOf(el) {
    return this.hitRect(el);
  },
  async measureActive() {
    const el = document.activeElement;
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const rect = this.hitRect(el);
    return { hittable: rect.hittable, width: rect.width ?? 0, height: rect.height ?? 0 };
  },
  scrollMetrics() {
    return {
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth,
    };
  },
  layout() {
    const col = document.querySelector('.col');
    const card = document.querySelector('.acard');
    const list = document.querySelector('.alist');
    const colStyle = getComputedStyle(col);
    const cardStyle = card ? getComputedStyle(card) : null;
    const listStyle = list ? getComputedStyle(list) : null;
    const bodyStyle = getComputedStyle(document.body);
    return {
      containerWidth: col.getBoundingClientRect().width,
      containerPaddingLeft: colStyle.paddingLeft,
      containerPaddingRight: colStyle.paddingRight,
      contentWidth: col.clientWidth - parseFloat(colStyle.paddingLeft) - parseFloat(colStyle.paddingRight),
      cardColumns: listStyle ? listStyle.gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      cardGap: listStyle ? listStyle.columnGap : null,
      cardRadius: cardStyle ? cardStyle.borderRadius : null,
      bodyFontSize: bodyStyle.fontSize,
      bodyLineHeight: bodyStyle.lineHeight,
      articleBodyFontSize: document.querySelector('.article-body')
        ? getComputedStyle(document.querySelector('.article-body')).fontSize
        : null,
    };
  },
};
`;

class Page {
  constructor(cdp, sessionId, origin) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.origin = origin;
  }

  async send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }

  /**
   * Astro dev 服务器会注入开发工具条（astro-dev-toolbar），它是开发工具、不属于站点产物，
   * 但会浮在页面底部挡住页脚链接。对运行中的 dev 预览复测时先隐藏它，
   * 避免把工具条遮挡当成站点缺陷；真实产物（dist / npm run preview）没有该元素。
   */
  async hideDevToolbar() {
    return this.evaluate(`(() => {
      const toolbar = document.querySelector('astro-dev-toolbar');
      if (!toolbar) return false;
      const style = document.createElement('style');
      style.id = 'meti9-hide-dev-toolbar';
      style.textContent = 'astro-dev-toolbar{display:none!important}';
      document.head.appendChild(style);
      return true;
    })()`);
  }

  async navigate(path) {
    const loaded = new Promise((done) => {
      const listener = (params, sessionId) => {
        if (sessionId === this.sessionId) done();
      };
      this.cdp.on('Page.loadEventFired', listener);
    });
    await this.send('Page.navigate', { url: `${this.origin}${path}` });
    await Promise.race([loaded, sleep(10000)]);
    await sleep(120);
    const hadToolbar = await this.hideDevToolbar();
    if (hadToolbar) devToolbarHidden = true;
    await this.evaluate(PAGE_LIB);
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`页面脚本异常：${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description ?? ''}`);
    }
    return result.result.value;
  }

  async setViewport(width) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  async setReducedMotion(reduce) {
    await this.send('Emulation.setEmulatedMedia', {
      features: reduce ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [],
    });
  }

  async setTouch(touch) {
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
    if (!touch) {
      await this.send('Emulation.setEmitTouchEventsForMouse', { enabled: false });
    }
  }

  /** 等过渡结束：最长的 motion 是封面 0.8s，留余量取稳定态。 */
  async settle(ms = 950) {
    await sleep(ms);
  }

  async mouseMove(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    await sleep(60);
  }

  async mouseMoveAway() {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: VIEWPORT_HEIGHT - 1, button: 'none' });
    await sleep(60);
  }

  async tap(x, y) {
    await this.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await sleep(30);
    await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(120);
  }

  async pressTab() {
    const key = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
    await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
    await sleep(60);
  }

  async blur() {
    await this.evaluate('document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); true');
  }

  async screenshot(file) {
    const result = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      fromSurface: true,
    });
    writeFileSync(file, Buffer.from(result.data, 'base64'));
  }
}

/* ---------------------------------------------------------------- checks */

let devToolbarHidden = false;
const results = [];
function record(check, ok, detail) {
  results.push({ check, ok, detail });
}

function overlapArea(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

async function checkHitTargets(page, pageName, width) {
  const items = await page.evaluate('window.__ui.measureAll()');
  const failures = [];
  for (const item of items) {
    const label = `${item.tag}${item.href ? `[${item.href}]` : ''} "${item.text}"`;
    if (item.offscreen) continue; // 未聚焦时移出视口的跳至正文，在 focus 检查里测量
    if (!item.hittable) {
      failures.push(`${label} 中心点不可命中（被其它元素覆盖）`);
      continue;
    }
    if (item.inline) continue; // 正文内联链接：按 WCAG 2.2 2.5.8 inline 例外，见 README
    if (item.hitWidth < MIN_TARGET || item.hitHeight < MIN_TARGET) {
      failures.push(
        `${label} 命中区 ${item.hitWidth.toFixed(1)}×${item.hitHeight.toFixed(1)} < ${MIN_TARGET}×${MIN_TARGET}`,
      );
    }
  }
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (!a.hit || !b.hit) continue;
      const shared = overlapArea(a.hit, b.hit);
      if (shared === 0) continue;
      const coversA = overlapArea(a.hit, b.box) > 0.5;
      const coversB = overlapArea(b.hit, a.box) > 0.5;
      if (coversA || coversB) {
        failures.push(
          `命中区互相覆盖造成误触：${a.text || a.tag} ↔ ${b.text || b.tag}`,
        );
      }
    }
  }
  record(`hit-targets ${pageName}@${width}`, failures.length === 0, {
    viewport: width,
    page: pageName,
    count: items.length,
    measured: items.filter((item) => !item.inline && !item.offscreen).length,
    minWidth: Math.min(
      ...items.filter((item) => !item.inline && !item.offscreen).map((item) => item.hitWidth),
    ).toFixed(1),
    minHeight: Math.min(
      ...items.filter((item) => !item.inline && !item.offscreen).map((item) => item.hitHeight),
    ).toFixed(1),
    failures,
  });
  return items;
}

async function checkFocus(page, pageName, width) {
  await page.blur();
  const failures = [];
  const order = [];
  for (let step = 0; step < 60; step += 1) {
    await page.pressTab();
    const info = await page.evaluate('window.__ui.activeInfo()');
    if (!info) break;
    if (order.some((entry) => entry.index === info.index)) break;
    order.push(info);
  }
  const domOrder = order.map((entry) => entry.index);
  const sorted = [...domOrder].sort((a, b) => a - b);
  if (JSON.stringify(domOrder) !== JSON.stringify(sorted)) {
    failures.push(`Tab 顺序与 DOM 顺序不一致：${domOrder.join(',')}`);
  }
  for (const entry of order) {
    const label = `${entry.tag}${entry.href ? `[${entry.href}]` : ''} "${entry.text}"`;
    if (entry.outlineStyle !== 'solid' || entry.outlineWidth !== '2px' || entry.outlineColor !== 'rgb(26, 26, 26)') {
      failures.push(`${label} 焦点轮廓 ${entry.outlineWidth} ${entry.outlineStyle} ${entry.outlineColor}`);
    }
    if (entry.outlineOffset !== '2px') failures.push(`${label} outline-offset ${entry.outlineOffset}`);
    if (!entry.outlineInsideClip) {
      failures.push(
        `${label} 焦点轮廓被裁切（clipped by ${entry.clippedBy.map((n) => n.tag).join('>') || 'viewport'}）`,
      );
    }
  }
  // 跳至正文未聚焦时被移出视口，只能聚焦后测命中区
  const skipLink = await page.evaluate(`window.__ui.measureActive()`);
  if (!skipLink || !skipLink.hittable || skipLink.width < MIN_TARGET || skipLink.height < MIN_TARGET) {
    failures.push(
      `跳至正文聚焦态命中区 ${skipLink ? `${skipLink.width.toFixed(1)}×${skipLink.height.toFixed(1)}` : '不可测'}`,
    );
  }
  record(`focus ${pageName}@${width}`, failures.length === 0, {
    viewport: width,
    page: pageName,
    order: order.map((entry) => entry.text || entry.tag),
    skipLink,
    failures,
  });
  await page.blur();
}

async function checkLayout(page, pageName, width) {
  const layout = await page.evaluate('window.__ui.layout()');
  const expected = LAYOUT_EXPECTATION[width];
  const failures = [];
  if (Math.abs(layout.containerWidth - expected.container) > 0.5) {
    failures.push(`容器 ${layout.containerWidth} ≠ ${expected.container}`);
  }
  if (Math.abs(layout.contentWidth - expected.content) > 0.5) {
    failures.push(`内容宽 ${layout.contentWidth} ≠ ${expected.content}`);
  }
  if (layout.cardColumns > 0) {
    if (layout.cardColumns !== expected.columns) {
      failures.push(`卡片列数 ${layout.cardColumns} ≠ ${expected.columns}`);
    }
    if (layout.cardGap !== '26px') failures.push(`卡片 gap ${layout.cardGap} ≠ 26px`);
    if (layout.cardRadius !== '18px') failures.push(`卡片圆角 ${layout.cardRadius} ≠ 18px`);
  }
  const gutter = width <= 760 ? '20px' : '32px';
  if (layout.containerPaddingLeft !== gutter || layout.containerPaddingRight !== gutter) {
    failures.push(`容器 padding ${layout.containerPaddingLeft}/${layout.containerPaddingRight} ≠ ${gutter}`);
  }
  if (layout.bodyFontSize !== '16px') failures.push(`基础字号 ${layout.bodyFontSize} ≠ 16px`);
  if (layout.articleBodyFontSize) {
    const articleSize = width <= 760 ? '15px' : '16px';
    if (layout.articleBodyFontSize !== articleSize) {
      failures.push(`正文字号 ${layout.articleBodyFontSize} ≠ ${articleSize}`);
    }
  }
  record(`layout ${pageName}@${width}`, failures.length === 0, { viewport: width, page: pageName, layout, failures });
}

async function checkScroll(page, pageName, width) {
  const metrics = await page.evaluate('window.__ui.scrollMetrics()');
  const ok = metrics.docScrollWidth === metrics.docClientWidth && metrics.bodyScrollWidth <= metrics.docClientWidth;
  record(`no-root-hscroll ${pageName}@${width}`, ok, { viewport: width, page: pageName, metrics });
}

/* 普通 fine pointer：hover 必须保留 -5px / 1.04（不因修复降级） */
async function checkFinePointerHover(page) {
  await page.setReducedMotion(false);
  await page.setTouch(false);
  await page.setViewport(1440);
  await page.navigate('/');
  const target = await page.evaluate(`window.__ui.centerOf('.acard-excerpt')`);
  await page.mouseMoveAway();
  const before = await page.evaluate(`({
    card: window.__ui.stateOf('.acard'),
    cover: window.__ui.stateOf('.acard-cover img'),
    title: window.__ui.stateOf('.acard-title'),
  })`);
  await page.mouseMove(target.x, target.y);
  await page.settle();
  const hovered = await page.evaluate(`({
    card: window.__ui.stateOf('.acard'),
    cover: window.__ui.stateOf('.acard-cover img'),
    title: window.__ui.stateOf('.acard-title'),
    hoverNone: matchMedia('(hover: none)').matches,
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
  })`);
  const cardTransform = await page.evaluate(`window.__ui.transformOf(document.querySelector('.acard'))`);
  const coverTransform = await page.evaluate(`window.__ui.transformOf(document.querySelector('.acard-cover img'))`);
  const failures = [];
  if (Math.abs(cardTransform.translateY - -5) > 0.01) failures.push(`卡片 hover translateY=${cardTransform.raw}（应为 -5px）`);
  if (Math.abs(coverTransform.scale - 1.04) > 0.001) failures.push(`封面 hover scale=${coverTransform.raw}（应为 1.04）`);
  if (hovered.card.boxShadow === 'none') failures.push('卡片 hover 无阴影');
  if (hovered.card.borderColor !== 'rgb(213, 213, 213)') failures.push(`卡片 hover 边框 ${hovered.card.borderColor}`);
  if (hovered.title.backgroundSize !== '100% 42%') failures.push(`标题划亮 ${hovered.title.backgroundSize}`);
  record('state fine-pointer-hover', failures.length === 0, { before, hovered, cardTransform, coverTransform, failures });
  await page.mouseMoveAway();
}

/* 减弱动态：hover 与 focus-within 都不得位移/缩放，时长 10ms */
async function checkReducedMotion(page) {
  await page.setReducedMotion(true);
  await page.setTouch(false);
  await page.setViewport(1440);
  await page.navigate('/');
  const media = await page.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`);
  const failures = [];
  const target = await page.evaluate(`window.__ui.centerOf('.acard-excerpt')`);
  await page.mouseMoveAway();
  await page.mouseMove(target.x, target.y);
  await page.settle(300);
  const hover = await page.evaluate(`({
    card: window.__ui.transformOf(document.querySelector('.acard')),
    cover: window.__ui.transformOf(document.querySelector('.acard-cover img')),
    cardStyle: window.__ui.stateOf('.acard'),
    more: window.__ui.transformOf(document.querySelector('.more-arrow')),
  })`);
  if (!media) failures.push('matchMedia reduce 未生效');
  if (Math.abs(hover.card.translateY) > 0.01) failures.push(`reduce hover 卡片仍有位移 ${hover.card.raw}`);
  if (Math.abs(hover.cover.scale - 1) > 0.001) failures.push(`reduce hover 封面仍缩放 ${hover.cover.raw}`);
  const durations = hover.cardStyle.transitionDuration.split(',').map((value) => value.trim());
  if (!durations.every((value) => value === '0.01s')) {
    failures.push(`reduce 卡片 transition-duration ${hover.cardStyle.transitionDuration}（应全部 10ms）`);
  }
  const moreTarget = await page.evaluate(`window.__ui.centerOf('.more')`);
  await page.mouseMove(moreTarget.x, moreTarget.y);
  await page.settle(300);
  const moreHover = await page.evaluate(`window.__ui.transformOf(document.querySelector('.more-arrow'))`);
  if (Math.abs(moreHover.translateX) > 0.01) failures.push(`reduce 箭头仍移动 ${moreHover.raw}`);
  await page.mouseMoveAway();

  // focus-within：键盘 Tab 到卡片标题
  await page.blur();
  let focusWithin = null;
  for (let step = 0; step < 40; step += 1) {
    await page.pressTab();
    const active = await page.evaluate(
      `(() => { const el = document.activeElement; return el && el.closest('.acard') ? el.textContent.trim().slice(0, 20) : null; })()`,
    );
    if (active) {
      await page.settle(300);
      focusWithin = await page.evaluate(`({
        card: window.__ui.transformOf(document.querySelector('.acard')),
        cover: window.__ui.transformOf(document.querySelector('.acard-cover img')),
        cardStyle: window.__ui.stateOf('.acard'),
        outlineWidth: getComputedStyle(document.activeElement).outlineWidth,
        outlineColor: getComputedStyle(document.activeElement).outlineColor,
      })`);
      break;
    }
  }
  if (!focusWithin) failures.push('键盘未能聚焦卡片内链接');
  else {
    if (Math.abs(focusWithin.card.translateY) > 0.01) failures.push(`reduce focus-within 卡片仍有位移 ${focusWithin.card.raw}`);
    if (Math.abs(focusWithin.cover.scale - 1) > 0.001) failures.push(`reduce focus-within 封面仍缩放 ${focusWithin.cover.raw}`);
    if (focusWithin.outlineWidth !== '2px') failures.push('reduce 下键盘焦点轮廓丢失');
  }
  record('state reduced-motion', failures.length === 0, { media, hover, moreHover, focusWithin, failures });
  await page.blur();
}

/* 触摸设备：hover:none 下 tap 不得留下升起/阴影/放大 */
async function checkTouchHover(page) {
  await page.setReducedMotion(false);
  await page.setViewport(375);
  await page.setTouch(true);
  await page.navigate('/');
  const media = await page.evaluate(`({ hoverNone: matchMedia('(hover: none)').matches, pointerCoarse: matchMedia('(pointer: coarse)').matches })`);
  const failures = [];
  const target = await page.evaluate(`window.__ui.centerOf('.acard-excerpt')`);
  await page.tap(target.x, target.y);
  await page.settle(300);
  const after = await page.evaluate(`({
    card: window.__ui.transformOf(document.querySelector('.acard')),
    cover: window.__ui.transformOf(document.querySelector('.acard-cover img')),
    cardStyle: window.__ui.stateOf('.acard'),
    hoveredElement: (() => { const el = document.querySelector('.acard:hover'); return el ? el.className : null; })(),
  })`);
  if (!media.hoverNone) failures.push('触摸模拟未产生 (hover:none)');
  if (Math.abs(after.card.translateY) > 0.01) failures.push(`tap 后卡片仍升起 ${after.card.raw}`);
  if (Math.abs(after.cover.scale - 1) > 0.001) failures.push(`tap 后封面仍放大 ${after.cover.raw}`);
  if (after.cardStyle.boxShadow !== 'none') failures.push(`tap 后卡片仍有阴影 ${after.cardStyle.boxShadow}`);
  if (after.cardStyle.borderColor !== 'rgb(232, 232, 232)') failures.push(`tap 后边框仍为 hover 值 ${after.cardStyle.borderColor}`);

  // 触摸设备下键盘焦点仍清楚可见
  await page.blur();
  let outline = null;
  for (let step = 0; step < 40; step += 1) {
    await page.pressTab();
    const active = await page.evaluate(
      `(() => { const el = document.activeElement; return el && el.closest('.acard') ? true : false; })()`,
    );
    if (active) {
      outline = await page.evaluate(
        `(() => { const s = getComputedStyle(document.activeElement); return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor, offset: s.outlineOffset }; })()`,
      );
      break;
    }
  }
  if (!outline || outline.width !== '2px' || outline.style !== 'solid' || outline.color !== 'rgb(26, 26, 26)') {
    failures.push(`触摸设备下键盘焦点轮廓不足：${JSON.stringify(outline)}`);
  }
  record('state touch-hover-none', failures.length === 0, { media, after, outline, failures });
  await page.setTouch(false);
}

/* ------------------------------------------------------------------ main */

async function main() {
  // 默认直接服务 dist/（与产物一致、不依赖进程）；--origin 可对运行中的预览环境复测。
  let server = null;
  let origin = EXTERNAL_ORIGIN?.replace(/\/$/, '');
  if (!origin) {
    if (!existsSync(join(DIST, 'index.html'))) {
      throw new Error('未找到 dist/index.html，请先运行 npm run build');
    }
    ({ server, origin } = await startStaticServer());
  } else if (!/^https?:\/\//.test(origin)) {
    throw new Error(`--origin 需要完整 URL，例如 http://localhost:41030`);
  }
  const chrome = await launchChrome();
  const cdp = await Cdp.connect(chrome.wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const page = new Page(cdp, sessionId, origin);

  if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });

  try {
    for (const viewport of VIEWPORTS) {
      await page.setReducedMotion(false);
      await page.setTouch(false);
      await page.setViewport(viewport);
      for (const target of PAGES) {
        if (ONLY && target.name !== ONLY) continue;
        await page.navigate(target.path);
        await checkScroll(page, target.name, viewport);
        await checkLayout(page, target.name, viewport);
        await checkHitTargets(page, target.name, viewport);
        await checkFocus(page, target.name, viewport);
        if (SHOT_DIR) {
          await page.blur();
          await page.evaluate('window.scrollTo(0, 0); true');
          await sleep(80);
          await page.screenshot(join(SHOT_DIR, `${target.name}-${viewport}.png`));
        }
      }
    }

    await checkFinePointerHover(page);
    await checkReducedMotion(page);
    if (SHOT_DIR) {
      await page.setReducedMotion(true);
      await page.setViewport(375);
      await page.navigate('/');
      const reducedTarget = await page.evaluate(`window.__ui.centerOf('.acard-excerpt')`);
      await page.mouseMove(reducedTarget.x, reducedTarget.y);
      await page.screenshot(join(SHOT_DIR, 'state-reduced-motion-375.png'));
      await page.setReducedMotion(false);
    }
    // 键盘焦点证据：375 与 1440 各一张（跳至正文 → 品牌 → 导航）
    if (SHOT_DIR) {
      for (const width of [375, 1440]) {
        await page.setReducedMotion(false);
        await page.setTouch(false);
        await page.setViewport(width);
        await page.navigate('/');
        await page.blur();
        for (let step = 0; step < 3; step += 1) await page.pressTab();
        await page.screenshot(join(SHOT_DIR, `state-focus-${width}.png`));
        await page.blur();
      }
    }
    await checkTouchHover(page);
    if (SHOT_DIR) {
      await page.setViewport(375);
      await page.setTouch(true);
      await page.navigate('/');
      const touchTarget = await page.evaluate(`window.__ui.centerOf('.acard-excerpt')`);
      await page.tap(touchTarget.x, touchTarget.y);
      await page.screenshot(join(SHOT_DIR, 'state-touch-tap-375.png'));
      await page.setTouch(false);
    }
  } finally {
    page.send('Page.close').catch(() => {});
    cdp.close();
    chrome.cleanup();
    server?.close();
  }

  if (devToolbarHidden) {
    console.log(
      'note: 检测到 Astro 开发工具条（astro-dev-toolbar），已隐藏后测量；它是 dev 服务器注入的开发工具，' +
        '不属于站点产物，但会浮在页脚上方遮挡链接。要移除请让根配置设置 devToolbar: { enabled: false }。',
    );
  }

  const failures = results.filter((entry) => !entry.ok);
  for (const entry of results) {
    const detail = entry.detail ?? {};
    const extra = entry.ok
      ? detail.count !== undefined
        ? `（${detail.count} 个交互元素，最小命中区 ${detail.minWidth}×${detail.minHeight}）`
        : ''
      : `\n    - ${(detail.failures ?? []).join('\n    - ')}`;
    console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.check}${extra}`);
  }
  console.log(
    `\n${results.length - failures.length}/${results.length} 项通过${failures.length ? `，${failures.length} 项失败` : ''}`,
  );

  if (JSON_PATH) {
    mkdirSync(dirname(JSON_PATH), { recursive: true });
    writeFileSync(
      JSON_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          viewports: VIEWPORTS,
          pages: PAGES,
          origin: origin,
          devToolbarHidden,
          total: results.length,
          failed: failures.length,
          results,
        },
        null,
        2,
      )}\n`,
    );
  }
  if (failures.length) process.exitCode = 1;
}

await main();
