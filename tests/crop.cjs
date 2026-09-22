const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const artifacts = path.resolve(__dirname, '../.artifacts');
  await fs.mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const open = () => page.evaluate(() => {
      const source = document.createElement('canvas'); source.width = 120; source.height = 100;
      const ctx = source.getContext('2d');
      ctx.fillStyle = '#287baf'; ctx.fillRect(0, 0, 120, 100);
      ctx.fillStyle = '#ef6742'; ctx.fillRect(60, 0, 60, 100);
      window.cropResult = undefined;
      window.chooseCrop(source).then(result => { window.cropResult = result; });
    });
    const values = () => page.evaluate(() => Object.fromEntries(['x', 'y', 'w', 'h'].map(k => [k, Number(document.getElementById('crop-' + k).value)])));
    const fill = async rect => { for (const [k, v] of Object.entries(rect)) await page.locator('#crop-' + k).fill(String(v)); };
    // This fixture stays inside the source bounds during pointer tests.
    const screen = async (x, y) => {
      const box = await page.locator('#crop-canvas').boundingBox();
      return { x: box.x + (126 + x * 5.4) / 900 * box.width, y: box.y + (30 + y * 5.4) / 600 * box.height };
    };
    const drag = async (x, y, dx, dy) => {
      const start = await screen(x, y), end = await screen(x + dx, y + dy);
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 4 }); await page.mouse.up();
    };
    await open();
    assert.ok(await page.locator('#crop-new').isVisible());
    assert.equal(await page.locator('#crop-new').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await values(), { x: 0, y: 0, w: 120, h: 100 });
    await drag(0, 50, 5, 0);
    assert.deepEqual(await values(), { x: 5, y: 0, w: 115, h: 100 }, 'Default frame is immediately resizable');
    await page.locator('#crop-reset').click();
    await drag(20, 20, 80, 60);
    assert.deepEqual(await values(), { x: 20, y: 20, w: 80, h: 60 });
    await drag(23, 50, 10, 10);
    assert.deepEqual(await values(), { x: 20, y: 20, w: 80, h: 60 }, 'Safety band prevents starting a new frame');
    await drag(20, 50, -5, 0);
    assert.deepEqual(await values(), { x: 15, y: 20, w: 85, h: 60 });
    await drag(100, 50, 5, 0);
    assert.deepEqual(await values(), { x: 15, y: 20, w: 90, h: 60 });
    await drag(60, 20, 0, -5);
    assert.deepEqual(await values(), { x: 15, y: 15, w: 90, h: 65 });
    await drag(60, 80, 0, 5);
    assert.deepEqual(await values(), { x: 15, y: 15, w: 90, h: 70 });
    await drag(105, 85, 5, 5);
    assert.deepEqual(await values(), { x: 15, y: 15, w: 95, h: 75 });
    await page.keyboard.down('Alt'); await drag(50, 50, -5, -5); await page.keyboard.up('Alt');
    assert.deepEqual(await values(), { x: 10, y: 10, w: 95, h: 75 });
    const lensPixel = () => page.evaluate(() => Array.from(document.getElementById('crop-lens').getContext('2d').getImageData(80, 80, 1, 1).data));
    const left = await screen(30, 50); await page.mouse.move(left.x, left.y);
    assert.deepEqual(await lensPixel(), [40, 123, 175, 255]);
    const right = await screen(80, 50); await page.mouse.move(right.x, right.y);
    assert.deepEqual(await lensPixel(), [239, 103, 66, 255]);
    await page.screenshot({ path: path.join(artifacts, 'crop-desktop.png') });
    await fill({ x: -5, y: -7, w: 130, h: 114 });
    assert.deepEqual(await values(), { x: -5, y: -7, w: 130, h: 114 });
    for (const value of ['', '0', '-4', '1.5']) {
      await page.locator('#crop-w').fill(value);
      assert.equal(await page.locator('#crop-w').inputValue(), value);
      assert.ok(await page.locator('#crop-apply').isDisabled());
    }
    await fill({ w: 5000 });
    assert.equal((await values()).w, 5000);
    assert.equal(await page.locator('#crop-w').getAttribute('max'), null);
    assert.equal(await page.locator('#crop-x').getAttribute('min'), null);
    await fill({ w: 130 });
    await page.locator('#crop-apply').click();
    const output = await page.evaluate(() => {
      const c = window.cropResult, ctx = c.getContext('2d');
      const pixel = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
      return { w: c.width, h: c.height, outside: pixel(0, 0), first: pixel(5, 7), last: pixel(124, 106), end: pixel(129, 113) };
    });
    assert.deepEqual(output, { w: 130, h: 114, outside: [0, 0, 0, 0], first: [40, 123, 175, 255], last: [239, 103, 66, 255], end: [0, 0, 0, 0] });
    for (const kind of ['noisy-border', 'transparent-border', 'solid']) {
      await page.evaluate(kind => {
        const c = document.createElement('canvas'); c.width = 120; c.height = 100;
        const ctx = c.getContext('2d');
        if (kind === 'solid') { ctx.fillStyle = '#529178'; ctx.fillRect(0, 0, 120, 100); }
        else {
          if (kind === 'noisy-border') for (let y = 0; y < 100; y++) for (let x = 0; x < 120; x++) {
            const v = 230 + (x + y) % 8; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, y, 1, 1);
          }
          for (let y = 8; y < 92; y++) for (let x = 10; x < 110; x++) {
            ctx.fillStyle = (Math.floor(x / 10) + Math.floor(y / 10)) % 2 ? '#287baf' : '#ef6742'; ctx.fillRect(x, y, 1, 1);
          }
        }
        window.chooseCrop(c);
      }, kind);
      assert.deepEqual(await values(), kind === 'solid' ? { x: 0, y: 0, w: 120, h: 100 } : { x: 10, y: 8, w: 100, h: 84 }, kind);
      if (kind === 'noisy-border') await page.screenshot({ path: path.join(artifacts, 'crop-auto.png') });
      await page.locator('#crop-cancel').click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await open();
    await page.locator('#crop-reset').click();
    assert.deepEqual(await values(), { x: 0, y: 0, w: 120, h: 100 });
    assert.ok(await page.evaluate(() => {
      const d = document.getElementById('crop-dialog'), b = d.getBoundingClientRect();
      return b.left >= 0 && b.right <= innerWidth && d.scrollWidth <= d.clientWidth;
    }));
    await page.screenshot({ path: path.join(artifacts, 'crop-mobile.png') });
    await page.locator('#crop-cancel').click();
    assert.equal(await page.evaluate(() => window.cropResult), null);
    assert.deepEqual(errors, []);
    console.log('Crop passed: all four edges, corner, move, magnifier pixels, unrestricted inputs, transparent padding, reset, cancel, desktop/mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
