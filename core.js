(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const linear = Array.from({ length: 256 }, (_, i) => {
    const v = i / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  function lab(r, g, b) {
    r = linear[r]; g = linear[g]; b = linear[b];
    const f = v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
    const x = f((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047);
    const y = f(r * 0.2126729 + g * 0.7151522 + b * 0.072175);
    const z = f((r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const distance2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  function uniformLines(size, count) {
    count = clamp(Math.round(count), 1, Math.min(128, size));
    return Array.from({ length: count + 1 }, (_, i) => i * size / count);
  }
  function pitchLines(size, pitch, origin = 0) {
    pitch = clamp(pitch, Math.max(2, size / 127), size);
    origin = ((origin % pitch) + pitch) % pitch;
    const lines = [0];
    for (let x = origin || pitch; x < size; x += pitch) {
      if (x - lines[lines.length - 1] >= 1 && size - x >= 1) lines.push(x);
    }
    lines.push(size);
    return lines;
  }
  function projection(image, axis) {
    const { width, height, data } = image;
    const size = axis === 'x' ? width : height;
    const across = axis === 'x' ? height : width;
    const result = new Float64Array(size);
    const stride = 1;
    // Alpha-premultiplied differences keep invisible RGB noise out of edge evidence.
    for (let pos = 1; pos < size; pos++) {
      let sum = 0, count = 0;
      for (let t = 0; t < across; t += stride) {
        const a = (axis === 'x' ? t * width + pos : pos * width + t) * 4;
        const b = a - (axis === 'x' ? 4 : width * 4);
        const aa = data[a + 3] / 255, ab = data[b + 3] / 255;
        sum += Math.sqrt((data[a] * aa - data[b] * ab) ** 2 * 0.25 + (data[a + 1] * aa - data[b + 1] * ab) ** 2 * 0.5 + (data[a + 2] * aa - data[b + 2] * ab) ** 2 * 0.25 + (data[a + 3] - data[b + 3]) ** 2 * 0.25);
        count++;
      }
      result[pos] = sum / count;
    }
    return result;
  }
  function quantile(values, fraction) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b), at = (sorted.length - 1) * fraction;
    return sorted[Math.floor(at)] * (1 - at % 1) + sorted[Math.ceil(at)] * (at % 1);
  }
  function gradientPeaks(scores) {
    const n = scores.length;
    const smooth = Float64Array.from(scores, (v, i) => (v * 2 + (scores[i - 1] ?? v) + (scores[i + 1] ?? v)) / 4);
    const baseline = quantile(smooth, 0.25);
    const noise = Math.max(0.12, Math.min(quantile(smooth, 0.5) - baseline, quantile(scores, 0.5) - quantile(scores, 0.25)));
    const peaks = [];
    for (let x = 1; x < n - 1; x++) {
      if (smooth[x] < smooth[x - 1] || smooth[x] <= smooth[x + 1]) continue;
      let left = smooth[x], right = smooth[x];
      for (let d = 1; d <= 5; d++) { left = Math.min(left, smooth[Math.max(0, x - d)]); right = Math.min(right, smooth[Math.min(n - 1, x + d)]); }
      const prominence = smooth[x] - Math.max(left, right);
      if (smooth[x] - baseline < noise * 1.4 || prominence < noise * 0.7) continue;
      // Refine the smoothed peak back to the strongest pixel boundary without moving its neighborhood.
      let at = x;
      for (let t = Math.max(1, x - 1); t <= Math.min(n - 1, x + 1); t++) if (scores[t] > scores[at]) at = t;
      const peak = { x: at, strength: smooth[x] - baseline, prominence, reward: Math.log1p(prominence / noise) - 1.1 };
      const last = peaks[peaks.length - 1];
      if (last && peak.x - last.x <= 2) { if (peak.strength > last.strength) peaks[peaks.length - 1] = peak; }
      else peaks.push(peak);
    }
    return { smooth, baseline, noise, peaks };
  }
  function localSpacing(peaks, x, fallback) {
    const nearby = peaks.map((p, i) => ({ p, i })).sort((a, b) => Math.abs(a.p.x - x) - Math.abs(b.p.x - x)).slice(0, 10).sort((a, b) => a.i - b.i);
    const gaps = nearby.slice(1).map((v, i) => v.p.x - nearby[i].p.x).filter(v => v > 3);
    return quantile(gaps, 0.6) || fallback;
  }
  function snapBoundary(scores, value, radius = 6, min = 1, max = scores.length - 1, evidence = null) {
    const info = evidence || gradientPeaks(scores);
    let best = value, merit = -Infinity;
    for (const peak of info.peaks) {
      if (peak.x < min || peak.x > max || Math.abs(peak.x - value) > radius || peak.reward <= 0) continue;
      const score = peak.reward - 0.8 * Math.abs(peak.x - value) / Math.max(1, radius);
      if (score > merit) { merit = score; best = peak.x; }
    }
    return best;
  }
  function refineAxis(scores, lines, radius = 6) {
    const evidence = gradientPeaks(scores);
    // Midpoints keep neighboring lines in disjoint search intervals, preserving their identity and order.
    return lines.map((v, i) => i === 0 || i === lines.length - 1 ? v : snapBoundary(scores, v, radius, (lines[i - 1] + v) / 2 + 0.25, (v + lines[i + 1]) / 2 - 0.25, evidence));
  }
  const Grid = typeof module !== 'undefined' && module.exports ? require('./grid.js') : root.PixelGrid;
  function detectAxis(scores, options = {}) { return Grid.detect(scores, gradientPeaks(scores), options); }
  function detectGrid(image, options = {}) { return { x: detectAxis(projection(image, 'x'), options), y: detectAxis(projection(image, 'y'), options) }; }
  function purityIntegral(image) {
    const { width, height, data } = image, stride = width + 1;
    const sums = Array.from({ length: 5 }, () => new Float64Array(stride * (height + 1)));
    const weights = [0.25, 0.5, 0.25, 0.25];
    for (let y = 0; y < height; y++) {
      const row = [0, 0, 0, 0, 0];
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4, a = data[p + 3] / 255;
        const channels = [data[p] * a, data[p + 1] * a, data[p + 2] * a, data[p + 3]];
        let square = 0;
        for (let k = 0; k < 4; k++) { row[k] += channels[k]; square += weights[k] * channels[k] ** 2; }
        row[4] += square;
        const at = (y + 1) * stride + x + 1;
        for (let k = 0; k < 5; k++) sums[k][at] = sums[k][at - stride] + row[k];
      }
    }
    return (x0, y0, x1, y1) => {
      x0 = clamp(Math.round(x0), 0, width); x1 = clamp(Math.round(x1), 0, width);
      y0 = clamp(Math.round(y0), 0, height); y1 = clamp(Math.round(y1), 0, height);
      const area = (x1 - x0) * (y1 - y0); if (area <= 0) return 0;
      const a = y0 * stride + x0, b = y0 * stride + x1, c = y1 * stride + x0, d = y1 * stride + x1;
      let error = sums[4][d] - sums[4][b] - sums[4][c] + sums[4][a];
      for (let k = 0; k < 4; k++) { const sum = sums[k][d] - sums[k][b] - sums[k][c] + sums[k][a]; error -= weights[k] * sum * sum / area; }
      return Math.max(0, error / 65025);
    };
  }
  function refineGrid(image, originalX, originalY, options = {}) {
    const radius = clamp(options.radius ?? 6, 1, 40), passes = clamp(options.passes ?? 3, 1, 5);
    const axes = { x: [...originalX], y: [...originalY] }, initial = { x: originalX, y: originalY };
    const gradients = options.gradients || { x: projection(image, 'x'), y: projection(image, 'y') };
    const evidence = { x: gradientPeaks(gradients.x), y: gradientPeaks(gradients.y) };
    const error = purityIntegral(image), review = [], suggestions = { x: [], y: [] };
    function bandLoss(axis, left, right, split = null) {
      const other = axis === 'x' ? axes.y : axes.x; let loss = 0;
      for (let j = 0; j < other.length - 1; j++) {
        const cell = (a, b) => axis === 'x' ? error(a, other[j], b, other[j + 1]) : error(other[j], a, other[j + 1], b);
        loss += split === null ? cell(left, right) : cell(left, split) + cell(split, right);
      }
      return loss;
    }
    let iterations = 0;
    for (let pass = 0; pass < passes; pass++) {
      let changed = false;
      // Alternate opposite borders and axes so corrections proceed from the outside toward the center.
      for (let depth = 1; depth < Math.max(axes.x.length, axes.y.length) / 2; depth++) for (const axis of ['x', 'y']) {
        const lines = axes[axis];
        for (const i of new Set([depth, lines.length - 1 - depth])) {
          if (i < 1 || i >= lines.length - 1 || depth > (lines.length - 1) / 2) continue;
          const origin = initial[axis][i], current = lines[i];
          const min = Math.ceil(Math.max(lines[i - 1] + 1, origin - radius)), max = Math.floor(Math.min(lines[i + 1] - 1, origin + radius));
          if (min > max) continue;
          const base = bandLoss(axis, lines[i - 1], lines[i + 1], current);
          if (base < 1e-8) continue;
          const gradient = x => Math.log1p(gradients[axis][Math.round(x)] / Math.max(0.12, evidence[axis].noise));
          const objective = (x, loss) => loss / base + 0.015 * ((x - origin) / radius) ** 2 - 0.025 * gradient(x);
          let best = current, bestScore = objective(current, base);
          for (let x = min; x <= max; x++) {
            const loss = bandLoss(axis, lines[i - 1], lines[i + 1], x);
            if (loss > base + 1e-10) continue;
            const score = objective(x, loss);
            if (score < bestScore - 1e-6) { best = x; bestScore = score; }
          }
          if (best !== current) { lines[i] = best; changed = true; }
        }
      }
      iterations++; if (!changed) break;
    }
    for (const axis of ['x', 'y']) {
      const lines = axes[axis], peaks = evidence[axis].peaks;
      for (let i = 1; i < lines.length - 1; i++) {
        const origin = initial[axis][i], base = bandLoss(axis, lines[i - 1], lines[i + 1], lines[i]);
        const outside = peaks.filter(p => Math.abs(p.x - origin) > radius && Math.abs(p.x - origin) <= radius * 2 && p.x > lines[i - 1] + 1 && p.x < lines[i + 1] - 1);
        if (outside.some(p => bandLoss(axis, lines[i - 1], lines[i + 1], p.x) < base * 0.9)) review.push({ axis, index: i, position: lines[i], reason: 'movement-limit' });
      }
      const gaps = lines.slice(1).map((v, i) => v - lines[i]);
      for (let i = 0; i < gaps.length; i++) {
        const nearby = gaps.slice(Math.max(0, i - 4), i).concat(gaps.slice(i + 1, i + 5)).filter(v => v >= 2);
        const typical = quantile(nearby, 0.5); if (!typical) continue;
        if (gaps[i] < Math.max(1, typical * (options.narrowRatio ?? Grid.DEFAULTS.narrowRatio))) { review.push({ axis, index: i, position: lines[i], reason: 'narrow-cell' }); continue; }
        if (gaps[i] <= typical * (options.wideRatio ?? Grid.DEFAULTS.wideRatio)) continue;
        const left = lines[i], right = lines[i + 1], base = bandLoss(axis, left, right);
        const margin = Math.max(2, typical * 0.3); let best = null;
        for (const p of peaks) {
          if (p.x <= left + margin || p.x >= right - margin || p.reward <= 0.3 || base < 1e-8) continue;
          const gain = (base - bandLoss(axis, left, right, p.x)) / base;
          if (gain > 0.12 && (!best || gain * p.reward > best.score)) best = { position: p.x, gain, score: gain * p.reward };
        }
        if (best && lines.length - 1 + suggestions[axis].length < 128) suggestions[axis].push(best);
        else review.push({ axis, index: i, position: left, reason: 'wide-cell' });
      }
    }
    const moved = ['x', 'y'].reduce((sum, axis) => sum + axes[axis].filter((v, i) => v !== initial[axis][i]).length, 0);
    return { xs: axes.x, ys: axes.y, suggestions, review, moved, iterations };
  }
  function cellRect(xs, ys, col, row, overrides = {}) {
    return overrides[`${col},${row}`] || { x: xs[col], y: ys[row], w: xs[col + 1] - xs[col], h: ys[row + 1] - ys[row] };
  }
  function fitRect(rect, width, height) {
    const w = clamp(rect.w, 1, width), h = clamp(rect.h, 1, height);
    return { x: clamp(rect.x, 0, width - w), y: clamp(rect.y, 0, height - h), w, h };
  }
  function sampleCell(image, rect, threshold = 16, edgeWeight = 0.35, cache = new Map()) {
    const { width, height, data } = image;
    rect = fitRect(rect, width, height);
    const left = Math.max(0, Math.floor(rect.x)), top = Math.max(0, Math.floor(rect.y));
    const right = Math.min(width, Math.ceil(rect.x + rect.w)), bottom = Math.min(height, Math.ceil(rect.y + rect.h));
    const nx = Math.min(12, right - left), ny = Math.min(12, bottom - top);
    const bins = new Map();
    let total = 0, transparent = 0;
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const x = left + Math.floor((ix + 0.5) * (right - left) / nx), y = top + Math.floor((iy + 0.5) * (bottom - top) / ny);
      const i = (y * width + x) * 4;
      const fx = (x + 0.5 - rect.x) / rect.w, fy = (y + 0.5 - rect.y) / rect.h;
      const weight = Math.min(fx, fy, 1 - fx, 1 - fy) < 0.18 ? edgeWeight : 1;
      if (weight <= 0) continue;
      total += weight;
      if (data[i + 3] < 16) { transparent += weight; continue; }
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      const key = `${r >> 3},${g >> 3},${b >> 3},${a >> 4}`;
      let bin = bins.get(key);
      if (!bin) {
        const rgbKey = (r << 16) | (g << 8) | b;
        let l = cache.get(rgbKey);
        if (!l) { l = lab(r, g, b); if (cache.size < 100000) cache.set(rgbKey, l); }
        bin = { color: [r, g, b, a], lab: l, weight: 0 }; bins.set(key, bin);
      }
      bin.weight += weight;
    }
    if (!total) {
      const i = (Math.min(height - 1, Math.floor(rect.y + rect.h / 2)) * width + Math.min(width - 1, Math.floor(rect.x + rect.w / 2))) * 4;
      return { color: Array.from(data.slice(i, i + 4)), confidence: 1 };
    }
    const clusters = [];
    for (const bin of [...bins.values()].sort((a, b) => b.weight - a.weight)) {
      let nearest = null, d = threshold ** 2;
      for (const cluster of clusters) {
        const dist = distance2(cluster.lab, bin.lab) + ((cluster.color[3] - bin.color[3]) / 2.55) ** 2;
        if (dist <= d) { nearest = cluster; d = dist; }
      }
      if (nearest) nearest.weight += bin.weight;
      else clusters.push({ ...bin });
    }
    clusters.sort((a, b) => b.weight - a.weight);
    if (!clusters.length || transparent > clusters[0].weight) return { color: [0, 0, 0, 0], confidence: transparent / total };
    return { color: clusters[0].color, confidence: clusters[0].weight / total };
  }
  function meanCell(image, rect) {
    rect = fitRect(rect, image.width, image.height);
    const sums = [0, 0, 0]; let alpha = 0, count = 0;
    for (let y = Math.floor(rect.y); y < Math.ceil(rect.y + rect.h); y++) for (let x = Math.floor(rect.x); x < Math.ceil(rect.x + rect.w); x++) {
      const weight = Math.max(0, Math.min(x + 1, rect.x + rect.w) - Math.max(x, rect.x)) * Math.max(0, Math.min(y + 1, rect.y + rect.h) - Math.max(y, rect.y));
      const i = (y * image.width + x) * 4;
      if (image.data[i + 3] === 0) continue;
      const a = image.data[i + 3] * weight;
      for (let k = 0; k < 3; k++) sums[k] += image.data[i + k] * a;
      alpha += a; count += weight;
    }
    return { color: alpha ? [...sums.map(v => Math.round(v / alpha)), Math.round(alpha / count)] : [0, 0, 0, 0], confidence: 1 };
  }
  function mergeLines(lines, indices) {
    const selected = [...new Set(indices)].sort((a, b) => a - b);
    if (selected.length < 2 || selected.some((v, i) => !Number.isInteger(v) || v <= 0 || v >= lines.length - 1 || i > 0 && v !== selected[i - 1] + 1)) throw Error('只能合并连续的内部网格线');
    const mean = selected.reduce((sum, i) => sum + lines[i], 0) / selected.length;
    return [...lines.slice(0, selected[0]), mean, ...lines.slice(selected.at(-1) + 1)];
  }
  function repairInterval(lines, issue, scores, options = {}) {
    const i = lines.findIndex((v, k) => v === issue.start && lines[k + 1] === issue.end);
    if (i < 0) return { lines, reason: '此区间已改变' };
    if (issue.reason === 'narrow') {
      if (lines.length <= 2) return { lines, reason: '没有可合并的内部边界' };
      // The image perimeter stays fixed when a cropped border cell is merged.
      const next = i === 0 ? lines.filter((_, k) => k !== 1) : i === lines.length - 2 ? lines.filter((_, k) => k !== i) : mergeLines(lines, [i, i + 1]);
      return { lines: next };
    }
    const count = Math.max(2, Math.round(issue.gap / Math.max(1, issue.expected))), capacity = 129 - lines.length;
    if (count - 1 > capacity) return { lines, reason: '切分后超过 128 格上限' };
    const step = issue.gap / count, inserted = [], evidence = gradientPeaks(scores);
    for (let k = 1; k < count; k++) {
      const target = issue.start + k * step, radius = Math.min(step * (options.searchRatio ?? 0.35), step * 0.45);
      inserted.push(snapBoundary(scores, target, radius, target - radius, target + radius, evidence));
    }
    const next = [...lines.slice(0, i + 1), ...inserted, ...lines.slice(i + 1)];
    if (next.some((v, k) => k > 0 && v - next[k - 1] < 0.5)) return { lines, reason: '切分间距不足' };
    return { lines: next };
  }
  function remapOverrides(oldX, oldY, newX, newY, samples, colors, cellModes = {}) {
    const nextSamples = {}, nextColors = {}, nextModes = {};
    for (let row = 0; row < newY.length - 1; row++) for (let col = 0; col < newX.length - 1; col++) {
      const x = (newX[col] + newX[col + 1]) / 2, y = (newY[row] + newY[row + 1]) / 2;
      const key = `${oldX.findIndex(v => v > x) - 1},${oldY.findIndex(v => v > y) - 1}`, next = `${col},${row}`;
      if (samples[key]) nextSamples[next] = { ...samples[key] };
      if (colors[key]) nextColors[next] = [...colors[key]];
      if (cellModes[key]) nextModes[next] = cellModes[key];
    }
    return { samples: nextSamples, colors: nextColors, cellModes: nextModes };
  }
  function renderPixels(image, xs, ys, samples, colors, threshold, edgeWeight, samplingMode = 'mode', issueThreshold = 0.65, cellModes = {}) {
    const width = xs.length - 1, height = ys.length - 1;
    const data = new Uint8ClampedArray(width * height * 4), issues = [], modes = [], palette = new Map(), cache = new Map();
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
      const key = `${col},${row}`, rect = cellRect(xs, ys, col, row, samples);
      const mode = colors[key] ? 'manual' : cellModes[key] || samplingMode;
      const result = mode === 'manual' ? { color: colors[key], confidence: 1 } : mode === 'mean' ? meanCell(image, rect) : sampleCell(image, rect, threshold, edgeWeight, cache);
      modes.push(mode);
      data.set(result.color, (row * width + col) * 4);
      if (mode === 'mode' && result.confidence < issueThreshold) issues.push({ col, row, confidence: result.confidence });
      if (result.color[3] > 0) { const hex = result.color.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join(''); palette.set(hex, (palette.get(hex) || 0) + 1); }
    }
    return { width, height, data, issues, modes, palette: [...palette].sort((a, b) => b[1] - a[1]) };
  }
  function validateProject(p) {
    if (!p || p.version !== 1 || typeof p.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(p.image) || p.image.length > 40e6) throw Error('项目格式无效');
    if (!Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 1 || p.height < 1 || p.width > 2048 || p.height > 2048) throw Error('项目图片尺寸无效');
    for (const [key, size] of [['xs', p.width], ['ys', p.height]]) {
      const lines = p[key];
      if (!Array.isArray(lines) || lines.length < 2 || lines.length > 129 || lines[0] !== 0 || lines[lines.length - 1] !== size || lines.some((v, i) => !Number.isFinite(v) || (i > 0 && v - lines[i - 1] < 0.5))) throw Error('项目网格无效');
    }
    if (!Number.isFinite(p.threshold) || p.threshold < 2 || p.threshold > 40 || !Number.isFinite(p.edgeWeight) || p.edgeWeight < 0 || p.edgeWeight > 1) throw Error('项目取色参数无效');
    if (p.spacingWeight !== undefined && (!Number.isFinite(p.spacingWeight) || p.spacingWeight < 0 || p.spacingWeight > 1)) throw Error('项目间距约束无效');
    if (p.multiColorThreshold !== undefined && (!Number.isFinite(p.multiColorThreshold) || p.multiColorThreshold < 0 || p.multiColorThreshold > 1)) throw Error('项目多色阈值无效');
    if (p.samplingMode !== undefined && !['mode', 'mean'].includes(p.samplingMode)) throw Error('项目取色方式无效');
    if (p.hasGrid !== undefined && typeof p.hasGrid !== 'boolean') throw Error('项目识别状态无效');
    if (p.gridOptionsPending !== undefined && typeof p.gridOptionsPending !== 'boolean') throw Error('项目间距应用状态无效');
    if (p.gridOptions !== undefined) {
      const options = p.gridOptions;
      if (!options || typeof options !== 'object' || Array.isArray(options)) throw Error('项目网格参数无效');
      const ranges = { searchRatio: [0, 1], localWindow: [64, 1024], localWindowRatio: [0.01, 1], narrowRatio: [0, 1], wideRatio: [1, 3], hintX: [0, 512], hintY: [0, 512] };
      for (const [key, value] of Object.entries(options)) {
        if (key === 'aggressive') { if (typeof value !== 'boolean') throw Error('项目自动修正参数无效'); }
        else if (!Object.hasOwn(ranges, key) || !Number.isFinite(value) || value < ranges[key][0] || value > ranges[key][1]) throw Error('项目网格参数无效');
      }
      if (options.localWindow !== undefined && !Number.isInteger(options.localWindow)) throw Error('局部窗口必须为整数');
    }
    for (const field of ['samples', 'colors', 'cellModes']) {
      if (field === 'cellModes' && p[field] === undefined) continue;
      if (!p[field] || typeof p[field] !== 'object' || Array.isArray(p[field])) throw Error('项目格子数据无效');
      for (const [key, value] of Object.entries(p[field])) {
        if (!/^\d+,\d+$/.test(key)) throw Error('项目坐标无效');
        const [x, y] = key.split(',').map(Number);
        if (x >= p.xs.length - 1 || y >= p.ys.length - 1) throw Error('项目坐标越界');
        if (field === 'cellModes' && !['mode', 'mean'].includes(value)) throw Error('项目格子取色方式无效');
        if (field === 'colors' && (!Array.isArray(value) || value.length !== 4 || value.some(v => !Number.isInteger(v) || v < 0 || v > 255))) throw Error('项目颜色无效');
        if (field === 'samples' && (!value || !['x', 'y', 'w', 'h'].every(k => Number.isFinite(value[k])) || value.x < 0 || value.y < 0 || value.w < 1 || value.h < 1 || value.x + value.w > p.width + 0.01 || value.y + value.h > p.height + 0.01)) throw Error('项目取样区域无效');
      }
    }
    return p;
  }
  const api = { clamp, lab, distance2, uniformLines, pitchLines, projection, gradientPeaks, Grid, snapBoundary, refineAxis, detectAxis, detectGrid, refineGrid, cellRect, fitRect, sampleCell, meanCell, mergeLines, repairInterval, remapOverrides, renderPixels, validateProject };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PixelCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
