export interface Image {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Author {
  id: string;
  name: string;
  bio?: string;
  avatar?: Image;
  url?: string;
}

export interface Tag {
  slug: string;
  name: string;
  description?: string;
}

export interface Category {
  slug: string;
  name: string;
  description?: string;
}

export interface Series {
  slug: string;
  title: string;
  description?: string;
}

export interface Site {
  name: string;
  description: string;
  language: 'zh-CN';
  defaultAuthorId: string;
  defaultOgImage: Image;
}

export interface SeoOverride {
  title?: string;
  description?: string;
  ogImage?: Image;
}

export type PostStatus = 'draft' | 'published' | 'archived';

export interface PostSeriesRef {
  slug: string;
  order: number;
}

export interface PostSource {
  slug: string;
  title: string;
  excerpt: string;
  status: PostStatus;
  publishedAt?: string;
  updatedAt?: string;
  authorId: string;
  tagSlugs: string[];
  categorySlug?: string;
  series?: PostSeriesRef;
  cover?: Image;
  seo?: SeoOverride;
  body: string;
  bodyHtml: string;
  headingIds: string[];
  filePath: string;
}

export interface AboutSource {
  title: string;
  description: string;
  authorId: string;
  seo?: SeoOverride;
  body: string;
  bodyHtml: string;
  headingIds: string[];
  filePath: string;
}

export interface ContentDataset {
  root: string;
  site: Site;
  authors: Author[];
  tags: Tag[];
  categories: Category[];
  series: Series[];
  posts: PostSource[];
  about: AboutSource;
}

export interface PageSEO {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageAlt: string;
  ogImageWidth: number;
  ogImageHeight: number;
  ogType: 'website' | 'article';
  language: 'zh-CN';
}

export interface PublicAuthorRef {
  id: string;
  name: string;
  url?: string;
}

export interface PublicTagRef {
  slug: string;
  name: string;
  path: string;
}

export interface PublicPostSummary {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt?: string;
  path: string;
  canonical: string;
  author: PublicAuthorRef;
  tags: PublicTagRef[];
  cover?: Image;
}

export interface PublicPostDetail extends PublicPostSummary {
  body: string;
  seo: PageSEO;
}

export interface Home {
  posts: PublicPostSummary[];
  totalPublished: number;
  seo: PageSEO;
}

export interface ArchivePage {
  posts: PublicPostSummary[];
  page: number;
  pageSize: 6;
  totalItems: number;
  totalPages: number;
  path: string;
  previousPath?: string;
  nextPath?: string;
  seo: PageSEO;
}

export interface PublicTag {
  slug: string;
  name: string;
  description?: string;
  path: string;
}

export interface TagPage {
  tag: PublicTag;
  posts: PublicPostSummary[];
  totalItems: number;
  seo: PageSEO;
}

export interface About {
  title: string;
  description: string;
  author: PublicAuthorRef & { avatar?: Image };
  body: string;
  seo: PageSEO;
}

export interface NotFoundSEO {
  title: string;
  description: string;
  robots: 'noindex,follow';
}

export type PublicRouteKind = 'home' | 'post' | 'archive' | 'tag' | 'about';

export interface PublicRoute {
  kind: PublicRouteKind;
  path: string;
  canonical: string;
  seo: PageSEO;
}

export interface SiteView {
  site: Site;
  siteUrl: string;
  home: Home;
  about: About;
  posts: PublicPostDetail[];
  postBySlug: Map<string, PublicPostDetail>;
  archivePages: ArchivePage[];
  tagPages: TagPage[];
  routes: PublicRoute[];
  routeByPath: Map<string, PublicRoute>;
  rssXml: string;
  sitemapXml: string;
  notFound: NotFoundSEO;
  publicAssets: string[];
}
