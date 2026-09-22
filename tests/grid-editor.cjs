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
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const image = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 120; c.height = 100;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#518b76'; ctx.fillRect(0, 0, 120, 100); return c.toDataURL();
    });
    const project = { version: 1, name: 'grid-editor', image, width: 120, height: 100, xs: [0, 20, 40, 60, 80, 100, 120], ys: [0, 20, 40, 60, 80, 100], samples: {}, colors: { '0,0': [255, 0, 0, 255] }, threshold: 16, edgeWeight: 0.35, hasGrid: true };
    await page.locator('#project-input').setInputFiles({ name: 'grid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await page.waitForFunction(() => document.body.dataset.step === '3');
    assert.equal(await page.locator('#grid-geometry').getAttribute('open'), null);
    assert.ok(await page.locator('.editor #merge-lines').isVisible());
    assert.ok(await page.locator('.editor #add-line').isVisible());
    const top = await page.locator('#refine-grid').boundingBox(), issue = await page.locator('#next-grid-issue').boundingBox();
    assert.ok(top.y < issue.y && top.height >= 44);
    await page.locator('#refine-grid').click();
    await page.waitForFunction(() => !document.getElementById('refine-grid').disabled);
    assert.match(await page.locator('#refine-status').textContent(), /已达到当前最优状态/);
    assert.ok(await page.locator('#refine-check').isVisible());
    await page.locator('#snap-gradient').uncheck();
    const handle = (axis, side, index = 1) => page.locator(`.grid-handle[data-axis="${axis}"][data-side="${side}"][data-index="${index}"]`);
    const pos = async (x, y) => {
      const box = await page.locator('#source-canvas').boundingBox();
      return { x: box.x + x / 120 * box.width, y: box.y + y / 100 * box.height };
    };
    const saved = async name => {
      const event = page.waitForEvent('download'); await page.locator('#save-project').click();
      const download = await event, filename = path.join(artifacts, name + '.pixel.json'); await download.saveAs(filename);
      return JSON.parse(await fs.readFile(filename, 'utf8'));
    };
    // Both ends of both axes drag the same line, without selecting it on release.
    for (const [axis, side] of [['x', 'top'], ['x', 'bottom'], ['y', 'left'], ['y', 'right']]) {
      const box = await handle(axis, side).boundingBox(), c = await page.locator('#source-canvas').boundingBox();
      const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
      const dx = axis === 'x' ? 5 * c.width / 120 : 0, dy = axis === 'y' ? 5 * c.height / 100 : 0;
      await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + dx, sy + dy, { steps: 5 });
      await page.waitForFunction(() => document.querySelectorAll('.grid-handle.dragging').length === 2);
      const color = await page.evaluate(axis => Array.from(document.getElementById('source-canvas').getContext('2d').getImageData(axis === 'x' ? 25 : 10, axis === 'x' ? 10 : 25, 1, 1).data), axis);
      assert.ok(color[2] > color[0], 'Dragging line is highlighted blue');
      if (side === 'top') await page.screenshot({ path: path.join(artifacts, 'grid-handle-drag.png') });
      await page.mouse.up();
      assert.equal(await page.locator('.grid-handle.dragging').count(), 0);
      const changed = await saved('grid-drag-' + side);
      assert.equal(changed[axis === 'x' ? 'xs' : 'ys'][1], 25);
      assert.equal(changed.image, image);
      await page.locator('#undo').click();
      const restoredBox = await handle(axis, side).boundingBox();
      assert.ok(Math.abs(restoredBox.x - box.x) < 1 && Math.abs(restoredBox.y - box.y) < 1);
    }
    await handle('x', 'top', 1).click(); await handle('x', 'top', 3).click();
    assert.equal(await page.locator('.grid-handle.selected[data-side=top]').count(), 3);
    await page.locator('#merge-lines').click(); assert.equal(await page.locator('#cols').inputValue(), '4');
    await page.locator('#undo').click();
    for (const axis of ['x', 'y']) {
      await page.locator('#add-line').click();
      await page.locator(`[name=line-direction][value=${axis}]`).check();
      const p = await pos(10, 10); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y);
      const result = await saved('grid-added-' + axis);
      assert.ok(result[axis === 'x' ? 'xs' : 'ys'].includes(10));
      assert.equal(result.image, image);
      assert.deepEqual(result.colors['0,0'], [255, 0, 0, 255]);
      assert.deepEqual(result.colors[axis === 'x' ? '1,0' : '0,1'], [255, 0, 0, 255]);
      assert.equal(await page.locator('#add-line').getAttribute('aria-pressed'), 'false');
      await page.locator('#undo').click();
    }
    await page.locator('#add-line').click();
    const existing = await pos(20, 20); await page.mouse.click(existing.x, existing.y);
    assert.equal(await page.locator('#rows').inputValue(), '5');
    assert.equal(await page.locator('#cols').inputValue(), '6');
    assert.equal(await page.locator('#add-line').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('#add-line-controls').isHidden());
    await page.locator('#cols').fill('3'); await page.locator('#rows').fill('2');
    await page.locator('#rebuild').click();
    assert.equal(await page.locator('#confirm-dialog').getAttribute('role'), 'alertdialog');
    assert.match(await page.locator('#confirm-title').textContent(), /警告/);
    assert.ok(await page.locator('#confirm-warning-icon').isVisible());
    await page.screenshot({ path: path.join(artifacts, 'grid-rebuild-warning.png') });
    await page.locator('#confirm-dialog [value=cancel]').click();
    await page.waitForFunction(() => document.getElementById('cols').value === '6');
    assert.equal(await page.locator('#cols').inputValue(), '6');
    await page.locator('#cols').fill('3'); await page.locator('#rows').fill('2'); await page.locator('#rebuild').click();
    await page.locator('#confirm-dialog [value=confirm]').click();
    await page.waitForFunction(() => document.getElementById('grid-dimensions').textContent === '3 列 × 2 行');
    const rebuilt = await saved('grid-rebuilt');
    assert.deepEqual(rebuilt.xs, [0, 40, 80, 120]); assert.deepEqual(rebuilt.colors, {});
    await page.locator('#undo').click();
    await page.locator('#grid-geometry summary').click();
    for (const id of ['pitch-x', 'pitch-y', 'origin-x', 'origin-y']) {
      await page.locator(`[data-help=${id}]`).click(); assert.ok(await page.locator('#parameter-help-dialog').isVisible());
      await page.locator('#parameter-help-dialog button').click();
    }
    await page.locator('#grid-geometry summary').click();
    await page.locator('.settings').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, 'grid-editor-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#fit').click();
    await page.locator('#add-line').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(artifacts, 'grid-editor-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Grid editor passed: optimal status, all endpoint drags, merge, manual line insertion, undo, warning rebuild, geometry help and responsive layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
