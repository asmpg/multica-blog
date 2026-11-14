import { Marked, Renderer, type Token } from 'marked';

const md = new Marked({ gfm: true });
import { Issues } from './errors';
import { validateAssetPath } from './validate';

const HEADING_ID_RE = /\s*\{#([a-z0-9]+(?:-[a-z0-9]+)*)\}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface MarkdownLink {
  href: string;
  field: string;
}

export interface ParsedMarkdown {
  html: string;
  headingIds: string[];
  links: MarkdownLink[];
  imageSrcs: string[];
}

function walk(tokens: Token[], visit: (token: Token) => void): void {
  for (const token of tokens) {
    visit(token);
    if ('tokens' in token && Array.isArray(token.tokens)) {
      walk(token.tokens, visit);
    }
    if (token.type === 'list') {
      for (const item of token.items) walk(item.tokens, visit);
    }
    if (token.type === 'table') {
      for (const cell of token.header) walk(cell.tokens, visit);
      for (const row of token.rows) {
        for (const cell of row) walk(cell.tokens, visit);
      }
    }
  }
}

function validateHref(href: string, file: string, field: string, issues: Issues): void {
  if (href.startsWith('#')) return;
  if (href.startsWith('/') && !href.startsWith('//')) return;
  if (href.startsWith('https://')) {
    try {
      const url = new URL(href);
      if (!url.hostname) throw new Error('missing host');
      return;
    } catch {
      issues.add(file, `链接不是合法的 HTTPS URL：${href}`, field);
      return;
    }
  }
  issues.add(file, `链接只允许 HTTPS 绝对 URL、本站以 / 开头的路径或当前文章锚点：${href}`, field);
}

export function parseMarkdown(
  source: string,
  file: string,
  field: string,
  publicDir: string,
  issues: Issues,
): ParsedMarkdown {
  const tokens = md.lexer(source);
  const headingIds: string[] = [];
  const links: MarkdownLink[] = [];
  const imageSrcs: string[] = [];

  walk(tokens, (token) => {
    switch (token.type) {
      case 'html':
        issues.add(file, '正文不允许原始 HTML 或脚本', field);
        break;
      case 'table':
        issues.add(file, '正文不支持表格扩展语法', field);
        break;
      case 'heading': {
        if (token.depth === 1) {
          issues.add(file, '正文不允许 H1，页面标题已是唯一 H1', field);
          break;
        }
        const match = HEADING_ID_RE.exec(token.text);
        if (!match) {
          issues.add(file, `正文 H${token.depth} 必须使用显式尾部 {#id}：${token.text}`, field);
          break;
        }
        const id = match[1]!;
        if (!SLUG_RE.test(id)) {
          issues.add(file, `标题 id 必须是小写 slug：${id}`, field);
          break;
        }
        if (id === 'main') {
          issues.add(file, '标题 id 不得为 main（预留给跳至正文）', field);
          break;
        }
        if (headingIds.includes(id)) {
          issues.add(file, `标题 id 在同一文章中重复：${id}`, field);
          break;
        }
        headingIds.push(id);
        break;
      }
      case 'link':
        links.push({ href: token.href, field });
        validateHref(token.href, file, field, issues);
        break;
      case 'image': {
        if (token.text.trim() === '') {
          issues.add(file, `正文图片必须有非空 alt：${token.href}`, field);
          break;
        }
        const src = validateAssetPath(token.href, file, field, publicDir, issues);
        if (src !== undefined) imageSrcs.push(src);
        break;
      }
      default:
        break;
    }
  });

  for (const link of links) {
    if (link.href.startsWith('#') && !headingIds.includes(link.href.slice(1))) {
      issues.add(file, `锚点链接指向本文不存在的标题：${link.href}`, field);
    }
  }

  const renderer = new Renderer();
  renderer.heading = function ({ tokens: inlineTokens, depth }) {
    const inner = this.parser.parseInline(inlineTokens);
    const match = HEADING_ID_RE.exec(inner);
    if (!match) return `<h${depth}>${inner}</h${depth}>\n`;
    return `<h${depth} id="${match[1]}">${inner.slice(0, match.index)}</h${depth}>\n`;
  };
  const html = md.parse(source, { renderer, async: false });

  return { html, headingIds, links, imageSrcs };
}
