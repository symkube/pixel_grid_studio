const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
function image(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return { width: w, height: h, data };
}
test('grid detects a repeated 10px pattern and remains ordered', () => {
  const src = image(240, 200, (x, y) => ((Math.floor(x / 10) + Math.floor(y / 10)) % 2 ? [220, 100, 40, 255] : [30, 120, 160, 255]));
  const grid = C.detectGrid(src);
  assert.equal(grid.x.pitch, 10); assert.equal(grid.y.pitch, 10);
  assert.equal(grid.x.lines.length, 25); assert.equal(grid.y.lines.length, 21);
  assert.ok(grid.x.confidence > 0.9);
});
test('uniform content returns low confidence rather than strong invented edges', () => {
  const src = image(100, 80, () => [255, 255, 255, 255]);
  assert.equal(C.detectGrid(src).x.confidence, 0);
});
test('grid favors fundamental spacing when alternating boundaries are stronger', () => {
  const scores = Array.from({ length: 480 }, (_, i) => i % 20 === 0 ? 100 : i % 10 === 0 ? 50 : 1);
  assert.equal(C.detectAxis(scores).pitch, 10);
});
test('majority cluster survives color noise and does not average opposing colors', () => {
  const src = image(10, 10, (x, y) => x < 7 ? [180 + (y % 4), 40, 50, 255] : [20, 40, 230, 255]);
  const sampled = C.sampleCell(src, { x: 0, y: 0, w: 10, h: 10 }, 16, 1);
  assert.ok(sampled.color[0] >= 180); assert.equal(sampled.color[2], 50); assert.ok(sampled.confidence > 0.69);
});
test('transparent majority stays transparent regardless of hidden RGB', () => {
  const src = image(10, 10, x => x < 8 ? [220, 100, 200, 0] : [0, 0, 0, 255]);
  assert.deepEqual(C.sampleCell(src, { x: 0, y: 0, w: 10, h: 10 }, 16, 1).color, [0, 0, 0, 0]);
});
test('sample rectangles are clamped without reading outside the image', () => {
  const src = image(3, 3, () => [20, 50, 100, 255]);
  assert.deepEqual(C.fitRect({ x: -5, y: 9, w: 5, h: 1 }, 3, 3), { x: 0, y: 2, w: 3, h: 1 });
  assert.deepEqual(C.sampleCell(src, { x: -5, y: 9, w: 5, h: 1 }).color, [20, 50, 100, 255]);
});
test('manual overrides replace colors and suppress ambiguity only for their cell', () => {
  const src = image(4, 2, x => x % 2 ? [255, 0, 0, 255] : [0, 0, 255, 255]);
  const out = C.renderPixels(src, [0, 2, 4], [0, 2], {}, { '0,0': [0, 255, 0, 255] }, 5, 1);
  assert.deepEqual(Array.from(out.data.slice(0, 4)), [0, 255, 0, 255]); assert.equal(out.issues.length, 1); assert.equal(out.issues[0].col, 1);
});
test('pitch grids cover edges and stay within the cell limit', () => {
  for (const size of [8, 100, 2048]) {
    const lines = C.pitchLines(size, 2, 0.4);
    assert.equal(lines[0], 0); assert.equal(lines.at(-1), size); assert.ok(lines.length <= 129); assert.ok(lines.every((v, i) => i === 0 || v > lines[i - 1]));
  }
});
test('project validation rejects malformed boundaries and nonfinite sampling', () => {
  const p = { version: 1, image: 'data:image/png;base64,AAAA', width: 10, height: 10, xs: [0, 5, 10], ys: [0, 10], samples: {}, colors: {}, threshold: 16, edgeWeight: 0.35 };
  assert.equal(C.validateProject(p), p);
  assert.throws(() => C.validateProject({ ...p, xs: [0, 10, 5] }));
  assert.throws(() => C.validateProject({ ...p, samples: { '0,0': { x: NaN, y: 0, w: 1, h: 1 } } }));
  assert.throws(() => C.validateProject({ ...p, colors: { '9,0': [0, 0, 0, 255] } }));
});
test('fractional spacing keeps fundamental boundaries instead of doubling the period', () => {
  for (const pitch of [8, 9.5, 10.5, 13.4, 20.5]) {
    const scores = new Float64Array(1024), expected = [];
    for (let x = pitch; Math.round(x) < scores.length; x += pitch) { scores[Math.round(x)] = 100; expected.push(Math.round(x)); }
    const d = C.detectAxis(scores);
    assert.deepEqual(d.lines.slice(1, -1), expected, `pitch ${pitch}`);
    assert.equal(d.limitExceeded, false);
  }
});
test('zero spacing prior uses observed edges and does not fill invisible boundaries', () => {
  const scores = new Float64Array(160);
  for (const x of [10, 20, 30, 80, 90, 100, 110, 120, 130, 140, 150]) scores[x] = 100;
  const d = C.detectAxis(scores, { spacingWeight: 0 });
  assert.ok(!d.lines.includes(40)); assert.deepEqual(d.irregular, []);
});
test('locally varying cell sizes are not forced into one global lattice', () => {
  const scores = new Float64Array(300), expected = [12, 25, 39, 54, 70, 87, 105, 124, 144, 165, 187, 210, 234, 259, 285];
  expected.forEach(x => scores[x] = 100);
  assert.deepEqual(C.detectAxis(scores).lines.slice(1, -1), expected);
});
test('projection includes thin details between former subsampling rows', () => {
  const src = image(40, 1024, (x, y) => y % 4 === 1 && x >= 20 ? [255, 255, 255, 255] : [0, 0, 0, 255]);
  assert.ok(C.projection(src, 'x')[20] > 50);
});
test('gradient snapping respects radius and does not cross adjacent lines', () => {
  const scores = new Float64Array(100); scores[40] = 100; scores[50] = 200;
  assert.equal(C.snapBoundary(scores, 37, 6, 1, 99), 40);
  assert.equal(C.snapBoundary(scores, 20, 6, 1, 99), 20);
  const refined = C.refineAxis(scores, [0, 39, 44, 100], 20);
  assert.equal(refined.length, 4); assert.ok(refined[1] < refined[2]);
});
test('purity refinement moves toward real edges without cumulative displacement beyond the limit', () => {
  const src = image(80, 40, (x, y) => [(Math.floor(x / 20) % 2) * 255, (Math.floor(y / 20) % 2) * 255, 0, 255]);
  const xs = [0, 24, 44, 64, 80], ys = [0, 24, 40];
  const r = C.refineGrid(src, xs, ys, { radius: 3, passes: 5 });
  r.xs.forEach((v, i) => assert.ok(Math.abs(v - xs[i]) <= 3)); r.ys.forEach((v, i) => assert.ok(Math.abs(v - ys[i]) <= 3));
  assert.ok(r.moved > 0); assert.ok(r.review.some(v => v.reason === 'movement-limit'));
  const full = C.refineGrid(src, xs, ys, { radius: 6 });
  assert.deepEqual(full.xs, [0, 20, 40, 60, 80]); assert.deepEqual(full.ys, [0, 20, 40]);
});
test('missing-line proposals require both a wide interval and purity improvement', () => {
  const src = image(100, 40, x => [Math.floor(x / 20) % 2 ? 255 : 0, 0, 0, 255]);
  const r = C.refineGrid(src, [0, 20, 60, 80, 100], [0, 20, 40], { radius: 1 });
  assert.ok(r.suggestions.x.some(p => p.position === 40));
  const solid = image(100, 40, () => [100, 100, 100, 255]);
  const quiet = C.refineGrid(solid, [0, 20, 60, 80, 100], [0, 20, 40]);
  assert.equal(quiet.suggestions.x.length, 0); assert.ok(quiet.review.some(v => v.reason === 'wide-cell'));
});
test('density limit is reported rather than hidden as a multiple of the grid spacing', () => {
  const scores = new Float64Array(1000); for (let x = 5; x < 1000; x += 5) scores[x] = 100;
  const d = C.detectAxis(scores); assert.equal(d.limitExceeded, true); assert.equal(d.lines.length, 129);
});

