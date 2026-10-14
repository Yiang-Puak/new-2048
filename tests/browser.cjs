// Optional: install Playwright, then run node tests/browser.cjs with the local preview running.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173/new-2048/';
const out = path.join(root, 'test-results'); fs.mkdirSync(out, { recursive: true });
const cell = (page, x, y) => page.locator(`[data-x="${x}"][data-y="${y}"]`);
const state = (page, mode) => page.evaluate(m => JSON.parse(localStorage.getItem(`idle-games.v1.${m}`)).state, mode);
const launch = process.env.TEST_BROWSER === 'webkit' ? () => webkit.launch()
  : () => chromium.launch(process.env.TEST_BROWSER_PATH ? { executablePath: process.env.TEST_BROWSER_PATH } : {});

async function run() {
  const browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage(), errors = [], bad = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await page.goto(base);
    assert.equal(await page.locator('.game-card').count(), 5);
    for (const [width, height, label] of [[1440, 1000, 'desktop'], [820, 1180, 'ipad'], [390, 844, 'phone']]) {
      await page.setViewportSize({ width, height });
      const rects = await page.locator('.game-card').evaluateAll(cards => cards.map(card => {
        const top = card.getBoundingClientRect().top;
        const art = card.querySelector('.card-art').getBoundingClientRect();
        return { top, title: card.querySelector('h2').getBoundingClientRect().top,
          description: card.querySelector('p').getBoundingClientRect().top,
          meta: card.querySelector('.card-meta').getBoundingClientRect().top, art: art.top + art.height / 2 };
      }));
      for (const a of rects) for (const b of rects) if (Math.abs(a.top - b.top) < 1) {
        for (const key of ['title', 'description', 'meta', 'art']) assert.ok(Math.abs(a[key] - b[key]) < 1, `${label} ${key} not aligned`);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' overflow');
      await page.screenshot({ path: path.join(out, `home-${label}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.screenshot({ path: path.join(out, 'home-ipad.png'), fullPage: true });
    await page.evaluate(() => localStorage.setItem('plain2048.bestScore', '4096'));
    await page.goto(base + '2048.html');
    await page.waitForSelector('.tile'); assert.equal((await page.locator('.best-container').innerText()).trim(), '4096');
    await page.locator('.game-container').dispatchEvent('touchstart', { touches: [{ identifier: 0, clientX: 200, clientY: 300 }] });
    await page.locator('.game-container').dispatchEvent('touchend', { changedTouches: [{ identifier: 0, clientX: 310, clientY: 300 }] });
    await page.goto(base + 'board.html?game=xiangqi');
    await page.waitForSelector('[data-x]');
    assert.equal(await page.locator('.piece-label').count(), 32);
    await cell(page, 0, 6).tap(); await cell(page, 0, 5).tap();
    assert.equal((await state(page, 'xiangqi')).ply, 1);
    await cell(page, 0, 3).tap(); await cell(page, 0, 4).tap();
    await page.reload(); await page.waitForSelector('[data-x]');
    assert.equal((await state(page, 'xiangqi')).ply, 2);
    await page.locator('#flip').tap();
    const screenCell = await cell(page, 0, 4).boundingBox(), screenBoard = await page.locator('#board').boundingBox();
    assert.ok(screenCell.x > screenBoard.x + screenBoard.width / 2);
    await page.locator('#undo').tap(); assert.equal((await state(page, 'xiangqi')).ply, 1);
    await page.screenshot({ path: path.join(out, 'xiangqi-ipad.png'), fullPage: true });
    await page.locator('#new-game').tap(); await page.locator('#setup').selectOption('red-handicap'); await page.locator('#confirm-ok').tap();
    assert.equal((await state(page, 'xiangqi')).board[9][1], null);
    await page.goto(base + 'board.html?game=gomoku'); await page.waitForSelector('[data-x]');
    for (let x = 0; x < 4; x++) { await cell(page, x, 0).tap(); await cell(page, x, 2).tap(); }
    await cell(page, 4, 0).tap(); assert.equal((await state(page, 'gomoku')).result, 'black');
    await page.locator('#undo').tap(); assert.equal((await state(page, 'gomoku')).result, null);
    await page.locator('#draw').tap(); await page.locator('#confirm-cancel').tap(); assert.equal((await state(page, 'gomoku')).result, null);
    await page.locator('#resign').tap(); await page.locator('#confirm-ok').tap(); assert.equal((await state(page, 'gomoku')).result, 'white');
    await page.goto(base + 'board.html?game=banqi'); await page.waitForSelector('[data-x]');
    assert.equal(await page.locator('.covered-label').count(), 32);
    assert.equal(await cell(page, 0, 0).getAttribute('aria-label'), '1列1行，未翻开的棋子');
    await cell(page, 0, 0).tap(); assert.ok((await state(page, 'banqi')).firstSide);
    assert.ok((await page.locator('#bottom-player').innerText()).includes('玩家一'));
    await page.locator('#undo').tap(); await page.locator('#confirm-ok').tap(); assert.equal((await state(page, 'banqi')).firstSide, null);
    await page.screenshot({ path: path.join(out, 'banqi-ipad.png'), fullPage: true });
    await page.goto(base + 'board.html?game=jieqi'); await page.waitForSelector('[data-x]');
    assert.equal(await page.locator('.covered-label').count(), 30);
    await cell(page, 0, 6).tap(); await cell(page, 0, 5).tap();
    assert.equal((await state(page, 'jieqi')).board[5][0].covered, false);
    await page.reload(); await page.waitForSelector('[data-x]'); assert.equal((await state(page, 'jieqi')).ply, 1);
    await page.locator('#undo').tap(); await page.locator('#confirm-ok').tap(); assert.equal((await state(page, 'jieqi')).board[6][0].covered, true);
    await page.setViewportSize({ width: 390, height: 844 });
    await cell(page, 0, 6).tap(); await cell(page, 0, 5).tap(); assert.equal((await state(page, 'jieqi')).ply, 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'jieqi-phone.png'), fullPage: true });
    await page.locator('#rules-button').tap(); assert.equal(await page.locator('#rules-dialog').evaluate(e => e.open), true);
    await page.locator('#rules-dialog .primary-button').tap();
    await page.setViewportSize({ width: 1180, height: 820 });
    await cell(page, 0, 3).tap(); await cell(page, 0, 4).tap();
    assert.equal((await state(page, 'jieqi')).ply, 2);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Arrow keys move focus in visual direction, including a flipped board.
    await cell(page, 0, 0).focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.x), '1');
    await page.locator('#flip').tap(); await cell(page, 1, 0).focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.x), '0');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    });
    const webkitWindows = process.env.TEST_BROWSER === 'webkit' && process.platform === 'win32';
    // Windows WebKit's offline emulation fails before SW dispatch. Verify the cached
    // responses directly here; Chromium below verifies real offline navigation.
    if (webkitWindows) {
      assert.equal(await page.evaluate(async () => {
        const names = await caches.keys();
        const name = names.find(n => n.startsWith('idle-games-'));
        const cache = await caches.open(name);
        for (const path of ['', '2048.html', 'board.html', 'about.html', 'js/games/app.mjs']) {
          const response = await cache.match(new URL(path, new URL('./', location.href)));
          if (!response?.ok || !(await response.text()).length) return false;
        }
        return true;
      }), true);
    } else await context.setOffline(true);
    for (const route of ['', '2048.html', 'board.html?game=xiangqi', 'board.html?game=gomoku', 'board.html?game=banqi', 'board.html?game=jieqi', 'about.html']) {
      const response = await page.goto(base + route);
      if (!webkitWindows) assert.equal(response.fromServiceWorker(), true);
      if (route.startsWith('board')) await page.waitForSelector('[data-x]');
      assert.ok((await page.locator('body').innerText()).length > 30);
    }
    assert.deepEqual(errors, []); assert.deepEqual(bad, []);
    await context.close();
    console.log('Touch, resize/flip, all games, restore/undo, dialogs, keyboard and 2048 passed.');
    console.log(webkitWindows ? 'Windows WebKit: offline cache contents passed; offline navigation emulation is unsupported.' : 'Offline navigation across every game passed.');
    if (!process.env.TEST_BASE_URL) await migration(browser);
  } finally { await browser.close(); }
}

async function migration(browser) {
  // Serve the previous Git commit, then the new files, without changing the checkout.
  let upgraded = false;
  const old = new Map();
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const server = http.createServer((req, res) => {
    try {
      const name = new URL(req.url, 'http://localhost').pathname.replace(/^\/new-2048\//, '') || 'index.html';
      if (name.includes('..')) throw new Error('Bad path');
      let bytes;
      if (upgraded) bytes = fs.readFileSync(path.join(root, name));
      else {
        if (!old.has(name)) old.set(name, execFileSync('git', ['show', `79a74f97d1297d3190f5f45eaf99003c91d9604a:${name}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }));
        bytes = old.get(name);
      }
      res.writeHead(200, { 'Content-Type': mime[path.extname(name)] || 'text/plain', 'Cache-Control': 'no-store' }).end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(4174, '127.0.0.1', r));
  const context = await browser.newContext();
  try {
    const page = await context.newPage(), url = 'http://127.0.0.1:4174/new-2048/';
    await page.goto(url); await page.waitForSelector('.tile');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      localStorage.setItem('plain2048.bestScore', '8192');
    });
    const before = await page.evaluate(() => localStorage.getItem('plain2048.gameState'));
    upgraded = true;
    await page.evaluate(async () => {
      const changed = new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); await changed;
    });
    await page.goto(url); assert.equal(await page.locator('.game-card').count(), 5);
    await page.goto(url + '2048.html'); await page.waitForSelector('.tile');
    assert.equal((await page.locator('.best-container').innerText()).trim(), '8192');
    assert.equal(await page.evaluate(() => localStorage.getItem('plain2048.gameState')), before);
    const webkitWindows = process.env.TEST_BROWSER === 'webkit' && process.platform === 'win32';
    if (!webkitWindows) await context.setOffline(true);
    const response = await page.goto(url + 'board.html?game=jieqi'); if (!webkitWindows) assert.equal(response.fromServiceWorker(), true); await page.waitForSelector('[data-x]');
    console.log('Upgrade from old 2048 cache preserves best score and exact game state; new board works' + (webkitWindows ? '.' : ' offline.'));
  } finally { await context.close(); await new Promise(r => server.close(r)); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
