const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const artifacts = path.resolve(__dirname, '../.artifacts'); await fs.mkdir(artifacts, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.setDefaultTimeout(7000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const fixtures = await page.evaluate(() => {
      const make = alphas => { const c = document.createElement('canvas'); c.width = 60; c.height = 20;
        const ctx = c.getContext('2d'); alphas.forEach((a, i) => { ctx.fillStyle = `rgba(0,0,255,${a})`; ctx.fillRect(i * 20, 0, 20, 20); }); return c.toDataURL(); };
      return { mixed: make([1, .5, 0]), opaque: make([1,1,1]), empty: make([0,0,0]) };
    });
    const save = async name => {
      const event = page.waitForEvent('download'); await page.locator('#save-project').click();
      const download = await event, file = path.join(artifacts, name + '.pixel.json'); await download.saveAs(file);
      return JSON.parse(await fs.readFile(file, 'utf8'));
    };
    const decode = async url => page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      return [10,30,50].map(x => Array.from(ctx.getImageData(x, 10, 1, 1).data)); }, url);
    for (const treatment of ['keep', 'flatten', 'solid']) {
      await page.locator('#image-input').setInputFiles({ name: 'alpha.png', mimeType: 'image/png', buffer: Buffer.from(fixtures.mixed.split(',')[1], 'base64') });
      await page.locator('#alpha-dialog[open]').waitFor();
      await page.locator(`[name=alpha-treatment][value=${treatment}]`).check();
      if (treatment === 'flatten') await page.screenshot({ path: path.join(artifacts, 'alpha-options.png') });
      await page.locator('#alpha-dialog button[value=continue]').click();
      await page.locator('#crop-skip').click(); await page.waitForFunction(() => document.body.dataset.step === '2');
      const data = await decode((await save('alpha-' + treatment)).image);
      assert.deepEqual(data.map(p => p[3]), treatment === 'keep' ? [255,128,0] : treatment === 'solid' ? [255,255,0] : [255,255,255]);
      if (treatment === 'flatten') { assert.deepEqual(data[2], [255,255,255,255]); assert.ok(data[1][0] >= 126 && data[1][0] <= 128); }
    }
    for (const name of ['opaque', 'empty']) {
      await page.locator('#image-input').setInputFiles({ name: name + '.png', mimeType: 'image/png', buffer: Buffer.from(fixtures[name].split(',')[1], 'base64') });
      await page.locator('#crop-dialog[open]').waitFor(); assert.ok(!await page.locator('#alpha-dialog').isVisible());
      await page.locator('#crop-cancel').click();
    }
    const project = { version: 1, name: '单格手动取色', image: fixtures.mixed, width: 60, height: 20,
      xs: [0,20,40,60], ys: [0,20], samples: {}, colors: {}, cellModes: {}, threshold:16, edgeWeight:.35, hasGrid:true };
    await page.locator('#project-input').setInputFiles({ name:'picker.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(project)) });
    await page.waitForFunction(() => document.body.dataset.step === '3'); await page.locator('[data-step="4"]').click();
    assert.equal(await page.locator('[data-tool=eyedropper]').count(), 0);
    assert.equal(await page.locator('.app-header #filename, .app-header #image-size, .app-header #dirty-state').count(), 3);
    assert.equal(await page.locator('.canvas-toolbar #undo, .canvas-toolbar #redo').count(), 2);
    const originalZoom = await page.locator('#zoom-value').textContent();
    await page.locator('#source-canvas').click({ position: { x: 25, y: 20 } });
    await page.locator('[data-cell-color-mode=manual]').click();
    assert.match(await page.locator('#cell-color-hint').textContent(), /点击原图/);
    const position = await page.evaluate(() => { const c = document.getElementById('source-canvas').getBoundingClientRect(), v = document.getElementById('canvas-viewport').getBoundingClientRect();
      return { x: c.x + c.width / 6, y: c.y + c.height / 2, widthRatio: c.width / 3 / v.width, heightRatio: c.height / v.height }; });
    assert.ok(Math.abs(Math.max(position.widthRatio, position.heightRatio) - .25) < .02);
    await page.screenshot({ path: path.join(artifacts, 'manual-picker.png') });
    await page.mouse.click(position.x, position.y);
    assert.doesNotMatch(await page.locator('#cell-color-hint').textContent(), /点击原图/);
    assert.equal(await page.locator('[data-cell-color-mode=manual]').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#zoom-value').textContent(), originalZoom);
    const picked = await save('picked'); assert.deepEqual(picked.colors['0,0'], [0,0,255,255]);
    await page.locator('#undo').click(); assert.equal(await page.locator('#manual-count').textContent(), '0 格');
    await page.locator('#redo').click(); assert.equal(await page.locator('#manual-count').textContent(), '1 格');
    await page.locator('#source-canvas').click({ position: { x: 25, y:20 } });
    await page.locator('[data-cell-color-mode=manual]').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#zoom-value').textContent(), originalZoom);
    await page.setViewportSize({ width:390, height:844 }); await page.locator('#fit').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(artifacts, 'picker-header-mobile.png'), fullPage:true });
    assert.deepEqual(errors, []);
    console.log('Alpha/picker passed: keep/flatten/solid, opaque/empty bypass, isolated cell pick, zoom/exit/cancel, undo/redo, header and mobile layout.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