test('aggressive tracking repairs missing and duplicate boundaries; conservative mode flags both', () => {
  const scores = new Float64Array(240);
  for (let x = 20; x < 240; x += 20) if (x !== 100) scores[x] = 100;
  scores[64] = 50;
  const auto = C.detectAxis(scores);
  assert.deepEqual(auto.lines, Array.from({ length: 13 }, (_, i) => i * 20));
  assert.deepEqual(auto.edits, { inserted: [100], merged: [64] });
  assert.ok(auto.irregular.includes(auto.lines.indexOf(100)));
  const review = C.detectAxis(scores, { aggressive: false });
  assert.ok(review.lines.includes(64)); assert.ok(!review.lines.includes(100));
  assert.deepEqual(review.edits, { inserted: [], merged: [] });
  assert.deepEqual(review.anomalies.map(a => a.reason).sort(), ['narrow', 'wide']);
});

test('local periodic candidates follow different scales in different parts of an image', () => {
  const scores = new Float64Array(640);
  for (let x = 10; x < 320; x += 10) scores[x] = 100;
  for (let x = 320; x < 640; x += 20) scores[x] = 100;
  const windows = C.Grid.spacingCandidates(scores, C.gradientPeaks(scores).peaks, { localWindow: 128 });
  assert.ok(Math.abs(windows[0].candidates[0].pitch - 10) < 0.5);
  assert.ok(Math.abs(windows.at(-1).candidates[0].pitch - 20) < 0.5);
});

