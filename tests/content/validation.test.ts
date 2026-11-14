import { describe, expect, it } from 'vitest';
import { createSiteView } from '../../lib/site';
import {
  makeSite,
  readJson,
  removeFile,
  validationError,
  writeFile,
  writeJson,
} from '../helpers/site';

function validPost(frontmatter: Record<string, string> = {}, body = '正文。\n\n## 小节 {#section}\n'): string {
  const base: Record<string, string> = {
    slug: 'broken',
    title: '测试文章',
    excerpt: '测试摘要。',
    status: 'published',
    publishedAt: '"2026-11-01"',
    authorId: 'blog-team',
    tagSlugs: '\n  - architecture',
  };
  const merged = { ...base, ...frontmatter };
  const lines = Object.entries(merged)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  return `---\n${lines}\n---\n\n${body}`;
}

function withPost(content: string, file = 'content/posts/broken.md') {
  return makeSite((root) => writeFile(root, file, content));
}

describe('字段校验', () => {
  it('基础 fixture 通过', async () => {
    const { root, cleanup } = makeSite();
    await expect(createSiteView(root)).resolves.toBeTruthy();
    cleanup();
  });

  it('缺少 title', async () => {
    const { root, cleanup } = withPost(validPost({ title: '' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.field === 'title')).toBe(true);
    expect(error.message).toContain('content/posts/broken.md');
    cleanup();
  });

  it('title 类型错误', async () => {
    const { root, cleanup } = withPost(validPost({ title: '123' }).replace('title: 123', 'title: 123'));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.field === 'title')).toBe(true);
    cleanup();
  });

  it('未知字段', async () => {
    const { root, cleanup } = withPost(validPost({ draft: 'true' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('未知字段'))).toBe(true);
    cleanup();
  });

  it('未知 authorId', async () => {
    const { root, cleanup } = withPost(validPost({ authorId: 'ghost' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.field === 'authorId')).toBe(true);
    cleanup();
  });

  it('未知标签', async () => {
    const { root, cleanup } = withPost(validPost({ tagSlugs: '\n  - ghost' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.field === 'tagSlugs[0]')).toBe(true);
    cleanup();
  });

  it('标签超过 10 个', async () => {
    const slugs = Array.from({ length: 11 }, (_, index) => `  - tag-${index}`).join('\n');
    const { root, cleanup } = makeSite((root) => {
      writeJson(root, 'content/tags.json', [
        ...Array.from({ length: 11 }, (_, index) => ({ slug: `tag-${index}`, name: `标签 ${index}` })),
      ]);
      writeFile(root, 'content/posts/broken.md', validPost({ tagSlugs: `\n${slugs}` }));
    });
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('最多允许 10 个标签'))).toBe(true);
    cleanup();
  });

  it('重复标签', async () => {
    const { root, cleanup } = withPost(validPost({ tagSlugs: '\n  - architecture\n  - architecture' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('标签重复'))).toBe(true);
    cleanup();
  });

  it('空正文', async () => {
    const { root, cleanup } = withPost(validPost({}, '   \n'));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.field === 'body')).toBe(true);
    cleanup();
  });

  it('图片尺寸与实际不符', async () => {
    const { root, cleanup } = withPost(
      validPost({ cover: '\n  src: /content/pixel.png\n  alt: 封面\n  width: 9\n  height: 8' }),
    );
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('实际 8×8'))).toBe(true);
    cleanup();
  });

  it('图片文件不存在', async () => {
    const { root, cleanup } = withPost(
      validPost({ cover: '\n  src: /content/missing.png\n  alt: 封面\n  width: 8\n  height: 8' }),
    );
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('资源文件不存在'))).toBe(true);
    cleanup();
  });

  it('拒绝远程图片', async () => {
    const { root, cleanup } = withPost(
      validPost({ cover: '\n  src: https://example.com/a.png\n  alt: 封面\n  width: 8\n  height: 8' }),
    );
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.field?.startsWith('cover'))).toBe(true);
    cleanup();
  });

  it('seo.canonical 是未知字段', async () => {
    const { root, cleanup } = withPost(validPost({ seo: '\n  canonical: https://example.com/' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('seo.canonical'))).toBe(true);
    cleanup();
  });

  it('空 seo 对象', async () => {
    const { root, cleanup } = withPost(validPost({ seo: '{}' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('至少需要覆盖一个字段'))).toBe(true);
    cleanup();
  });

  it('文本首尾空白', async () => {
    const { root, cleanup } = withPost(validPost({ title: '" 带空格 "' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('首尾空白'))).toBe(true);
    cleanup();
  });

  it('标题超长', async () => {
    const { root, cleanup } = withPost(validPost({ title: `"${'长'.repeat(101)}"` }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.field === 'title')).toBe(true);
    cleanup();
  });
});

describe('日期校验', () => {
  const cases: Array<[string, string, boolean]> = [
    ['闰年 2 月 29 日', '"2024-02-29"', true],
    ['非闰年 2 月 29 日', '"2026-02-29"', false],
    ['非法月份', '"2026-13-01"', false],
    ['非法日期', '"2026-11-31"', false],
    ['未加引号', '2026-11-01', false],
    ['年份为零', '"0000-01-01"', false],
  ];

  for (const [name, value, valid] of cases) {
    it(name, async () => {
      const { root, cleanup } = withPost(validPost({ publishedAt: value }));
      if (valid) {
        await expect(createSiteView(root)).resolves.toBeTruthy();
      } else {
        const error = await validationError(root);
        expect(error.issues.some((issue) => issue.field === 'publishedAt')).toBe(true);
      }
      cleanup();
    });
  }

  it('updatedAt 早于 publishedAt', async () => {
    const { root, cleanup } = withPost(validPost({ updatedAt: '"2026-10-01"' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('早于'))).toBe(true);
    cleanup();
  });

  it('draft 可以不填 publishedAt', async () => {
    const { root, cleanup } = withPost(validPost({ status: 'draft', publishedAt: '' }));
    await expect(createSiteView(root)).resolves.toBeTruthy();
    cleanup();
  });

  it('published 必须填 publishedAt', async () => {
    const { root, cleanup } = withPost(validPost({ publishedAt: '' }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.field === 'publishedAt')).toBe(true);
    cleanup();
  });
});

describe('引用与注册表校验', () => {
  it('默认作者必须存在', async () => {
    const { root, cleanup } = makeSite((root) => {
      const site = readJson<Record<string, unknown>>(root, 'content/site.json');
      writeJson(root, 'content/site.json', { ...site, defaultAuthorId: 'ghost' });
    });
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('defaultAuthorId'))).toBe(true);
    cleanup();
  });

  it('注册表根值必须是数组', async () => {
    const { root, cleanup } = makeSite((root) => writeJson(root, 'content/tags.json', { tags: [] }));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('根值必须是数组'))).toBe(true);
    cleanup();
  });

  it('注册表缺失会报错', async () => {
    const { root, cleanup } = makeSite((root) => removeFile(root, 'content/site.json'));
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.file === 'content/site.json')).toBe(true);
    cleanup();
  });

  it('about 正文不能为空', async () => {
    const { root, cleanup } = makeSite((root) =>
      writeFile(root, 'content/about.md', '---\ntitle: 关于\ndescription: 介绍。\nauthorId: blog-team\n---\n\n'),
    );
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.file === 'content/about.md')).toBe(true);
    cleanup();
  });

  it('系列 order 在所有状态间唯一', async () => {
    const { root, cleanup } = makeSite((root) => {
      writeJson(root, 'content/series.json', [{ slug: 's1', title: '系列' }]);
      writeFile(
        root,
        'content/posts/series-a.md',
        validPost({ slug: 'series-a', series: '\n  slug: s1\n  order: 1' }),
      );
      writeFile(
        root,
        'content/posts/series-b.md',
        validPost({ slug: 'series-b', series: '\n  slug: s1\n  order: 1' }),
      );
    });
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('order 1'))).toBe(true);
    cleanup();
  });

  it('页面 title 必须全局唯一', async () => {
    const { root, cleanup } = makeSite((root) => {
      writeFile(root, 'content/posts/dup-a.md', validPost({ slug: 'dup-a', title: '重复标题' }));
      writeFile(root, 'content/posts/dup-b.md', validPost({ slug: 'dup-b', title: '重复标题' }));
    });
    const error = await validationError(root);
    expect(error.issues.some((issue) => issue.reason.includes('title 与其他路由重复'))).toBe(true);
    cleanup();
  });
});
