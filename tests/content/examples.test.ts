import { describe, expect, it } from 'vitest';
import { createSiteView } from '../../lib/site';

const view = await createSiteView(process.cwd());

describe('仓库示例内容', () => {
  it('通过校验并产出公开集合', () => {
    expect(view.posts.map((post) => post.slug)).toEqual([
      'blog-v1-design-contract',
      'static-site-build-pipeline',
      'markdown-safety-and-links',
      'reproducible-builds-without-clock',
    ]);
    expect(view.home.posts).toHaveLength(4);
    expect(view.postBySlug.has('draft-editorial-workflow')).toBe(false);
    expect(view.tagPages.map((page) => page.tag.slug).sort()).toEqual(['architecture', 'build', 'design']);
  });

  it('公开资源不包含仅草稿使用的图片', () => {
    expect(view.publicAssets).toContain('/content/site/og.png');
    expect(view.publicAssets).not.toContain('/content/draft-editorial-workflow/cover.png');
  });

  it('示例文章覆盖 H2–H6 且渲染出显式标题 id', () => {
    const post = view.postBySlug.get('blog-v1-design-contract')!;
    for (const id of ['contracts-first', 'fields', 'verify-contracts', 'ordered-steps', 'details', 'notes']) {
      expect(post.body).toContain(`id="${id}"`);
    }
    expect(post.body).not.toContain('{#');
  });

  it('XML 产物包含公开路由且不含草稿', () => {
    expect(view.sitemapXml).toContain('http://localhost:4321/posts/blog-v1-design-contract');
    expect(view.sitemapXml).not.toContain('draft-editorial-workflow');
    expect(view.rssXml).not.toContain('编辑流程草稿');
    expect(view.rssXml).toContain('Sat, 14 Nov 2026 00:00:00 GMT');
  });
});