test('width thresholds affect diagnostics and active tracking even with a large search radius', () => {
  const scores = new Float64Array(240);
  for (const x of [20, 40, 53, 70, 90, 110, 130, 150, 170, 190, 210, 230]) scores[x] = 100;
  const loose = C.detectAxis(scores, { pitchHint: 20, narrowRatio: 0.6, searchRatio: 0.8 });
  const strict = C.detectAxis(scores, { pitchHint: 20, narrowRatio: 0.8, searchRatio: 0.8 });
  assert.ok(loose.lines.includes(53)); assert.ok(!strict.lines.includes(53));
  const peaks = C.gradientPeaks(scores).peaks, windows = C.Grid.spacingCandidates(scores, peaks);
  const lines = [0, 10, 30, 70, 90, 110, 130, 150, 170, 190, 210, 240];
  assert.ok(C.Grid.diagnostics(lines, scores, peaks, windows, { pitchHint: 20 }).some(a => a.reason === 'wide'));
  assert.equal(C.Grid.diagnostics(lines, scores, peaks, windows, { pitchHint: 20, narrowRatio: 0.4, wideRatio: 2.1 }).length, 0);
});

test('purity refinement respects configurable width thresholds', () => {
  const solid = image(100, 20, () => [100, 100, 100, 255]);
  const xs = [0, 10, 30, 70, 90, 100];
  const defaults = C.refineGrid(solid, xs, [0, 20]);
  assert.ok(defaults.review.some(r => r.reason === 'narrow-cell'));
  assert.ok(defaults.review.some(r => r.reason === 'wide-cell'));
  const loose = C.refineGrid(solid, xs, [0, 20], { narrowRatio: 0.2, wideRatio: 3 });
  assert.equal(loose.review.length, 0);
});

test('project grid settings round-trip while malformed options are rejected', () => {
  const p = { version: 1, image: 'data:image/png;base64,AAAA', width: 10, height: 10, xs: [0, 10], ys: [0, 10], samples: {}, colors: {}, threshold: 16, edgeWeight: 0.35 };
  assert.deepEqual(C.validateProject({ ...p, gridOptions: { ...C.Grid.DEFAULTS, hintX: 29.5 } }).gridOptions.hintX, 29.5);
  for (const options of [null, [], { searchRatio: 2 }, { localWindow: 64.5 }, { narrowRatio: NaN }, { wideRatio: 0 }, { hintX: -1 }, { aggressive: 'true' }, { pitchHint: 20 }]) {
    assert.throws(() => C.validateProject({ ...p, gridOptions: options }));
  }
  assert.equal(C.validateProject(p), p);
  assert.equal(C.validateProject({ ...p, gridOptions: { localWindowRatio: 0.5, searchRatio: 0, narrowRatio: 0, wideRatio: 1 } }).gridOptions.localWindowRatio, 0.5);
  assert.throws(() => C.validateProject({ ...p, gridOptions: { localWindowRatio: 0 } }));
});

