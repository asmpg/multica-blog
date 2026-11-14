import { describe, expect, it } from 'vitest';
import { createSiteView } from '../../lib/site';
import { makeSite } from '../helpers/site';

describe('SEO 派生', () => {
  it('首页元数据', async () => {
    const { root, cleanup } = makeSite();
    const { home } = await createSiteView(root);
    expect(home.seo.title).toBe('首页 · 测试博客');
    expect(home.seo.description).toBe('用于测试的站点。');
    expect(home.seo.canonical).toBe('http://localhost:4321/');
    expect(home.seo.ogImage).toBe('http://localhost:4321/content/pixel.png');
    expect(home.seo.ogType).toBe('website');
    expect(home.seo.language).toBe('zh-CN');
    cleanup();
  });

  it('文章标题、描述与 OG 图回退链', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);

    const alpha = view.postBySlug.get('post-alpha')!;
    expect(alpha.seo.title).toBe('阿尔法文章 · 测试博客');
    expect(alpha.seo.description).toBe('第一篇文章的摘要。');
    expect(alpha.seo.ogImage).toBe('http://localhost:4321/content/pixel.png');
    expect(alpha.seo.ogType).toBe('article');

    const beta = view.postBySlug.get('post-beta')!;
    expect(beta.seo.ogImage).toBe('http://localhost:4321/content/other.png');

    const gamma = view.postBySlug.get('post-gamma')!;
    expect(gamma.seo.title).toBe('伽马 SEO 标题 · 测试博客');
    expect(gamma.seo.description).toBe('伽马 SEO 描述。');
    expect(gamma.seo.ogImage).toBe('http://localhost:4321/content/og.png');
    expect(gamma.seo.ogImageWidth).toBe(8);
    expect(gamma.seo.ogImageHeight).toBe(8);
    cleanup();
  });

  it('归档页标题与描述', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    expect(view.archivePages[0]!.seo.title).toBe('文章归档 · 测试博客');
    expect(view.archivePages[0]!.seo.description).toBe('全部已发布文章，第 1 页，共 1 页。');
    cleanup();
  });

  it('标签页描述缺省值', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    const architecture = view.tagPages.find((page) => page.tag.slug === 'architecture')!;
    expect(architecture.seo.title).toBe('标签：架构 · 测试博客');
    expect(architecture.seo.description).toBe('架构记录。');
    const design = view.tagPages.find((page) => page.tag.slug === 'design')!;
    expect(design.seo.description).toBe('收录“设计”标签下的 2 篇已发布文章。');
    cleanup();
  });

  it('关于页元数据', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    expect(view.about.seo.title).toBe('关于 · 测试博客');
    expect(view.about.seo.description).toBe('关于测试站点。');
    expect(view.about.seo.canonical).toBe('http://localhost:4321/about');
    cleanup();
  });

  it('404 不输出 canonical', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root);
    expect(view.notFound.title).toBe('页面不存在 · 测试博客');
    expect(view.notFound.robots).toBe('noindex,follow');
    expect('canonical' in view.notFound).toBe(false);
    cleanup();
  });

  it('SITE_URL 参与 canonical 与 OG 绝对地址', async () => {
    const { root, cleanup } = makeSite();
    const view = await createSiteView(root, 'https://blog.example.com/');
    expect(view.home.seo.canonical).toBe('https://blog.example.com/');
    expect(view.postBySlug.get('post-alpha')!.seo.canonical).toBe('https://blog.example.com/posts/post-alpha');
    expect(view.rssXml).toContain('https://blog.example.com/posts/post-alpha');
    cleanup();
  });
});
