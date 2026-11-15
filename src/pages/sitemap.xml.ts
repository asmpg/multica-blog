import type { APIRoute } from 'astro';
import { getSitemapXml } from '../data/contract';

/**
 * sitemap 路由薄封装：XML 由内容层按公开路由清单生成（content-model §6），
 * 本文件只负责响应，不自行推断 URL 或 lastmod。
 */
export const GET: APIRoute = () =>
  new Response(getSitemapXml(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
