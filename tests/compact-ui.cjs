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
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(6000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const image = await page.evaluate(() => document.getElementById('source-canvas').toDataURL());
    const project = { version: 1, name: '布局与参数重置', image, width: 480, height: 480,
      xs: [0, 100, 240, 480], ys: [0, 240, 480], threshold: 25, edgeWeight: .8, multiColorThreshold: .9,
      samples: { '0,0': { x: 0, y: 0, w: 100, h: 230 } }, colors: { '1,0': [255, 0, 0, 255] }, cellModes: { '0,1': 'mean' },
      spacingWeight: .8, gridOptions: { hintX: 30, hintY: 40, searchRatio: .8, localWindowRatio: .2, narrowRatio: .4, wideRatio: 1.2, aggressive: false }, hasGrid: true };
    await page.locator('#project-input').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await page.waitForFunction(() => document.body.dataset.step === '3');
    await page.locator('#snap-radius').fill('20'); await page.locator('#snap-radius').press('Tab');
    await page.locator('#show-grid').uncheck(); await page.locator('#snap-gradient').uncheck();
    await page.locator('#show-gradient').check();
    await page.locator('#reset-grid-params').click();
    assert.equal(await page.locator('#snap-radius').inputValue(), '6');
    assert.ok(await page.locator('#show-grid').isChecked()); assert.ok(await page.locator('#snap-gradient').isChecked());
    assert.ok(!await page.locator('#show-gradient').isChecked());
    assert.equal(await page.locator('#grid-opacity').inputValue(), '45');
    await page.screenshot({ path: path.join(artifacts, 'compact-grid.png') });
    await page.locator('[data-step="4"]').click();
    assert.equal(await page.locator('[data-tool=rect], [data-tool=move], .selection-section').count(), 0);
    await page.locator('#reset-color-params').click();
    assert.equal(await page.locator('#threshold').inputValue(), '16');
    assert.equal(await page.locator('#edge-weight').inputValue(), '35');
    assert.equal(await page.locator('#multi-color-threshold-number').inputValue(), '65');
    assert.equal(await page.locator('#manual-count').textContent(), '1 格');
    await page.locator('#source-canvas').click({ position: { x: 20, y: 20 } });
    await page.keyboard.press('ArrowRight');
    await page.locator('[data-cell-color-mode=manual]').click();
    await page.screenshot({ path: path.join(artifacts, 'compact-color.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#fit').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile page must not overflow');
    await page.screenshot({ path: path.join(artifacts, 'compact-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('[data-step="2"]').click();
    await page.locator('#reset-detection-params').click();
    for (const [id, expected] of Object.entries({ 'hint-x': '0', 'hint-y': '0', 'spacing-weight': '15', 'search-ratio': '35', 'local-window': '50', 'narrow-ratio': '60', 'wide-ratio': '65' })) {
      assert.equal(await page.locator('#' + id).inputValue(), expected);
    }
    assert.ok(await page.locator('#aggressive-grid').isChecked());
    await page.locator('.grid-tuning summary').first().click();
    await page.screenshot({ path: path.join(artifacts, 'compact-detection.png') });
    const downloadEvent = page.waitForEvent('download'); await page.locator('#save-project').click();
    const download = await downloadEvent; const savedPath = path.join(artifacts, 'compact-reset.pixel.json');
    await download.saveAs(savedPath); const saved = JSON.parse(await fs.readFile(savedPath, 'utf8'));
    for (const key of ['xs', 'ys', 'samples', 'colors', 'cellModes', 'image']) assert.deepEqual(saved[key], project[key], key + ' preserved by parameter resets');
    assert.equal(saved.threshold, 16); assert.equal(saved.gridOptions.localWindowRatio, .5);
    assert.equal(saved.gridOptionsPending, true);
    await page.locator('[data-step="3"]').click();
    await page.locator('#confirm-dialog[open]').waitFor();
    await page.locator('#confirm-dialog button[value=cancel]').click();
    assert.equal(await page.locator('body').getAttribute('data-step'), '2');
    assert.deepEqual(errors, []);
    console.log('Compact UI passed: three parameter resets preserve edits, sampling controls/shortcuts removed, navigation confirmation, desktop/mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
