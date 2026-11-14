import rss from '@astrojs/rss';
import { Issues } from './errors';
import { loadContent } from './content';
import { aboutSeo, archiveSeo, homeSeo, notFoundSeo, postSeo, tagSeo } from './seo';
import type {
  About,
  ArchivePage,
  Author,
  Home,
  Image,
  PostSource,
  PublicPostDetail,
  PublicPostSummary,
  PublicRoute,
  PublicTag,
  Site,
  SiteView,
  TagPage,
} from './types';
import { archivePath, canonicalUrl, normalizeSiteUrl, PAGE_SIZE, postPath, tagPath } from './url';

function comparePosts(a: PostSource, b: PostSource): number {
  const dateA = a.publishedAt ?? '';
  const dateB = b.publishedAt ?? '';
  if (dateA !== dateB) return dateA < dateB ? 1 : -1;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

function publicAuthor(author: Author): PublicPostSummary['author'] {
  return { id: author.id, name: author.name, ...(author.url ? { url: author.url } : {}) };
}

function toSummary(post: PostSource, authors: Map<string, Author>, tags: Map<string, { slug: string; name: string }>, siteUrl: string): PublicPostSummary {
  const author = authors.get(post.authorId);
  if (!author) throw new Error(`作者不存在：${post.authorId}`);
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt!,
    ...(post.updatedAt ? { updatedAt: post.updatedAt } : {}),
    path: postPath(post.slug),
    canonical: canonicalUrl(siteUrl, postPath(post.slug)),
    author: publicAuthor(author),
    tags: post.tagSlugs.map((slug) => {
      const tag = tags.get(slug);
      if (!tag) throw new Error(`标签不存在：${slug}`);
      return { slug: tag.slug, name: tag.name, path: tagPath(tag.slug) };
    }),
    ...(post.cover ? { cover: post.cover } : {}),
  };
}

