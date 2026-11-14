import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Issues } from './errors';
import { parseMarkdown, type MarkdownLink } from './markdown';
import type {
  AboutSource,
  Author,
  Category,
  ContentDataset,
  PostSource,
  PostStatus,
  Series,
  Site,
  Tag,
} from './types';
import {
  describeValue,
  isPlainObject,
  validateDate,
  validateEnum,
  validateImage,
  validateInteger,
  validateObject,
  validateOptionalObject,
  validateSeo,
  validateSlug,
  validateText,
} from './validate';

interface ParsedPost extends PostSource {
  links: MarkdownLink[];
  imageSrcs: string[];
}

interface ParsedAbout extends AboutSource {
  links: MarkdownLink[];
  imageSrcs: string[];
}

const POST_FIELDS = [
  'slug',
  'title',
  'excerpt',
  'status',
  'publishedAt',
  'updatedAt',
  'authorId',
  'tagSlugs',
  'categorySlug',
  'series',
  'cover',
  'seo',
] as const;
const ABOUT_FIELDS = ['title', 'description', 'authorId', 'seo'] as const;
const STATUSES: readonly PostStatus[] = ['draft', 'published', 'archived'];

interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

function readText(path: string, file: string, issues: Issues): string | undefined {
  if (!existsSync(path)) {
    issues.add(file, '文件不存在');
    return undefined;
  }
  return readFileSync(path, 'utf8');
}

function readJson(path: string, file: string, issues: Issues): unknown {
  const text = readText(path, file, issues);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch (error) {
    issues.add(file, `JSON 解析失败：${(error as Error).message}`);
    return undefined;
  }
}

function readFrontmatter(raw: string, file: string, issues: Issues): Frontmatter | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(raw);
  if (!match) {
    issues.add(file, '文件必须以 --- 开始的 YAML frontmatter 开头');
    return undefined;
  }
  const yamlText = match[1]!;
  for (const key of ['publishedAt', 'updatedAt']) {
    const line = new RegExp(`^${key}:[ \\t]*(\\S.*)$`, 'm').exec(yamlText);
    if (line && /^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(line[1]!.trim())) {
      issues.add(file, `YAML 日期必须加引号（${key}）`, key);
      return undefined;
    }
  }
  let data: unknown;
  try {
    data = parseYaml(yamlText);
  } catch (error) {
    issues.add(file, `YAML 解析失败：${(error as Error).message}`);
    return undefined;
  }
  if (!isPlainObject(data)) {
    issues.add(file, 'frontmatter 必须是一个映射对象');
    return undefined;
  }
  return { data, body: raw.slice(match[0].length) };
}

function validateRegistry<T>(
  value: unknown,
  file: string,
  issues: Issues,
  validateEntry: (entry: unknown, field: string) => T | undefined,
): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.add(file, `根值必须是数组，实际为 ${describeValue(value)}`);
    return [];
  }
  const entries: T[] = [];
  value.forEach((entry, index) => {
    const parsed = validateEntry(entry, `[${index}]`);
    if (parsed !== undefined) entries.push(parsed);
  });
  return entries;
}

