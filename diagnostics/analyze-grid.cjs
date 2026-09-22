const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const sharp = require('sharp');
const C = require('./case-20260921/core-original.cjs');

const input = process.argv[2];
if (!input) throw new Error('Usage: node diagnostics/analyze-grid.cjs <saved-project.json>');
const dir = path.join(__dirname, 'case-20260921');
fs.mkdirSync(dir, { recursive: true });
const bytes = fs.readFileSync(input), p = C.validateProject(JSON.parse(bytes));
fs.writeFileSync(path.join(dir, 'manual.pixel.json'), bytes);
const image = Buffer.from(p.image.split(',')[1], 'base64');
fs.writeFileSync(path.join(dir, 'source.png'), image);
const src = PNG.sync.read(image), auto = C.detectGrid(src);
const px = C.projection(src, 'x'), py = C.projection(src, 'y');
function correlations(scores) {
  const n = scores.length, mean = scores.reduce((a, b) => a + b, 0) / n, out = [];
  for (let pitch = 3; pitch <= 128; pitch++) {
    let dot = 0, aa = 0, bb = 0;
    for (let i = 1; i < n - pitch; i++) { const a = scores[i] - mean, b = scores[i + pitch] - mean; dot += a * b; aa += a * a; bb += b * b; }
    out.push({ pitch, correlation: dot / Math.sqrt(aa * bb || 1) });
  }
  return out;
}
function summary(lines, detected, scores) {
  const gaps = lines.slice(1).map((v, i) => v - lines[i]);
  const distances = lines.slice(1, -1).map(x => Math.min(...detected.lines.slice(1, -1).map(y => Math.abs(x - y))));
  const all = correlations(scores), sorted = [...all].sort((a, b) => b.correlation - a.correlation);
  const realGaps = gaps.filter(v => v > 3);
  return {
    manualCells: lines.length - 1, automaticCells: detected.lines.length - 1,
    manualGapMedian: [...realGaps].sort((a, b) => a - b)[Math.floor(realGaps.length / 2)],
    manualGapRange: [Math.min(...realGaps), Math.max(...realGaps)],
    tinyCells: gaps.map((gap, i) => ({ index: i, start: lines[i], end: lines[i + 1], gap })).filter(v => v.gap < 3),
    estimatedPitch: detected.pitch, reportedConfidence: detected.confidence,
    selectedCorrelation: all.find(v => v.pitch === detected.pitch)?.correlation,
    meanDistanceToNearestAutomatic: distances.reduce((a, b) => a + b, 0) / distances.length,
    manualBoundaryRecallAt2px: distances.filter(d => d <= 2).length / distances.length,
    topCorrelations: sorted.slice(0, 12),
    manualLines: lines, automaticLines: detected.lines,
    boundaryDisplacements: lines.slice(1, -1).map((x, i) => ({ manual: x, automaticAtSameIndex: detected.lines[i + 1] ?? null, displacement: detected.lines[i + 1] === undefined ? null : detected.lines[i + 1] - x, nearestDistance: distances[i] })),
  };
}
const report = { name: p.name, width: p.width, height: p.height, x: summary(p.xs, auto.x, px), y: summary(p.ys, auto.y, py) };
fs.writeFileSync(path.join(dir, 'analysis.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(dir, 'edge-projections.csv'), 'position,x,y\n' + Array.from({ length: Math.max(px.length, py.length) }, (_, i) => `${i},${px[i] ?? ''},${py[i] ?? ''}`).join('\n'));
function overlay(xs, ys, color) {
  const out = new PNG({ width: src.width, height: src.height }); src.data.copy(out.data);
  const blend = (x, y) => { const idx = (y * src.width + x) * 4; for (let k = 0; k < 3; k++) out.data[idx + k] = out.data[idx + k] * 0.4 + color[k] * 0.6; out.data[idx + 3] = 255; };
  for (const x of xs.slice(1, -1)) for (let y = 0; y < src.height; y++) blend(Math.min(src.width - 1, Math.round(x)), y);
  for (const y of ys.slice(1, -1)) for (let x = 0; x < src.width; x++) blend(x, Math.min(src.height - 1, Math.round(y)));
  return PNG.sync.write(out);
}
async function main() {
  const manual = overlay(p.xs, p.ys, [0, 200, 170]), automatic = overlay(auto.x.lines, auto.y.lines, [235, 85, 60]);
  fs.writeFileSync(path.join(dir, 'manual-grid.png'), manual); fs.writeFileSync(path.join(dir, 'automatic-grid.png'), automatic);
  const label = (text) => Buffer.from(`<svg width="627" height="44"><rect width="627" height="44" fill="#fff"/><text x="16" y="29" font-family="Arial" font-size="17" fill="#253c34">${text}</text></svg>`);
  const comparison = await sharp({ create: { width: 1254, height: 671, channels: 4, background: '#ffffff' } }).composite([
    { input: await sharp(automatic).resize(627, 627).toBuffer(), left: 0, top: 44 },
    { input: await sharp(manual).resize(627, 627).toBuffer(), left: 627, top: 44 },
    { input: label(`Original algorithm: ${auto.x.lines.length - 1} x ${auto.y.lines.length - 1}`), left: 0, top: 0 },
    { input: label(`Your manual grid: ${p.xs.length - 1} x ${p.ys.length - 1}`), left: 627, top: 0 },
  ]).png().toBuffer();
  fs.writeFileSync(path.join(dir, 'comparison.png'), comparison);
  console.log(JSON.stringify({ ...report, x: { ...report.x, manualLines: undefined, automaticLines: undefined, boundaryDisplacements: undefined }, y: { ...report.y, manualLines: undefined, automaticLines: undefined, boundaryDisplacements: undefined } }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
