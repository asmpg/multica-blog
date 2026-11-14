/**
 * 页面数据入口 —— 薄适配层，不改数据形状、不重新实现任何规则。
 *
 * 数据来自 Dev1 的 src/server/content.ts（content-model §8「页面消费契约」）。
 * 本文件只做两件事：
 *   1. 把 src/server 的导出按页面用到的名字转出；
 *   2. 提供纯展示用的日期格式化。
 *
 * 过滤、排序、分页、URL、SEO 派生、XML 生成全部在 /lib 与 /src/server，
 * 页面与组件不重复实现（ADR 0001 §5.1）。
 */

import { about, archivePages, home, notFound, site, siteUrl, tagPages } from '../server/content';

export type {
  About,
  ArchivePage,
  Author,
  Home,
  Image,
  NotFoundSEO,
  PageSEO,
  PublicPostDetail,
  PublicPostSummary,
  PublicTag,
  PublicTagRef as TagRef,
  Site,
  TagPage,
} from '../../lib/types';

export const getSite = () => site;
export const getSiteOrigin = () => siteUrl;
export const getHome = () => home;
export const getAbout = () => about;
export const getArchivePages = () => archivePages;
export const getTagPages = () => tagPages;
export const getNotFoundSeo = () => notFound;

export { getPost, getRssXml, getSitemapXml } from '../server/content';

/** 日期展示格式 YYYY.MM.DD；`<time datetime>` 仍用原始的 YYYY-MM-DD。 */
export function formatDisplayDate(isoDate: string): string {
  return isoDate.replaceAll('-', '.');
}
