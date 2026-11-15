import type { Image, NotFoundSEO, PageSEO, PostSource, Site, Tag } from './types';
import { absoluteAssetUrl, archivePath, canonicalUrl, tagPath } from './url';

interface SeoInput {
  site: Site;
  siteUrl: string;
  path: string;
  title: string;
  description: string;
  image: Image;
  ogType: 'website' | 'article';
}

function buildSeo({ site, siteUrl, path, title, description, image, ogType }: SeoInput): PageSEO {
  return {
    title,
    description,
    canonical: canonicalUrl(siteUrl, path),
    ogTitle: title,
    ogDescription: description,
    ogImage: absoluteAssetUrl(siteUrl, image.src),
    ogImageAlt: image.alt,
    ogImageWidth: image.width,
    ogImageHeight: image.height,
    ogType,
    language: site.language,
  };
}

export function postSeo(site: Site, siteUrl: string, post: PostSource): PageSEO {
  return buildSeo({
    site,
    siteUrl,
    path: `/posts/${post.slug}`,
    title: `${post.seo?.title ?? post.title} · ${site.name}`,
    description: post.seo?.description ?? post.excerpt,
    image: post.seo?.ogImage ?? post.cover ?? site.defaultOgImage,
    ogType: 'article',
  });
}

export function homeSeo(site: Site, siteUrl: string): PageSEO {
  return buildSeo({
    site,
    siteUrl,
    path: '/',
    title: `首页 · ${site.name}`,
    description: site.description,
    image: site.defaultOgImage,
    ogType: 'website',
  });
}

export function archiveSeo(site: Site, siteUrl: string, page: number, totalPages: number): PageSEO {
  return buildSeo({
    site,
    siteUrl,
    path: archivePath(page),
    title: page === 1 ? `文章归档 · ${site.name}` : `文章归档（第 ${page} 页） · ${site.name}`,
    description: `全部已发布文章，第 ${page} 页，共 ${totalPages} 页。`,
    image: site.defaultOgImage,
    ogType: 'website',
  });
}

export function tagSeo(site: Site, siteUrl: string, tag: Tag, count: number): PageSEO {
  return buildSeo({
    site,
    siteUrl,
    path: tagPath(tag.slug),
    title: `标签：${tag.name} · ${site.name}`,
    description: tag.description ?? `收录“${tag.name}”标签下的 ${count} 篇已发布文章。`,
    image: site.defaultOgImage,
    ogType: 'website',
  });
}

export function aboutSeo(site: Site, siteUrl: string, about: { title: string; description: string; seo?: { title?: string; description?: string; ogImage?: Image } }): PageSEO {
  return buildSeo({
    site,
    siteUrl,
    path: '/about',
    title: `${about.seo?.title ?? about.title} · ${site.name}`,
    description: about.seo?.description ?? about.description,
    image: about.seo?.ogImage ?? site.defaultOgImage,
    ogType: 'website',
  });
}

export function notFoundSeo(site: Site): NotFoundSEO {
  return {
    title: `页面不存在 · ${site.name}`,
    description: '请求的页面不存在，请返回首页或文章归档。',
    robots: 'noindex,follow',
  };
}
