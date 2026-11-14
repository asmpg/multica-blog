import { rmSync, readdirSync, rmdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { createSiteView } from './lib/site.ts';
import { normalizeSiteUrl } from './lib/url.ts';

// Astro copies public/ verbatim; remove content assets that no public page may reference.
function pruneContentAssets() {
  return {
    name: 'prune-content-assets',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const view = await createSiteView(process.cwd(), process.env.SITE_URL);
        const contentDir = fileURLToPath(new URL('./content/', dir));
        let removed = 0;
        const walk = (directory, relative) => {
          let entries;
          try {
            entries = readdirSync(directory);
          } catch {
            return;
          }
          for (const entry of entries) {
            const diskPath = join(directory, entry);
            const assetPath = `${relative}/${entry}`;
            if (statSync(diskPath).isDirectory()) {
              walk(diskPath, assetPath);
              try {
                rmdirSync(diskPath);
              } catch {
                // Directory still holds referenced assets.
              }
            } else if (!view.publicAssets.includes(assetPath)) {
              rmSync(diskPath);
              removed += 1;
            }
          }
        };
        walk(contentDir, '/content');
        logger.info(`pruned ${removed} unreferenced content asset(s)`);
      },
    },
  };
}

export default defineConfig({
  site: normalizeSiteUrl(process.env.SITE_URL),
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [pruneContentAssets()],
});
