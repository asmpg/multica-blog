import type { APIRoute } from 'astro';
import { getRssXml } from '../data/contract';

/**
 * RSS 路由薄封装：XML 由内容层生成（content-model §6），本文件只负责响应。
 * 过滤、排序、canonical、pubDate、lastBuildDate 均在 /lib，不在此重复实现。
 */
export const GET: APIRoute = () =>
  new Response(getRssXml(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
