import { createSiteView } from '../../lib/site';
import type { SiteView } from '../../lib/types';

const view: SiteView = await createSiteView(process.cwd(), process.env.SITE_URL);

export const site = view.site;
export const siteUrl = view.siteUrl;
export const home = view.home;
export const about = view.about;
export const posts = view.posts;
export const archivePages = view.archivePages;
export const tagPages = view.tagPages;
export const routes = view.routes;
export const notFound = view.notFound;

export function getPost(slug: string) {
  return view.postBySlug.get(slug) ?? null;
}

export function getArchivePage(page: number) {
  return view.archivePages.find((entry) => entry.page === page) ?? null;
}

export function getTagPage(slug: string) {
  return view.tagPages.find((entry) => entry.tag.slug === slug) ?? null;
}

export function getRoute(path: string) {
  return view.routeByPath.get(path) ?? null;
}

export function getRssXml(): string {
  return view.rssXml;
}

export function getSitemapXml(): string {
  return view.sitemapXml;
}

export function getPublicAssets(): string[] {
  return view.publicAssets;
}
