import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const worker = await readFile(new URL('sw.js', root), 'utf8');
const core = [...worker.match(/var CORE_ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const asset of core) await access(new URL(asset, root));
for (const page of ['index.html', '2048.html', 'board.html', 'about.html']) {
  const html = await readFile(new URL(page, root), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const path = match[1]; if (/^https?:/.test(path)) continue;
    await access(new URL(path, root));
    assert.ok(core.includes(path), `${page}: ${path} missing from offline cache`);
  }
}
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
assert.equal(manifest.orientation, 'any');
for (const icon of manifest.icons) await access(new URL(icon.src, root));
const storage = await readFile(new URL('js/local_storage_manager.js', root), 'utf8');
assert.ok(storage.includes('plain2048.bestScore')); assert.ok(storage.includes('plain2048.gameState'));
console.log(`${core.length} offline assets exist; page links, icons and 2048 storage verified.`);
