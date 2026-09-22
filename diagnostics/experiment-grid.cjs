// Offline experiment: no changes to the editor or the user's saved project.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const sharp = require('sharp');
const C = require('./case-20260921/core-original.cjs');
const dir = path.join(__dirname, 'case-20260921');
const p = JSON.parse(fs.readFileSync(path.join(dir, 'manual.pixel.json')));
const src = PNG.sync.read(fs.readFileSync(path.join(dir, 'source.png')));

function fitSequence(scores, pitch) {
  const n = scores.length, count = Math.round(n / pitch), minGap = Math.floor(pitch * 0.65), maxGap = Math.ceil(pitch * 1.4);
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const evidence = Array.from(scores, (v, x) => Math.log1p((v * 0.6 + (scores[x - 1] || 0) * 0.2 + (scores[x + 1] || 0) * 0.2) / mean));
  let previous = new Float64Array(n + 1).fill(-Infinity); previous[0] = 0;
  const back = Array.from({ length: count + 1 }, () => new Int32Array(n + 1).fill(-1));
  for (let k = 1; k <= count; k++) {
    const current = new Float64Array(n + 1).fill(-Infinity);
    const start = k === count ? n : Math.max(k * minGap, n - (count - k) * maxGap);
    const end = k === count ? n : Math.min(k * maxGap, n - (count - k) * minGap);
    for (let x = start; x <= end; x++) for (let gap = minGap; gap <= maxGap; gap++) {
      const prev = x - gap; if (prev < 0 || !Number.isFinite(previous[prev])) continue;
      const score = previous[prev] + (k === count ? 0 : evidence[x]) - 12 * ((gap - pitch) / pitch) ** 2;
      if (score > current[x]) { current[x] = score; back[k][x] = prev; }
    }
    previous = current;
  }
  const lines = [n]; let at = n;
  for (let k = count; k > 0; k--) { at = back[k][at]; if (at < 0) throw new Error('No feasible path'); lines.push(at); }
  return lines.reverse();
}
function measure(reference, predicted, size) {
  // Exclude the 0.5px border cell, which has no corresponding interior image boundary.
  const internal = reference.filter(x => x > 3 && x < size - 3);
  const distances = internal.map(x => Math.min(...predicted.slice(1, -1).map(v => Math.abs(x - v))));
  return { referenceInternalLines: internal.length, predictedInternalLines: predicted.length - 2, meanNearestDistance: distances.reduce((a, b) => a + b, 0) / distances.length, recallAt2px: distances.filter(x => x <= 2).length / distances.length, maxNearestDistance: Math.max(...distances) };
}
async function main() {
  const auto = C.detectGrid(src), xx = fitSequence(C.projection(src, 'x'), auto.x.pitch), yy = fitSequence(C.projection(src, 'y'), auto.y.pitch);
  const stats = { note: 'Single-image offline experiment; uses original algorithm pitch, estimated count round(size/pitch), and edge evidence only. Manual grid is used only for evaluation. The 0.5px final column is excluded from boundary metrics.', x: { original: measure(p.xs, auto.x.lines, p.width), experiment: measure(p.xs, xx, p.width) }, y: { original: measure(p.ys, auto.y.lines, p.height), experiment: measure(p.ys, yy, p.height) }, xs: xx, ys: yy };
  fs.writeFileSync(path.join(dir, 'experiment.json'), JSON.stringify(stats, null, 2));
  const out = new PNG({ width: src.width, height: src.height }); src.data.copy(out.data);
  const blend = (x, y) => { const idx = (y * src.width + x) * 4; [35, 140, 255].forEach((v, k) => out.data[idx + k] = out.data[idx + k] * 0.4 + v * 0.6); out.data[idx + 3] = 255; };
  xx.slice(1, -1).forEach(x => { for (let y = 0; y < src.height; y++) blend(x, y); }); yy.slice(1, -1).forEach(y => { for (let x = 0; x < src.width; x++) blend(x, y); });
  const experimentalImage = PNG.sync.write(out); fs.writeFileSync(path.join(dir, 'experimental-grid.png'), experimentalImage);
  const panels = [
    ['automatic-grid.png', 'Original: fixed scaffold'],
    ['experimental-grid.png', 'Experiment: joint boundary fitting'],
    ['manual-grid.png', 'Your manual grid'],
  ];
  const composite = [];
  for (let i = 0; i < panels.length; i++) {
    const [filename, title] = panels[i];
    composite.push({ input: await sharp(path.join(dir, filename)).resize(500, 500).toBuffer(), left: i * 500, top: 40 });
    composite.push({ input: Buffer.from(`<svg width="500" height="40"><rect width="500" height="40" fill="white"/><text x="12" y="27" font-family="Arial" font-size="17" fill="#283c34">${title}</text></svg>`), left: i * 500, top: 0 });
  }
  await sharp({ create: { width: 1500, height: 540, channels: 4, background: 'white' } }).composite(composite).png().toFile(path.join(dir, 'experiment-comparison.png'));
  console.log(JSON.stringify({ x: stats.x, y: stats.y }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
