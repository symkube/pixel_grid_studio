const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const artifacts = path.resolve(__dirname, '../.artifacts'); await fs.mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const fixture = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 60; c.height = 20; const ctx = c.getContext('2d');
      ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 10, 20); ctx.fillStyle = '#0000ff'; ctx.fillRect(10, 0, 10, 20);
      ctx.fillStyle = '#00ff00'; ctx.fillRect(20, 0, 20, 20); ctx.fillStyle = '#fff'; ctx.fillRect(40, 0, 20, 20);
      return c.toDataURL();
    });
    const project = { version: 1, name: 'colors', image: fixture, width: 60, height: 20, xs: [0,20,40,60], ys: [0,20], samples: {}, colors: {'2,0': [255,128,0,255]}, threshold: 16, edgeWeight: 0.35, hasGrid: true };
    await page.locator('#project-input').setInputFiles({ name: 'colors.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(project)) });
    await page.waitForFunction(() => document.body.dataset.step === '3');
    await page.locator('nav [data-step="4"]').click();
    assert.ok(await page.locator('[name=color-mode][value=mode]').isChecked());
    assert.match(await page.locator('#issue-count').textContent(), /1 个/);
    await page.locator('#multi-color-threshold-number').fill('40'); await page.locator('#multi-color-threshold-number').press('Tab');
    await page.waitForFunction(() => document.getElementById('apply-mean-issues').disabled);
    await page.locator('#multi-color-threshold-number').fill('65'); await page.locator('#multi-color-threshold-number').press('Tab');
    await page.waitForFunction(() => !document.getElementById('apply-mean-issues').disabled);
    await page.locator('#apply-mean-issues').click();
    assert.match(await page.locator('#toast').textContent(), /1 个多色格/);
    assert.match(await page.locator('#color-view-counts').textContent(), /众数 1 · 均值 1 · 手动 1/);
    assert.ok(await page.locator('#apply-mean-issues').isDisabled());
    await page.locator('#undo').click(); assert.match(await page.locator('#issue-count').textContent(), /1 个/);
    await page.locator('#redo').click();
    const canvasPixels = id => page.evaluate(id => {
      const c = document.getElementById(id), ctx = c.getContext('2d');
      return [0,1,2].map(i => Array.from(ctx.getImageData(Math.floor((i+.5)*c.width/3), Math.floor(c.height*.37),1,1).data));
    }, id);
    assert.deepEqual(await canvasPixels('preview-canvas'), [[128,0,128,255],[0,255,0,255],[255,128,0,255]]);
    for (const [mode, active] of [['mode',1],['mean',0],['manual',2]]) {
      await page.locator(`[name=color-view][value=${mode}]`).check();
      for (const id of ['source-canvas', 'preview-canvas']) {
        const pixels = await canvasPixels(id);
        assert.equal(pixels[active][3], 255, id + ': ' + mode + ' active cell');
        assert.ok(pixels[(active+1)%3][3] >= 40 && pixels[(active+1)%3][3] <= 50, id + ': ' + mode + ' other cell faded');
      }
    }
    const download = async (button, filename) => {
      const event = page.waitForEvent('download'); await page.locator(button).click(); const d = await event;
      const file = path.join(artifacts, filename); await d.saveAs(file); return file;
    };
    await page.locator('#export-scale').selectOption('1');
    const png = await fs.readFile(await download('#export','color-view-export.png'));
    const exportPixels = await page.evaluate(async url => {
      const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = 3; c.height = 1;
      const ctx = c.getContext('2d'); ctx.drawImage(img,0,0); return Array.from(ctx.getImageData(0,0,3,1).data);
    }, 'data:image/png;base64,'+png.toString('base64'));
    assert.deepEqual(exportPixels,[128,0,128,255,0,255,0,255,255,128,0,255]);
    const savedPath = await download('#save-project','color-editor.pixel.json'), saved = JSON.parse(await fs.readFile(savedPath,'utf8'));
    assert.equal(saved.cellModes['0,0'],'mean'); assert.equal(saved.multiColorThreshold,.65);
    assert.deepEqual(saved.colors, project.colors); assert.equal(saved.image, fixture);
    await page.locator('#project-input').setInputFiles(savedPath);
    await page.waitForFunction(() => document.body.dataset.step === '3');
    await page.locator('nav [data-step="4"]').click();
    assert.match(await page.locator('#color-view-counts').textContent(), /众数 1 · 均值 1 · 手动 1/);
    for(const key of ['color-threshold','color-edge','multi-color-threshold']) {
      await page.locator(`[data-help="${key}"]`).click();
      assert.match(await page.locator('#parameter-help-text').textContent(), /越小|越大/);
      await page.locator('#parameter-help-dialog button').click();
    }
    await page.locator('[name=color-view][value=mean]').check();
    await page.screenshot({path:path.join(artifacts,'color-editor-desktop.png')});
    await page.locator('[name=color-view][value=all]').check();
    await page.locator('#source-canvas').click({position:{x:30,y:30}});
    await page.locator('[name=color-mode][value=mode]').check(); await page.locator('#resample-selection').click();
    assert.match(await page.locator('#issue-count').textContent(), /1 个/);
    await page.locator('[name=color-mode][value=mean]').check(); await page.locator('#resample-selection').click();
    assert.ok(await page.locator('#apply-mean-issues').isDisabled());
    await page.setViewportSize({width:390,height:844}); await page.locator('#fit').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:path.join(artifacts,'color-editor-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Color editor passed: threshold, batch mean, per-cell modes, undo/redo, focus alpha, unchanged export, persistence and help.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
