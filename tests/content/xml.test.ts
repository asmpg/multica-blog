import { describe, expect, it } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { createSiteView } from '../../lib/site';
import { makeSite, removeFile, writeFile } from '../helpers/site';

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === 'item' || name === 'url',
});

function escapingPost(): string {
  return `---
slug: escaping
title: "A & B < C > D"
excerpt: "摘要里有 & < > 符号。"
status: published
publishedAt: "2026-11-05"
authorId: blog-team
tagSlugs: []
---

正文。

## 小节 {#section}
`;
}

describe('sitemap', () => {
  it('列出全部公开成功页面且按路径升序', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    const parsed = parser.parse(view.sitemapXml);
    const urls = parsed.urlset.url as Array<{ loc: string; lastmod?: string }>;
    const locs = urls.map((entry) => entry.loc);
    expect(locs).toEqual([...locs].sort());
    expect(locs).toEqual([
      'http://localhost:4321/',
      'http://localhost:4321/about',
      'http://localhost:4321/archive',
      'http://localhost:4321/posts/post-alpha',
      'http://localhost:4321/posts/post-beta',
      'http://localhost:4321/posts/post-gamma',
      'http://localhost:4321/tags/architecture',
      'http://localhost:4321/tags/design',
    ]);
    cleanup();
  });

  it('lastmod 只来自文章显式日期', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    const parsed = parser.parse(view.sitemapXml);
    const urls = parsed.urlset.url as Array<{ loc: string; lastmod?: string }>;
    const lastmods = urls.filter((entry) => entry.lastmod !== undefined).map((entry) => entry.loc);
    expect(lastmods).toEqual([
      'http://localhost:4321/posts/post-alpha',
      'http://localhost:4321/posts/post-beta',
      'http://localhost:4321/posts/post-gamma',
    ]);
    cleanup();
  });

  it('不含草稿、归档与 XML 自身', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    expect(view.sitemapXml).not.toContain('draft-delta');
    expect(view.sitemapXml).not.toContain('archived-epsilon');
    expect(view.sitemapXml).not.toContain('rss.xml');
    expect(view.sitemapXml).not.toContain('sitemap.xml');
    cleanup();
  });
});

describe('RSS', () => {
  it('包含全部 published 且顺序与公开集合一致', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    const parsed = parser.parse(view.rssXml);
    const channel = parsed.rss.channel;
    expect(channel.title).toBe('测试博客');
    expect(channel.link).toBe('http://localhost:4321');
    expect(channel.language).toBe('zh-CN');
    const items = channel.item as Array<Record<string, string>>;
    expect(items.map((item) => item.title)).toEqual(['阿尔法文章', '贝塔文章', '伽马文章']);
    expect(items.map((item) => item.link)).toEqual([
      'http://localhost:4321/posts/post-alpha',
      'http://localhost:4321/posts/post-beta',
      'http://localhost:4321/posts/post-gamma',
    ]);
    expect((items[0]!.guid as unknown as { '#text': string })['#text']).toBe(
      'http://localhost:4321/posts/post-alpha',
    );
    cleanup();
  });

  it('pubDate 为发布日期当天 00:00:00 GMT', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    const parsed = parser.parse(view.rssXml);
    const items = parsed.rss.channel.item as Array<Record<string, string>>;
    expect(items[0]!.pubDate).toBe('Tue, 10 Nov 2026 00:00:00 GMT');
    cleanup();
  });

  it('lastBuildDate 取公开文章的最大更新日期', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    const parsed = parser.parse(view.rssXml);
    expect(parsed.rss.channel.lastBuildDate).toBe('Tue, 10 Nov 2026 00:00:00 GMT');
    cleanup();
  });

  it('空集合省略 lastBuildDate', async () => {
    const { root, cleanup } = makeSite((root) => {
      removeFile(root, 'content/posts/post-alpha.md');
      removeFile(root, 'content/posts/post-beta.md');
      removeFile(root, 'content/posts/post-gamma.md');
    });
    const view = await createSiteView(root);
    const parsed = parser.parse(view.rssXml);
    expect(parsed.rss.channel.lastBuildDate).toBeUndefined();
    expect(parsed.rss.channel.item).toBeUndefined();
    cleanup();
  });

  it('XML 正确转义并保留原文', async () => {
    const { root, cleanup } = makeSite((root) => writeFile(root, 'content/posts/escaping.md', escapingPost()));
    const view = await createSiteView(root);
    expect(view.rssXml).toContain('A &amp; B &lt; C &gt; D');
    const parsed = parser.parse(view.rssXml);
    const items = parsed.rss.channel.item as Array<Record<string, string>>;
    const item = items.find((entry) => entry.title === 'A & B < C > D')!;
    expect(item.description).toBe('摘要里有 & < > 符号。');
    cleanup();
  });

  it('作者以名称输出而不是邮箱', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    expect(view.rssXml).toContain('<dc:creator>测试作者</dc:creator>');
    expect(view.rssXml).not.toContain('@');
    cleanup();
  });

  it('连续生成结果一致', async () => {
    const { root, cleanup } = makeSite();
    const first = await createSiteView(root);
    const second = await createSiteView(root);
    expect(second.rssXml).toBe(first.rssXml);
    expect(second.sitemapXml).toBe(first.sitemapXml);
    cleanup();
  });
});
