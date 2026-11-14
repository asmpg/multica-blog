export const PAGE_SIZE = 6;

export function postPath(slug: string): string {
  return `/posts/${slug}`;
}

export function tagPath(slug: string): string {
  return `/tags/${slug}`;
}

export function archivePath(page: number): string {
  return page === 1 ? '/archive' : `/archive/page/${page}`;
}

export function canonicalUrl(siteUrl: string, path: string): string {
  return `${siteUrl}${path}`;
}

export function absoluteAssetUrl(siteUrl: string, src: string): string {
  return `${siteUrl}${src}`;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function normalizeSiteUrl(input: string | undefined): string {
  const raw = input?.trim() || 'http://localhost:4321';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`SITE_URL 不是合法 URL：${raw}`);
  }
  if (url.username || url.password) {
    throw new Error('SITE_URL 不得包含 userinfo');
  }
  if (url.search || url.hash) {
    throw new Error('SITE_URL 不得包含 query 或 fragment');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('SITE_URL 不支持子路径部署，不得包含路径');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error(`SITE_URL 必须是 HTTPS origin（本地开发可用 http://localhost）：${raw}`);
  }
  return url.origin;
}
