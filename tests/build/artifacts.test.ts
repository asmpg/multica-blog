import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSiteView } from '../../lib/site';

const root = process.cwd();
const dist = join(root, 'dist');
const view = await createSiteView(root);

function listFiles(directory: string, prefix = ''): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const name of readdirSync(directory)) {
    const diskPath = join(directory, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (statSync(diskPath).isDirectory()) files.push(...listFiles(diskPath, relative));
    else files.push(relative);
  }
  return files;
}

function routeFile(path: string): string {
  if (path === '/') return 'index.html';
  return `${path.slice(1)}.html`;
}

describe.skipIf(!existsSync(dist))('构建产物', () => {
  it('内容资源只保留公开引用的文件', () => {
    const files = listFiles(join(dist, 'content')).map((file) => `/content/${file}`);
    expect(files.sort()).toEqual([...view.publicAssets].sort());
  });

  it('仅草稿使用的图片不进入 dist', () => {
    expect(existsSync(join(dist, 'content/draft-editorial-workflow/cover.png'))).toBe(false);
  });

  const htmlFiles = listFiles(dist).filter((file) => file.endsWith('.html'));
  describe.skipIf(htmlFiles.length === 0)('HTML 页面与元数据', () => {
    for (const route of view.routes) {
      it(`${route.path} 存在且含 canonical 与 title`, () => {
        const file = join(dist, routeFile(route.path));
        expect(existsSync(file)).toBe(true);
        const html = readFileSync(file, 'utf8');
        expect(html).toContain(`<link rel="canonical" href="${route.seo.canonical}"`);
        expect(html).toContain(route.seo.title);
        expect(html).toContain(route.seo.description);
      });
    }

    it('公开产物不包含草稿内容', () => {
      for (const file of listFiles(dist)) {
        if (!/\.(html|xml|js|json)$/.test(file)) continue;
        const text = readFileSync(join(dist, file), 'utf8');
        expect(text).not.toContain('编辑流程草稿');
        expect(text).not.toContain('draft-editorial-workflow');
      }
    });

    it('草稿文章路由不存在', () => {
      expect(existsSync(join(dist, 'posts/draft-editorial-workflow.html'))).toBe(false);
    });
  });
});
