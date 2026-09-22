const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width:1280, height:900 } });
    page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    assert.equal(await page.locator('body').getAttribute('data-step'), '1');
    assert.ok(!await page.locator('#source-canvas').isVisible());
    assert.ok(!await page.locator('.header-document').isVisible());
    await page.waitForFunction(() => [...document.querySelectorAll('#import-start img')].every(img => img.complete && img.naturalWidth > 0));
    const artifacts = path.resolve(__dirname,'../.artifacts'); await fs.mkdir(artifacts,{ recursive:true });
    await page.screenshot({ path:path.join(artifacts,'import-start-desktop.png') });
    for (const button of await page.locator('[data-example]').all()) {
      await button.click();
      await page.waitForFunction(() => document.getElementById('alpha-dialog').open || document.getElementById('crop-dialog').open).catch(async e => { throw Error(`${await button.getAttribute('data-example')}: ${await page.locator('#toast').textContent()} (${e.message})`); });
      if (await page.locator('#alpha-dialog').isVisible()) await page.locator('#alpha-dialog [value=continue]').click();
      await page.locator('#crop-dialog[open]').waitFor();
      await page.locator('#crop-cancel').click();
      assert.equal(await page.locator('body').getAttribute('data-step'), '1');
    }
    await page.locator('[data-example="pics/mingqiannailv.jpg"]').click();
    await page.locator('#crop-skip').click();
    await page.waitForFunction(() => document.body.dataset.step === '2');
    assert.equal(await page.locator('#filename').textContent(), 'mingqiannailv.jpg');
    await page.locator('[data-step="1"]').click();
    assert.ok(await page.locator('#welcome-continue').isVisible());
    await page.locator('#welcome-continue').click();
    assert.equal(await page.locator('body').getAttribute('data-step'), '2');
    await page.locator('[data-step="1"]').click();
    await page.setViewportSize({ width:390,height:844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:path.join(artifacts,'import-start-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Import start passed: all local images, five sample imports/cancel, shared crop flow, resume current image, mobile layout.');
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
