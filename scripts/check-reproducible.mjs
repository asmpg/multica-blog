import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runBuild() {
  rmSync(dist, { recursive: true, force: true });
  rmSync(join(root, 'node_modules', '.astro'), { recursive: true, force: true });
  rmSync(join(root, '.astro'), { recursive: true, force: true });
  execFileSync(npm, ['run', 'build'], { cwd: root, stdio: 'inherit' });
}

function manifest(directory) {
  const files = [];
  const walk = (current, relative) => {
    for (const name of readdirSync(current).sort()) {
      const diskPath = join(current, name);
      const relativePath = relative ? `${relative}/${name}` : name;
      if (statSync(diskPath).isDirectory()) {
        walk(diskPath, relativePath);
      } else {
        files.push(relativePath);
      }
    }
  };
  walk(directory, '');
  files.sort();
  return new Map(
    files.map((file) => [file, createHash('sha256').update(readFileSync(join(directory, file))).digest('hex')]),
  );
}

const snapshotDir = mkdtempSync(join(tmpdir(), 'blog-reproducible-'));

try {
  runBuild();
  const first = manifest(dist);
  if (first.size === 0) {
    throw new Error('dist/ 为空，无法验证可复现性');
  }
  writeFileSync(join(snapshotDir, 'manifest.json'), JSON.stringify([...first], null, 2));

  runBuild();
  const second = manifest(dist);

  const missing = [...first.keys()].filter((file) => !second.has(file));
  const extra = [...second.keys()].filter((file) => !first.has(file));
  const changed = [...first.entries()]
    .filter(([file, hash]) => second.has(file) && second.get(file) !== hash)
    .map(([file]) => file);

  if (missing.length || extra.length || changed.length) {
    console.error('构建不可复现：');
    if (missing.length) console.error(`  第二次构建缺少：${missing.join(', ')}`);
    if (extra.length) console.error(`  第二次构建多出：${extra.join(', ')}`);
    if (changed.length) console.error(`  内容不同：${changed.join(', ')}`);
    process.exit(1);
  }

  console.log(`可复现性检查通过：${first.size} 个文件，两次构建 SHA-256 完全一致。`);
} finally {
  rmSync(snapshotDir, { recursive: true, force: true });
}
