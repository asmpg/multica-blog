import { describe, expect, it } from 'vitest';
import { createSiteView } from '../../lib/site';
import { addPublishedPosts, makeSite, removeFile } from '../helpers/site';

describe('发布过滤与排序', () => {
  it('只公开 published 文章', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    expect(view.posts.map((post) => post.slug)).toEqual(['post-alpha', 'post-beta', 'post-gamma']);
    expect(view.home.totalPublished).toBe(3);
    cleanup();
  });

  it('同日文章按 slug ASCII 升序', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    expect(view.posts.map((post) => post.slug)).toEqual(['post-alpha', 'post-beta', 'post-gamma']);
    cleanup();
  });

  it('草稿与归档内容不进入公开对象', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    const serialized = JSON.stringify({
      posts: view.posts,
      home: view.home,
      tags: view.tagPages,
      archive: view.archivePages,
      rss: view.rssXml,
      sitemap: view.sitemapXml,
      assets: view.publicAssets,
    });
    expect(serialized).not.toContain('草稿文章');
    expect(serialized).not.toContain('归档文章');
    expect(serialized).not.toContain('draft-delta');
    expect(serialized).not.toContain('archived-epsilon');
    expect(serialized).not.toContain('draft-only.png');
    cleanup();
  });

  it('首页最多 6 篇', async () => {
    const { root, cleanup } = makeSite((root) => addPublishedPosts(root, 10));
    const view = await createSiteView(root);
    expect(view.home.posts).toHaveLength(6);
    expect(view.home.totalPublished).toBe(13);
    cleanup();
  });

  it('没有公开文章的标签不生成页面', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    expect(view.tagPages.map((page) => page.tag.slug)).toEqual(['architecture', 'design']);
    cleanup();
  });

  it('标签页包含全部公开文章', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    const architecture = view.tagPages.find((page) => page.tag.slug === 'architecture')!;
    expect(architecture.posts.map((post) => post.slug)).toEqual(['post-alpha', 'post-gamma']);
    expect(architecture.totalItems).toBe(2);
    cleanup();
  });
});

describe('分页边界', () => {
  async function pageCounts(extra: number) {
    const { root, cleanup } = makeSite((root) => addPublishedPosts(root, extra));
    const view = await createSiteView(root);
    cleanup();
    return view;
  }

  it('3 篇公开文章只有一页', async () => {
    const view = await pageCounts(0);
    expect(view.archivePages).toHaveLength(1);
    expect(view.archivePages[0]!.posts).toHaveLength(3);
    expect(view.archivePages[0]!.nextPath).toBeUndefined();
    expect(view.archivePages[0]!.previousPath).toBeUndefined();
  });

  it('6 篇公开文章只有一页', async () => {
    const view = await pageCounts(3);
    expect(view.archivePages).toHaveLength(1);
    expect(view.archivePages[0]!.totalItems).toBe(6);
  });

  it('7 篇公开文章分成 6 + 1', async () => {
    const view = await pageCounts(4);
    expect(view.archivePages).toHaveLength(2);
    expect(view.archivePages[0]!.posts).toHaveLength(6);
    expect(view.archivePages[1]!.posts).toHaveLength(1);
    expect(view.archivePages[1]!.path).toBe('/archive/page/2');
    expect(view.archivePages[1]!.previousPath).toBe('/archive');
    expect(view.archivePages[1]!.nextPath).toBeUndefined();
  });

  it('12 篇公开文章正好两页', async () => {
    const view = await pageCounts(9);
    expect(view.archivePages).toHaveLength(2);
    expect(view.archivePages[1]!.posts).toHaveLength(6);
  });

  it('13 篇公开文章分成 6 + 6 + 1', async () => {
    const view = await pageCounts(10);
    expect(view.archivePages).toHaveLength(3);
    expect(view.archivePages.map((page) => page.posts.length)).toEqual([6, 6, 1]);
    expect(view.archivePages[1]!.nextPath).toBe('/archive/page/3');
  });

  it('分页不重复也不遗漏', async () => {
    const view = await pageCounts(10);
    const slugs = view.archivePages.flatMap((page) => page.posts.map((post) => post.slug));
    expect(new Set(slugs).size).toBe(13);
    expect(slugs).toEqual(view.posts.map((post) => post.slug));
  });

  it('空集合仍有一页空归档', async () => {
    const { root, cleanup } = makeSite((root) => {
      removeFile(root, 'content/posts/post-alpha.md');
      removeFile(root, 'content/posts/post-beta.md');
      removeFile(root, 'content/posts/post-gamma.md');
    });
    const view = await createSiteView(root);
    expect(view.home.posts).toEqual([]);
    expect(view.home.totalPublished).toBe(0);
    expect(view.archivePages).toHaveLength(1);
    expect(view.archivePages[0]!.posts).toEqual([]);
    expect(view.archivePages[0]!.nextPath).toBeUndefined();
    cleanup();
  });
});