test('percentage windows use each axis length and retain legacy pixel windows', () => {
  for (const [size, expected] of [[1000, 500], [600, 300], [10, 8], [4, 4]]) {
    const windows = C.Grid.spacingCandidates(new Float64Array(size), [], { localWindowRatio: 0.5 });
    assert.ok(windows.every(w => w.end - w.start === expected));
  }
  assert.equal(C.Grid.spacingCandidates(new Float64Array(600), [], { localWindow: 128 })[0].end, 128);
  const opts = C.Grid.settings({ searchRatio: 0, narrowRatio: 0, wideRatio: 1 });
  assert.equal(opts.searchRatio, 0); assert.equal(opts.narrowRatio, 0); assert.equal(opts.wideRatio, 1);
});

test('mean sampling includes every pixel and ignores invisible RGB in its average', () => {
  const src = image(10, 1, x => x < 8 ? [200, 0, 0, 255] : [0, 0, 200, 255]);
  const rect = { x: 0, y: 0, w: 10, h: 1 };
  assert.deepEqual(C.meanCell(src, rect).color, [160, 0, 40, 255]);
  const alpha = image(2, 1, x => x ? [255, 0, 0, 0] : [0, 0, 200, 255]);
  assert.deepEqual(C.meanCell(alpha, { x: 0, y: 0, w: 2, h: 1 }).color, [0, 0, 200, 255]);
  assert.deepEqual(C.meanCell(image(2, 1, () => [99, 50, 20, 0]), { x: 0, y: 0, w: 2, h: 1 }).color, [0, 0, 0, 0]);
  assert.deepEqual(C.meanCell(image(3, 1, x => x === 2 ? [255, 0, 0, 0] : [0, 100, 200, x ? 128 : 64]), { x: 0, y: 0, w: 3, h: 1 }).color, [0, 100, 200, 96]);
  const rendered = C.renderPixels(src, [0, 10], [0, 1], {}, { '0,0': [1, 2, 3, 255] }, 16, 0.35, 'mean');
  assert.deepEqual([...rendered.data], [1, 2, 3, 255]);
});

test('line merges use the exact average and reject discontinuous or perimeter selections', () => {
  const lines = [0, 10, 12, 15, 30, 40];
  assert.deepEqual(C.mergeLines(lines, [1, 2, 3]), [0, 37 / 3, 30, 40]);
  assert.throws(() => C.mergeLines(lines, [1, 3]));
  assert.throws(() => C.mergeLines(lines, [0, 1]));
  assert.deepEqual(lines, [0, 10, 12, 15, 30, 40]);
});

test('interval repairs split wide gaps and preserve image boundaries when merging narrow cells', () => {
  const scores = new Float64Array(100); scores[39] = 100;
  const split = C.repairInterval([0, 20, 60, 100], { start: 20, end: 60, gap: 40, expected: 20, reason: 'wide' }, scores);
  assert.deepEqual(split.lines, [0, 20, 39, 60, 100]);
  const merge = C.repairInterval([0, 20, 22, 40, 100], { start: 20, end: 22, reason: 'narrow' }, scores);
  assert.deepEqual(merge.lines, [0, 21, 40, 100]);
  assert.deepEqual(C.repairInterval([0, 1, 20, 100], { start: 0, end: 1, reason: 'narrow' }, scores).lines, [0, 20, 100]);
  const dense = Array.from({ length: 128 }, (_, i) => i).concat(200);
  assert.match(C.repairInterval(dense, { start: 127, end: 200, gap: 73, expected: 10, reason: 'wide' }, new Float64Array(200)).reason, /128/);
  const remap = C.remapOverrides([0, 20, 22, 40, 100], [0, 10], merge.lines, [0, 10], {}, { '3,0': [1, 2, 3, 255] });
  assert.deepEqual(remap.colors, { '2,0': [1, 2, 3, 255] });
});
