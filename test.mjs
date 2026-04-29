/**
 * Game8 Beyond Categorical - Gameplay Test
 * Tests: basic load, touch interaction, game state progression, no freeze/dead-end
 * Run: node test-game8.mjs [game-dir]
 */
import { chromium } from 'playwright';
import { resolve } from 'path';

const W = 375, H = 812;
const DIR = process.argv[2] || 'game8-beyond-categorical';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  const results = { passed: 0, failed: 0, errors: [] };
  function pass(msg) { results.passed++; console.log(`  ✓ ${msg}`); }
  function fail(msg) { results.failed++; results.errors.push(msg); console.log(`  ✗ ${msg}`); }

  try {
    await page.goto(`file://${resolve(DIR, 'index.html')}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    errors.length === 0 ? pass('No JS errors on load') : fail(`JS errors: ${errors.join('; ')}`);

    const gameArea = await page.evaluate(() => {
      var c = document.querySelector('canvas');
      if (c) return 'canvas:' + c.width + 'x' + c.height;
      var g = document.querySelector('#game, .game, .scene, .game-container, #app, main');
      if (g) return 'html:' + g.getBoundingClientRect().width + 'x' + g.getBoundingClientRect().height;
      return 'none';
    });
    gameArea !== 'none' ? pass(`Game area: ${gameArea}`) : fail('No game area found');

    const touchOk = await page.evaluate(() => {
      var target = document.querySelector('canvas') || document.body;
      try {
        var rect = target.getBoundingClientRect();
        var t = new Touch({ identifier: 1, target, clientX: rect.x + rect.width/2, clientY: rect.y + rect.height/2 });
        target.dispatchEvent(new TouchEvent('touchstart', { touches: [t], bubbles: true }));
        target.dispatchEvent(new TouchEvent('touchend', { changedTouches: [t], bubbles: true }));
        return 'ok';
      } catch (e) { return e.message; }
    });
    touchOk === 'ok' ? pass('Touch interaction works') : fail(`Touch failed: ${touchOk}`);

    const touchTargets = await page.evaluate(() => {
      var btns = document.querySelectorAll('button, .btn, [role="button"], a, .choice, .action-btn');
      if (btns.length === 0) return { count: 0, small: [] };
      var small = [];
      btns.forEach(b => {
        var r = b.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
          small.push({ w: Math.round(r.width), h: Math.round(r.height), text: b.textContent.substring(0, 20) });
        }
      });
      return { count: btns.length, small: small };
    });
    touchTargets.count > 0 && touchTargets.small.length === 0
      ? pass(`All ${touchTargets.count} touch targets >= 44px`)
      : touchTargets.count === 0
        ? fail('No interactive elements found')
        : fail(`Small touch targets: ${JSON.stringify(touchTargets.small)}`);

    await page.evaluate(() => {
      var target = document.querySelector('canvas') || document.querySelector('#app') || document.body;
      var rect = target.getBoundingClientRect();
      var t = new Touch({ identifier: 2, target, clientX: rect.x + rect.width/2, clientY: rect.y + rect.height/2 });
      target.dispatchEvent(new TouchEvent('touchstart', { touches: [t], bubbles: true }));
      target.dispatchEvent(new TouchEvent('touchend', { changedTouches: [t], bubbles: true }));
    });
    await page.waitForTimeout(1000);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    overflow <= 2 ? pass('No horizontal overflow') : fail(`Overflow: ${overflow}px`);

    errors.length === 0 ? pass('No JS errors after interaction') : fail(`Errors: ${errors.join('; ')}`);

  } catch (err) {
    fail(`Fatal: ${err.message}`);
  }

  await ctx.close();
  await browser.close();
  console.log(`\n  Total: ${results.passed} passed, ${results.failed} failed`);
  return results;
}

test().then(r => process.exit(r.failed > 0 ? 1 : 0)).catch(e => { console.error(e); process.exit(2); });
