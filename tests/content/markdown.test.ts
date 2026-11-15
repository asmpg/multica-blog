import { describe, expect, it } from 'vitest';
import { createSiteView } from '../../lib/site';
import { makeSite, validationError, writeFile } from '../helpers/site';

function postWithBody(body: string): string {
  return `---
slug: safety
title: 安全测试
excerpt: 安全测试摘要。
status: published
publishedAt: "2026-11-01"
authorId: blog-team
tagSlugs: []
---

${body}
`;
}

function withBody(body: string) {
  return makeSite((root) => writeFile(root, 'content/posts/safety.md', postWithBody(body)));
}

describe('Markdown 安全边界', () => {
  const rejected: Array<[string, string]> = [
    ['原始 HTML', '<div>hello</div>'],
    ['脚本标签', '<script>alert(1)</script>'],
    ['行内事件', '<span onclick="alert(1)">x</span>'],
    ['javascript 链接', '[点我](javascript:alert(1))'],
    ['data 链接', '[点我](data:text/html,hello)'],
    ['file 链接', '[点我](file:///etc/passwd)'],
    ['正文 H1', '# 一级标题'],
    ['无 alt 图片', '![](/content/pixel.png)'],
    ['远程图片', '![图](https://example.com/a.png)'],
    ['表格扩展', '| a | b |\n| - | - |\n| 1 | 2 |'],
    ['标题缺少 id', '## 没有 id'],
    ['标题 id 为 main', '## 标题 {#main}'],
    ['重复标题 id', '## 一 {#dup}\n\n## 二 {#dup}'],
    ['失效锚点', '[跳转](#missing)'],
    ['链接到草稿', '[草稿](/posts/draft-delta)'],
    ['链接到未知页面', '[未知](/posts/not-there)'],
    ['目标锚点不存在', '[锚点](/posts/post-beta#nope)'],
    ['链接到未公开资源', '[图片](/content/draft-only.png)'],
    ['协议相对链接', '[链接](//example.com/x)'],
  ];

  for (const [name, body] of rejected) {
    it(`拒绝${name}`, async () => {
      const { root, cleanup } = withBody(body);
      const error = await validationError(root);
      expect(error.issues.some((issue) => issue.field === 'body')).toBe(true);
      cleanup();
    });
  }

  it('允许 HTTPS、本站页面、站内锚点、正文图片与代码中的 HTML', async () => {
    const { root, cleanup } = withBody(
      [
        '## 小节 {#section}',
        '',
        '阅读[关于](/about)、[贝塔文章的小节](/posts/post-beta#beta)与[本文小节](#section)。',
        '',
        '外部链接：[Astro](https://docs.astro.build/)。',
        '',
        '![示意图](/content/pixel.png)',
        '',
        '```html',
        '<div>代码块中的 HTML 只是文本</div>',
        '```',
      ].join('\n'),
    );
    const view = await createSiteView(root);
    const body = view.postBySlug.get('safety')!.body;
    expect(body).toContain('<h2 id="section">小节</h2>');
    expect(body).not.toContain('{#');
    expect(body).toContain('&lt;div&gt;代码块中的 HTML 只是文本&lt;/div&gt;');
    cleanup();
  });
});
