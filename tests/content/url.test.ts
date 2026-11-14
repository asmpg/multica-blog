import { describe, expect, it } from 'vitest';
import { archivePath, canonicalUrl, normalizeSiteUrl, postPath, tagPath } from '../../lib/url';

describe('URL 规则', () => {
  it('文章路径不带扩展名', () => {
    expect(postPath('hello-world')).toBe('/posts/hello-world');
  });

  it('归档第一页不使用 page/1', () => {
    expect(archivePath(1)).toBe('/archive');
    expect(archivePath(2)).toBe('/archive/page/2');
    expect(archivePath(13)).toBe('/archive/page/13');
  });

  it('标签路径', () => {
    expect(tagPath('architecture')).toBe('/tags/architecture');
  });

  it('canonical 拼接', () => {
    expect(canonicalUrl('https://example.com', '/')).toBe('https://example.com/');
    expect(canonicalUrl('https://example.com', '/posts/a')).toBe('https://example.com/posts/a');
  });
});

describe('SITE_URL 归一化', () => {
  it('缺省为本地地址', () => {
    expect(normalizeSiteUrl(undefined)).toBe('http://localhost:4321');
    expect(normalizeSiteUrl('')).toBe('http://localhost:4321');
  });

  it('去掉结尾斜杠', () => {
    expect(normalizeSiteUrl('https://example.com/')).toBe('https://example.com');
  });

  it('拒绝非本地 http', () => {
    expect(() => normalizeSiteUrl('http://example.com')).toThrow(/HTTPS/);
  });

  it('允许本地 http', () => {
    expect(normalizeSiteUrl('http://127.0.0.1:4321')).toBe('http://127.0.0.1:4321');
  });

  it('拒绝子路径、query、fragment 与 userinfo', () => {
    expect(() => normalizeSiteUrl('https://example.com/blog')).toThrow(/子路径/);
    expect(() => normalizeSiteUrl('https://example.com/?a=1')).toThrow(/query/);
    expect(() => normalizeSiteUrl('https://example.com/#x')).toThrow(/query/);
    expect(() => normalizeSiteUrl('https://user:pass@example.com')).toThrow(/userinfo/);
  });
});