function validateAuthor(value: unknown, file: string, field: string, publicDir: string, issues: Issues): Author | undefined {
  const obj = validateObject(value, file, field, ['id', 'name', 'bio', 'avatar', 'url'], issues);
  if (!obj) return undefined;
  const id = validateSlug(obj.id, file, `${field}.id`, issues);
  const name = validateText(obj.name, file, `${field}.name`, 1, 60, issues);
  const bio = validateText(obj.bio, file, `${field}.bio`, 1, 300, issues, false);
  const avatar = obj.avatar === undefined ? undefined : validateImage(obj.avatar, file, `${field}.avatar`, publicDir, issues);
  let url: string | undefined;
  if (obj.url !== undefined) {
    if (typeof obj.url !== 'string') {
      issues.add(file, `类型错误：url 应为字符串，实际为 ${describeValue(obj.url)}`, `${field}.url`);
    } else {
      try {
        const parsed = new URL(obj.url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('invalid');
        url = obj.url;
      } catch {
        issues.add(file, 'url 必须是无 userinfo 的 HTTPS 绝对 URL', `${field}.url`);
      }
    }
  }
  if (id === undefined || name === undefined) return undefined;
  return { id, name, ...(bio !== undefined ? { bio } : {}), ...(avatar ? { avatar } : {}), ...(url ? { url } : {}) };
}

function validateTagLike(value: unknown, file: string, field: string, issues: Issues): Tag | Category | undefined {
  const obj = validateObject(value, file, field, ['slug', 'name', 'description'], issues);
  if (!obj) return undefined;
  const slug = validateSlug(obj.slug, file, `${field}.slug`, issues);
  const name = validateText(obj.name, file, `${field}.name`, 1, 40, issues);
  const description = validateText(obj.description, file, `${field}.description`, 1, 200, issues, false);
  if (slug === undefined || name === undefined) return undefined;
  return { slug, name, ...(description !== undefined ? { description } : {}) };
}

function validateSeriesEntry(value: unknown, file: string, field: string, issues: Issues): Series | undefined {
  const obj = validateObject(value, file, field, ['slug', 'title', 'description'], issues);
  if (!obj) return undefined;
  const slug = validateSlug(obj.slug, file, `${field}.slug`, issues);
  const title = validateText(obj.title, file, `${field}.title`, 1, 80, issues);
  const description = validateText(obj.description, file, `${field}.description`, 1, 200, issues, false);
  if (slug === undefined || title === undefined) return undefined;
  return { slug, title, ...(description !== undefined ? { description } : {}) };
}

function validateSite(value: unknown, file: string, publicDir: string, issues: Issues): Site | undefined {
  const obj = validateObject(
    value,
    file,
    '',
    ['name', 'description', 'language', 'defaultAuthorId', 'defaultOgImage'],
    issues,
  );
  if (!obj) return undefined;
  const name = validateText(obj.name, file, 'name', 1, 40, issues);
  const description = validateText(obj.description, file, 'description', 1, 200, issues);
  const language = validateEnum(obj.language, file, 'language', ['zh-CN'] as const, issues);
  const defaultAuthorId = validateSlug(obj.defaultAuthorId, file, 'defaultAuthorId', issues);
  const defaultOgImage = validateImage(obj.defaultOgImage, file, 'defaultOgImage', publicDir, issues);
  if (
    name === undefined ||
    description === undefined ||
    language === undefined ||
    defaultAuthorId === undefined ||
    defaultOgImage === undefined
  ) {
    return undefined;
  }
  return { name, description, language, defaultAuthorId, defaultOgImage };
}

function validateTagSlugs(value: unknown, file: string, field: string, issues: Issues): string[] | undefined {
  if (value === undefined) {
    issues.add(file, '缺少必填字段', field);
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.add(file, `类型错误：应为数组，实际为 ${describeValue(value)}`, field);
    return undefined;
  }
  if (value.length > 10) {
    issues.add(file, `最多允许 10 个标签，实际 ${value.length}`, field);
    return undefined;
  }
  const slugs: string[] = [];
  value.forEach((entry, index) => {
    const slug = validateSlug(entry, file, `${field}[${index}]`, issues);
    if (slug === undefined) return;
    if (slugs.includes(slug)) {
      issues.add(file, `标签重复：${slug}`, `${field}[${index}]`);
      return;
    }
    slugs.push(slug);
  });
  return slugs;
}

function validateSeriesRef(
  value: unknown,
  file: string,
  field: string,
  issues: Issues,
): { slug: string; order: number } | undefined {
  const obj = validateOptionalObject(value, file, field, ['slug', 'order'], issues);
  if (!obj) return undefined;
  const slug = validateSlug(obj.slug, file, `${field}.slug`, issues);
  const order = validateInteger(obj.order, file, `${field}.order`, 1, 999, issues);
  if (slug === undefined || order === undefined) return undefined;
  return { slug, order };
}

function validatePost(
  file: string,
  fileSlug: string,
  frontmatter: Frontmatter,
  publicDir: string,
  issues: Issues,
): ParsedPost | undefined {
  const obj = validateObject(frontmatter.data, file, '', POST_FIELDS, issues);
  if (!obj) return undefined;
  const slug = validateSlug(obj.slug, file, 'slug', issues);
  if (slug !== undefined && slug !== fileSlug) {
    issues.add(file, `文件名 ${fileSlug}.md 必须与 frontmatter slug ${slug} 完全一致`, 'slug');
  }
  const title = validateText(obj.title, file, 'title', 1, 100, issues);
  const excerpt = validateText(obj.excerpt, file, 'excerpt', 1, 200, issues);
  const status = validateEnum(obj.status, file, 'status', STATUSES, issues);
  const publishedAt = validateDate(
    obj.publishedAt,
    file,
    'publishedAt',
    issues,
    status === 'published' || status === 'archived',
  );
  const updatedAt = validateDate(obj.updatedAt, file, 'updatedAt', issues, false);
  if (updatedAt !== undefined) {
    if (publishedAt === undefined) {
      issues.add(file, '存在 updatedAt 时必须同时提供 publishedAt', 'updatedAt');
    } else if (updatedAt < publishedAt) {
      issues.add(file, `updatedAt ${updatedAt} 早于 publishedAt ${publishedAt}`, 'updatedAt');
    }
  }
  const authorId = validateSlug(obj.authorId, file, 'authorId', issues);
  const tagSlugs = validateTagSlugs(obj.tagSlugs, file, 'tagSlugs', issues);
  const categorySlug = validateSlug(obj.categorySlug, file, 'categorySlug', issues, false);
  const series = validateSeriesRef(obj.series, file, 'series', issues);
  const cover = obj.cover === undefined ? undefined : validateImage(obj.cover, file, 'cover', publicDir, issues);
  const seo = validateSeo(obj.seo, file, 'seo', publicDir, issues);

  const body = frontmatter.body.trim();
  if (body === '') {
    issues.add(file, '正文去除空白后至少需要 1 个字符', 'body');
  }
  const parsed = parseMarkdown(frontmatter.body, file, 'body', publicDir, issues);

  if (
    slug === undefined ||
    title === undefined ||
    excerpt === undefined ||
    status === undefined ||
    authorId === undefined ||
    tagSlugs === undefined
  ) {
    return undefined;
  }
  if (body === '') return undefined;
  return {
    slug,
    title,
    excerpt,
    status,
    ...(publishedAt !== undefined ? { publishedAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    authorId,
    tagSlugs,
    ...(categorySlug !== undefined ? { categorySlug } : {}),
    ...(series ? { series } : {}),
    ...(cover ? { cover } : {}),
    ...(seo ? { seo } : {}),
    body: frontmatter.body,
    bodyHtml: parsed.html,
    headingIds: parsed.headingIds,
    filePath: file,
    links: parsed.links,
    imageSrcs: parsed.imageSrcs,
  };
}

function validateAbout(
  file: string,
  frontmatter: Frontmatter,
  publicDir: string,
  issues: Issues,
): ParsedAbout | undefined {
  const obj = validateObject(frontmatter.data, file, '', ABOUT_FIELDS, issues);
  if (!obj) return undefined;
  const title = validateText(obj.title, file, 'title', 1, 100, issues);
  const description = validateText(obj.description, file, 'description', 1, 200, issues);
  const authorId = validateSlug(obj.authorId, file, 'authorId', issues);
  const seo = validateSeo(obj.seo, file, 'seo', publicDir, issues);
  const body = frontmatter.body.trim();
  if (body === '') {
    issues.add(file, '正文去除空白后至少需要 1 个字符', 'body');
  }
  const parsed = parseMarkdown(frontmatter.body, file, 'body', publicDir, issues);
  if (title === undefined || description === undefined || authorId === undefined || body === '') {
    return undefined;
  }
  return {
    title,
    description,
    authorId,
    ...(seo ? { seo } : {}),
    body: frontmatter.body,
    bodyHtml: parsed.html,
    headingIds: parsed.headingIds,
    filePath: file,
    links: parsed.links,
    imageSrcs: parsed.imageSrcs,
  };
}

export interface LoadedContent {
  dataset: ContentDataset;
  postLinks: Map<string, MarkdownLink[]>;
  postImages: Map<string, string[]>;
  aboutLinks: MarkdownLink[];
  aboutImages: string[];
}

export function loadContent(root: string): LoadedContent {
  const issues = new Issues();
  const contentDir = join(root, 'content');
  const publicDir = join(root, 'public');

  const siteFile = 'content/site.json';
  const site = validateSite(readJson(join(contentDir, 'site.json'), siteFile, issues), siteFile, publicDir, issues);

  const authorsFile = 'content/authors.json';
  const authors = validateRegistry(readJson(join(contentDir, 'authors.json'), authorsFile, issues), authorsFile, issues, (entry, field) =>
    validateAuthor(entry, authorsFile, field, publicDir, issues),
  );
  const tagsFile = 'content/tags.json';
  const tags = validateRegistry(readJson(join(contentDir, 'tags.json'), tagsFile, issues), tagsFile, issues, (entry, field) =>
    validateTagLike(entry, tagsFile, field, issues),
  ) as Tag[];
  const categoriesFile = 'content/categories.json';
  const categories = validateRegistry(
    readJson(join(contentDir, 'categories.json'), categoriesFile, issues),
    categoriesFile,
    issues,
    (entry, field) => validateTagLike(entry, categoriesFile, field, issues),
  ) as Category[];
  const seriesFile = 'content/series.json';
  const series = validateRegistry(readJson(join(contentDir, 'series.json'), seriesFile, issues), seriesFile, issues, (entry, field) =>
    validateSeriesEntry(entry, seriesFile, field, issues),
  );

  assertUnique(authors, (author) => author.id, authorsFile, 'id', issues);
  assertUnique(tags, (tag) => tag.slug, tagsFile, 'slug', issues);
  assertUnique(tags, (tag) => tag.name.normalize('NFC'), tagsFile, 'name', issues);
  assertUnique(categories, (category) => category.slug, categoriesFile, 'slug', issues);
  assertUnique(categories, (category) => category.name.normalize('NFC'), categoriesFile, 'name', issues);
  assertUnique(series, (entry) => entry.slug, seriesFile, 'slug', issues);
  assertUnique(series, (entry) => entry.title, seriesFile, 'title', issues);

  const authorIds = new Set(authors.map((author) => author.id));
  const tagSlugs = new Set(tags.map((tag) => tag.slug));
  const categorySlugs = new Set(categories.map((category) => category.slug));
  const seriesSlugs = new Set(series.map((entry) => entry.slug));
  if (site) {
    if (!authorIds.has(site.defaultAuthorId)) {
      issues.add(siteFile, `defaultAuthorId 指向不存在的作者：${site.defaultAuthorId}`, 'defaultAuthorId');
    }
  }

  const postsDir = join(contentDir, 'posts');
  const postFiles = existsSync(postsDir)
    ? readdirSync(postsDir)
        .filter((name) => name.endsWith('.md'))
        .sort()
    : [];
  if (postFiles.length === 0) {
    issues.add('content/posts', '至少需要一篇示例文章');
  }

  const posts: PostSource[] = [];
  const postLinks = new Map<string, MarkdownLink[]>();
  const postImages = new Map<string, string[]>();
  const seenSlugs = new Set<string>();
  const seriesOrders = new Map<string, Map<number, string>>();

  for (const name of postFiles) {
    const file = `content/posts/${name}`;
    const fileSlug = name.slice(0, -3);
    const raw = readText(join(postsDir, name), file, issues);
    if (raw === undefined) continue;
    const frontmatter = readFrontmatter(raw, file, issues);
    if (!frontmatter) continue;
    const post = validatePost(file, fileSlug, frontmatter, publicDir, issues);
    if (!post) continue;

    if (seenSlugs.has(post.slug)) {
      issues.add(file, `文章 slug 重复：${post.slug}`, 'slug');
      continue;
    }
    seenSlugs.add(post.slug);

    if (!authorIds.has(post.authorId)) {
      issues.add(file, `authorId 指向不存在的作者：${post.authorId}`, 'authorId');
    }
    for (const [index, tagSlug] of post.tagSlugs.entries()) {
      if (!tagSlugs.has(tagSlug)) {
        issues.add(file, `tagSlugs[${index}] 指向不存在的标签：${tagSlug}`, `tagSlugs[${index}]`);
      }
    }
    if (post.categorySlug !== undefined && !categorySlugs.has(post.categorySlug)) {
      issues.add(file, `categorySlug 指向不存在的分类：${post.categorySlug}`, 'categorySlug');
    }
    if (post.series) {
      if (!seriesSlugs.has(post.series.slug)) {
        issues.add(file, `series.slug 指向不存在的系列：${post.series.slug}`, 'series.slug');
      } else {
        const orders = seriesOrders.get(post.series.slug) ?? new Map<number, string>();
        const existing = orders.get(post.series.order);
        if (existing !== undefined) {
          issues.add(file, `系列 ${post.series.slug} 的 order ${post.series.order} 与 ${existing} 重复`, 'series.order');
        } else {
          orders.set(post.series.order, post.slug);
        }
        seriesOrders.set(post.series.slug, orders);
      }
    }

    postLinks.set(post.slug, post.links);
    postImages.set(post.slug, post.imageSrcs);
    posts.push(stripMarkdownExtras(post));
  }

  const aboutFile = 'content/about.md';
  const aboutRaw = readText(join(contentDir, 'about.md'), aboutFile, issues);
  let about: AboutSource | undefined;
  let aboutLinks: MarkdownLink[] = [];
  let aboutImages: string[] = [];
  if (aboutRaw !== undefined) {
    const frontmatter = readFrontmatter(aboutRaw, aboutFile, issues);
    if (frontmatter) {
      const parsedAbout = validateAbout(aboutFile, frontmatter, publicDir, issues);
      if (parsedAbout) {
        aboutLinks = parsedAbout.links;
        aboutImages = parsedAbout.imageSrcs;
        if (!authorIds.has(parsedAbout.authorId)) {
          issues.add(aboutFile, `authorId 指向不存在的作者：${parsedAbout.authorId}`, 'authorId');
        }
        about = stripMarkdownExtras(parsedAbout);
      }
    }
  }

  issues.throwIfAny();

  return {
    dataset: {
      root,
      site: site!,
      authors,
      tags,
      categories,
      series,
      posts,
      about: about!,
    },
    postLinks,
    postImages,
    aboutLinks,
    aboutImages,
  };
}

function stripMarkdownExtras<T extends object>(value: T): T {
  const clone = { ...value } as Record<string, unknown>;
  delete clone.links;
  delete clone.imageSrcs;
  return clone as T;
}

function assertUnique<T>(
  entries: T[],
  key: (entry: T) => string,
  file: string,
  field: string,
  issues: Issues,
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const value = key(entry);
    if (seen.has(value)) {
      issues.add(file, `${field} 重复：${value}`, field);
    }
    seen.add(value);
  }
}
