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
    const fixture = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 240; c.height = 180;
      const ctx = c.getContext('2d');
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#de6b45' : '#2e81b9'; ctx.fillRect(x * 20, y * 15, 20, 15);
      }
      window.detectionFixture = ctx.getImageData(0, 0, 240, 180);
      return c.toDataURL();
    });
    await page.locator('#image-input').setInputFiles({ name: 'spacing.png', mimeType: 'image/png', buffer: Buffer.from(fixture.split(',')[1], 'base64') });
    await page.locator('#crop-skip').click();
    assert.equal(await page.locator('body').getAttribute('data-step'), '2');
    assert.ok(await page.locator('#step-next').isDisabled());
    assert.equal(await page.locator('section[data-phase="2"] .grid-tuning').getAttribute('open'), null);
    assert.ok(await page.locator('#grid-warning-legend').isVisible());
    for (const [key, expected] of [['dashed', '红色短虚线'], ['wide', '65%'], ['narrow', '60%']]) {
      await page.locator(`[data-warning-help="${key}"]`).click();
      assert.ok((await page.locator('#parameter-help-text').textContent()).includes(expected));
      await page.locator('#parameter-help-dialog button').click();
    }
    assert.ok(await page.locator('#hint-x').isVisible());
    assert.ok(await page.locator('#hint-y').isVisible());
    await page.locator('#detect').click();
    await page.waitForFunction(() => !document.getElementById('detect').disabled);
    assert.equal(await page.locator('body').getAttribute('data-step'), '2');
    assert.equal(await page.locator('#hint-x').inputValue(), '20');
    assert.equal(await page.locator('#hint-y').inputValue(), '15');
    assert.ok(await page.locator('#candidates-x button').count() >= 2);
    assert.match(await page.locator('#candidates-x button').first().textContent(), /推荐/);
    const columns = await page.locator('#cols').inputValue();
    const pixel = (x, y) => page.evaluate(({ x, y }) => Array.from(document.getElementById('source-canvas').getContext('2d').getImageData(x, y, 1, 1).data), { x, y });
    await page.locator('#candidates-x button').first().click();
    assert.ok(await page.locator('#spacing-preview-bar').isVisible());
    assert.match(await page.locator('#spacing-preview-label').textContent(), /横向 20/);
    assert.ok((await pixel(7, 15))[3] < 90, 'Old horizontal grid is absent and source is translucent');
    assert.ok((await pixel(20, 7))[3] > 160, 'Vertical preview line is visible');
    assert.equal(await page.locator('#cols').inputValue(), columns, 'Preview does not change actual grid');
    await page.locator('#candidates-y button').first().click();
    assert.match(await page.locator('#spacing-preview-label').textContent(), /纵向 15/);
    assert.ok((await pixel(20, 7))[3] < 90, 'Switching axis removes the vertical preview');
    assert.ok((await pixel(7, 15))[3] > 160);
    await page.locator('#source-canvas').click({ position: { x: 30, y: 30 } });
    assert.ok(await page.locator('#spacing-preview-bar').isHidden());
    assert.equal((await pixel(7, 7))[3], 255);
    await page.locator('#hint-x').fill('40');
    assert.match(await page.locator('#spacing-preview-label').textContent(), /横向 40/);
    await page.locator('#hint-x').press('Tab');
    await page.screenshot({ path: path.join(artifacts, 'detection-desktop.png') });
    await page.locator('section[data-phase="2"] .grid-tuning summary').click();
    for (const key of ['spacing-weight', 'search-ratio', 'local-window', 'narrow-ratio', 'wide-ratio']) {
      await page.locator(`[data-help="${key}"]`).click();
      assert.ok(await page.locator('#parameter-help-dialog').isVisible());
      assert.ok((await page.locator('#parameter-help-text').textContent()).length > 30);
      assert.match(await page.locator('#parameter-help-text').textContent(), /^越小.*越大/);
      await page.locator('#parameter-help-dialog button').click();
    }
    for (const [key, value] of Object.entries({ 'spacing-weight': 15, 'search-ratio': 35, 'local-window': 50, 'narrow-ratio': 60, 'wide-ratio': 65 })) {
      assert.equal(await page.locator('#' + key).getAttribute('type'), 'range');
      await page.locator('#' + key + '-number').fill(String(value + 1));
      await page.locator('#' + key + '-number').press('Tab');
      assert.equal(await page.locator('#' + key).inputValue(), String(value + 1));
      await page.locator('#' + key).focus(); await page.locator('#' + key).press('ArrowLeft');
      assert.equal(await page.locator('#' + key + '-number').inputValue(), String(value));
    }
    await page.screenshot({ path: path.join(artifacts, 'parameters-desktop.png') });
    await page.locator('section[data-phase="2"] .grid-tuning summary').click();
    const pendingEvent = page.waitForEvent('download'); await page.locator('#save-project').click();
    const pendingDownload = await pendingEvent, pendingPath = path.join(artifacts, 'detection-pending.pixel.json');
    await pendingDownload.saveAs(pendingPath);
    const pending = JSON.parse(await fs.readFile(pendingPath, 'utf8'));
    assert.equal(pending.gridOptionsPending, true);
    assert.equal(pending.gridOptions.localWindowRatio, 0.5);
    assert.equal(pending.gridOptions.wideRatio, 1.65);
    await page.locator('#project-input').setInputFiles(pendingPath);
    await page.waitForFunction(() => document.getElementById('toast').textContent === '项目已打开');
    assert.equal(await page.locator('body').getAttribute('data-step'), '2');
    assert.equal(await page.locator('#hint-x').inputValue(), '40');
    await page.locator('#step-next').click();
    await page.locator('#confirm-dialog button[value=confirm]').click();
    await page.waitForFunction(() => document.body.dataset.step === '3');
    assert.ok(await page.locator('#grid-warning-legend').isVisible());
    await page.locator('[data-warning-help="dashed"]').click();
    assert.match(await page.locator('#parameter-help-text').textContent(), /蓝色虚线/);
    await page.locator('#parameter-help-dialog button').click();
    const expectedCols = await page.evaluate(() => PixelCore.detectAxis(PixelCore.projection(window.detectionFixture, 'x'), { ...PixelCore.Grid.DEFAULTS, spacingWeight: 0.15, pitchHint: 40 }).lines.length - 1);
    assert.equal(Number(await page.locator('#cols').inputValue()), expectedCols, 'Next applies selected spacing');
    assert.ok(await page.locator('#spacing-preview-bar').isHidden());
    assert.equal((await pixel(7, 7))[3], 255);
    await page.locator('nav [data-step="2"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#fit').click();
    await page.locator('#hint-y').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(artifacts, 'detection-mobile.png'), fullPage: true });
    await page.locator('section[data-phase="2"] .grid-tuning summary').click();
    await page.screenshot({ path: path.join(artifacts, 'parameters-mobile.png'), fullPage: true });
    // Top-level navigation must apply changed settings as well.
    await page.locator('#hint-x').fill('30'); await page.locator('#hint-x').press('Tab');
    await page.locator('nav [data-step="3"]').click();
    await page.waitForFunction(() => document.body.dataset.step === '3');
    const downloadEvent = page.waitForEvent('download'); await page.locator('#save-project').click();
    const download = await downloadEvent, savedPath = path.join(artifacts, 'detection.pixel.json');
    await download.saveAs(savedPath);
    const saved = JSON.parse(await fs.readFile(savedPath, 'utf8'));
    assert.equal(saved.gridOptions.hintX, 30);
    assert.equal(saved.gridOptionsPending, false);
    const expectedLines = await page.evaluate(() => PixelCore.detectAxis(PixelCore.projection(window.detectionFixture, 'x'), { ...PixelCore.Grid.DEFAULTS, spacingWeight: 0.15, pitchHint: 30 }).lines);
    assert.deepEqual(saved.xs, expectedLines);
    assert.deepEqual(errors, []);
    console.log('Detection passed: stay on step 2, recommended candidates, axis-only preview pixels, parameter help, next/nav application, desktop/mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