function addImage(assets: Set<string>, image: Image | undefined): void {
  if (image) assets.add(image.src);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemap(routes: PublicRoute[], published: PostSource[]): string {
  const lastmodByPath = new Map<string, string>();
  for (const post of published) {
    lastmodByPath.set(postPath(post.slug), post.updatedAt ?? post.publishedAt!);
  }
  const sorted = [...routes].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const urls = sorted.map((route) => {
    const lastmod = lastmodByPath.get(route.path);
    return `  <url>\n    <loc>${escapeXml(route.canonical)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

async function buildRss(
  site: Site,
  siteUrl: string,
  published: PostSource[],
  authors: Map<string, Author>,
): Promise<string> {
  const lastBuild = published.reduce<string | undefined>((latest, post) => {
    const candidate = post.updatedAt ?? post.publishedAt!;
    return latest === undefined || candidate > latest ? candidate : latest;
  }, undefined);
  const customData = [
    '<language>zh-CN</language>',
    ...(lastBuild ? [`<lastBuildDate>${new Date(`${lastBuild}T00:00:00Z`).toUTCString()}</lastBuildDate>`] : []),
  ].join('');
  const response = await rss({
    title: site.name,
    description: site.description,
    site: siteUrl,
    trailingSlash: false,
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
    customData,
    items: published.map((post) => ({
      title: post.title,
      description: post.excerpt,
      pubDate: new Date(`${post.publishedAt}T00:00:00Z`),
      link: canonicalUrl(siteUrl, postPath(post.slug)),
      customData: `<dc:creator>${escapeXml(authors.get(post.authorId)!.name)}</dc:creator>`,
    })),
  });
  return response.text();
}

function validateContentLinks(
  loaded: ReturnType<typeof loadContent>,
  anchorsByPath: Map<string, Set<string>>,
  publicAssets: Set<string>,
  issues: Issues,
): void {
  const knownResources = new Set(['/rss.xml', '/sitemap.xml']);
  const check = (href: string, file: string, field: string): void => {
    if (href.startsWith('#')) return;
    if (!href.startsWith('/') || href.startsWith('//')) return;
    const [pathPart, fragment] = href.split('#');
    if (pathPart === undefined) return;
    if (pathPart.startsWith('/content/')) {
      if (!publicAssets.has(pathPart)) {
        issues.add(file, `链接到未公开的资源：${href}`, field);
      }
      if (fragment !== undefined) {
        issues.add(file, `资源链接不得包含锚点：${href}`, field);
      }
      return;
    }
    const anchors = anchorsByPath.get(pathPart);
    if (anchors === undefined && !knownResources.has(pathPart)) {
      issues.add(file, `链接到不存在的公开页面：${href}`, field);
      return;
    }
    if (fragment !== undefined && fragment !== '' && !anchors?.has(fragment)) {
      issues.add(file, `锚点在目标页面不存在：${href}`, field);
    }
  };

  for (const post of loaded.dataset.posts) {
    for (const link of loaded.postLinks.get(post.slug) ?? []) {
      check(link.href, post.filePath, link.field);
    }
  }
  for (const link of loaded.aboutLinks) {
    check(link.href, loaded.dataset.about.filePath, link.field);
  }
}

export async function createSiteView(root: string, siteUrlInput?: string): Promise<SiteView> {
  const siteUrl = normalizeSiteUrl(siteUrlInput);
  const loaded = loadContent(root);
  const { dataset } = loaded;
  const issues = new Issues();
  const site = dataset.site;

  const authors = new Map(dataset.authors.map((author) => [author.id, author]));
  const tags = new Map(dataset.tags.map((tag) => [tag.slug, tag]));

  const published = dataset.posts.filter((post) => post.status === 'published').sort(comparePosts);
  const totalPages = Math.max(1, Math.ceil(published.length / PAGE_SIZE));

  const publicAssets = new Set<string>();
  addImage(publicAssets, site.defaultOgImage);
  for (const post of published) {
    addImage(publicAssets, post.cover);
    addImage(publicAssets, post.seo?.ogImage);
    for (const src of loaded.postImages.get(post.slug) ?? []) publicAssets.add(src);
    addImage(publicAssets, authors.get(post.authorId)?.avatar);
  }
  addImage(publicAssets, dataset.about.seo?.ogImage);
  addImage(publicAssets, authors.get(dataset.about.authorId)?.avatar);
  for (const src of loaded.aboutImages) publicAssets.add(src);

  const homePosts = published.slice(0, PAGE_SIZE).map((post) => toSummary(post, authors, tags, siteUrl));
  const postDetails: PublicPostDetail[] = published.map((post) => ({
    ...toSummary(post, authors, tags, siteUrl),
    body: post.bodyHtml,
    seo: postSeo(site, siteUrl, post),
  }));
  const postBySlug = new Map(postDetails.map((post) => [post.slug, post]));

  const archivePages: ArchivePage[] = [];
  for (let page = 1; page <= totalPages; page += 1) {
    const start = PAGE_SIZE * (page - 1);
    archivePages.push({
      posts: published.slice(start, Math.min(start + PAGE_SIZE, published.length)).map((post) => toSummary(post, authors, tags, siteUrl)),
      page,
      pageSize: PAGE_SIZE,
      totalItems: published.length,
      totalPages,
      path: archivePath(page),
      ...(page > 1 ? { previousPath: archivePath(page - 1) } : {}),
      ...(page < totalPages ? { nextPath: archivePath(page + 1) } : {}),
      seo: archiveSeo(site, siteUrl, page, totalPages),
    });
  }

  const tagPages: TagPage[] = [];
  for (const tag of dataset.tags) {
    const posts = published.filter((post) => post.tagSlugs.includes(tag.slug));
    if (posts.length === 0) continue;
    const publicTag: PublicTag = {
      slug: tag.slug,
      name: tag.name,
      ...(tag.description ? { description: tag.description } : {}),
      path: tagPath(tag.slug),
    };
    tagPages.push({
      tag: publicTag,
      posts: posts.map((post) => toSummary(post, authors, tags, siteUrl)),
      totalItems: posts.length,
      seo: tagSeo(site, siteUrl, tag, posts.length),
    });
  }

  const aboutAuthor = authors.get(dataset.about.authorId)!;
  const about: About = {
    title: dataset.about.title,
    description: dataset.about.description,
    author: { ...publicAuthor(aboutAuthor), ...(aboutAuthor.avatar ? { avatar: aboutAuthor.avatar } : {}) },
    body: dataset.about.bodyHtml,
    seo: aboutSeo(site, siteUrl, dataset.about),
  };

  const home: Home = { posts: homePosts, totalPublished: published.length, seo: homeSeo(site, siteUrl) };

  const routes: PublicRoute[] = [
    { kind: 'home', path: '/', canonical: canonicalUrl(siteUrl, '/'), seo: home.seo },
    { kind: 'about', path: '/about', canonical: canonicalUrl(siteUrl, '/about'), seo: about.seo },
    ...archivePages.map((page) => ({ kind: 'archive' as const, path: page.path, canonical: page.seo.canonical, seo: page.seo })),
    ...tagPages.map((page) => ({ kind: 'tag' as const, path: page.tag.path, canonical: page.seo.canonical, seo: page.seo })),
    ...postDetails.map((post) => ({ kind: 'post' as const, path: post.path, canonical: post.seo.canonical, seo: post.seo })),
  ];

  const titles = new Map<string, string>();
  for (const route of routes) {
    const existing = titles.get(route.seo.title);
    if (existing !== undefined) {
      issues.add(route.path, `页面 title 与其他路由重复：${route.seo.title}（另一路由 ${existing}）`, 'title');
    } else {
      titles.set(route.seo.title, route.path);
    }
  }

  const anchorsByPath = new Map<string, Set<string>>();
  for (const post of published) anchorsByPath.set(postPath(post.slug), new Set(post.headingIds));
  anchorsByPath.set('/about', new Set(dataset.about.headingIds));
  validateContentLinks(loaded, anchorsByPath, publicAssets, issues);
  issues.throwIfAny();

  const rssXml = await buildRss(site, siteUrl, published, authors);
  const sitemapXml = buildSitemap(routes, published);

  return {
    site,
    siteUrl,
    home,
    about,
    posts: postDetails,
    postBySlug,
    archivePages,
    tagPages,
    routes,
    routeByPath: new Map(routes.map((route) => [route.path, route])),
    rssXml,
    sitemapXml,
    notFound: notFoundSeo(site),
    publicAssets: [...publicAssets].sort(),
  };
}
