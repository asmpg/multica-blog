import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSiteView } from '../../lib/site';
import { ContentValidationError } from '../../lib/errors';

const BASE = fileURLToPath(new URL('../fixtures/base', import.meta.url));

export interface Fixture {
  root: string;
  cleanup: () => void;
}

export function makeSite(mutate?: (root: string) => void): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'blog-fixture-'));
  cpSync(BASE, root, { recursive: true });
  mutate?.(root);
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

export function writeFile(root: string, relative: string, content: string): void {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function writeJson(root: string, relative: string, value: unknown): void {
  writeFile(root, relative, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson<T>(root: string, relative: string): T {
  return JSON.parse(readFileSync(join(root, relative), 'utf8')) as T;
}

export function removeFile(root: string, relative: string): void {
  rmSync(join(root, relative));
}

export async function validationError(root: string): Promise<ContentValidationError> {
  try {
    await createSiteView(root);
  } catch (error) {
    if (error instanceof ContentValidationError) return error;
    throw error;
  }
  throw new Error('预期内容校验失败，但构建通过了');
}

export function publishedPost(slug: string, publishedAt: string, tagSlug = 'architecture'): string {
  return `---
slug: ${slug}
title: 文章 ${slug}
excerpt: ${slug} 的摘要。
status: published
publishedAt: "${publishedAt}"
authorId: blog-team
tagSlugs:
  - ${tagSlug}
---

${slug} 的正文。

## 小节 {#section}
`;
}

export function addPublishedPosts(root: string, count: number, startDay = 1): void {
  for (let index = 0; index < count; index += 1) {
    const day = String(((startDay + index - 1) % 28) + 1).padStart(2, '0');
    const slug = `generated-${String(index).padStart(2, '0')}`;
    writeFile(root, `content/posts/${slug}.md`, publishedPost(slug, `2026-01-${day}`));
  }
}
