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
    const stride = Math.max(1, Math.floor(across / 256));
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
  function detectAxis(scores) {
    const n = scores.length;
    const minPitch = Math.max(3, Math.ceil(n / 127));
    const maxPitch = Math.min(128, Math.floor(n / 3));
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    if (mean < 0.15 || maxPitch < minPitch) return { lines: uniformLines(n, Math.min(32, n)), pitch: n / Math.min(32, n), confidence: 0, irregular: [] };
    const centered = Array.from(scores, v => v - mean);
    const correlations = [];
    for (let p = minPitch; p <= maxPitch; p++) {
      let dot = 0, aa = 0, bb = 0;
      for (let i = 1; i < n - p; i++) {
        dot += centered[i] * centered[i + p]; aa += centered[i] ** 2; bb += centered[i + p] ** 2;
      }
      correlations.push({ pitch: p, score: dot / Math.sqrt(aa * bb || 1) });
    }
    const best = Math.max(...correlations.map(c => c.score));
    // Prefer a credible fundamental period over a stronger multiple caused by repeated motifs.
    const candidates = correlations.filter((c, i, a) => c.score >= best * 0.72 && c.score >= (a[i - 1]?.score ?? -1) && c.score >= (a[i + 1]?.score ?? -1));
    const pitch = (candidates[0] || correlations.reduce((a, b) => a.score > b.score ? a : b)).pitch;
    let phase = 0, phaseScore = -Infinity;
    for (let off = 0; off < pitch; off++) {
      let sum = 0, count = 0;
      for (let x = off || pitch; x < n; x += pitch) { sum += scores[x]; count++; }
      if (sum / count > phaseScore) { phaseScore = sum / count; phase = off; }
    }
    const lines = [0], irregular = [];
    const radius = Math.max(1, Math.floor(pitch * 0.24));
    // A narrow search around a periodic scaffold prevents content edges from adding cells.
    for (let ideal = phase || pitch; ideal < n - pitch * 0.3; ideal += pitch) {
      if (ideal < pitch * 0.3) continue;
      let at = ideal, value = -Infinity;
      for (let x = Math.max(1, ideal - radius); x <= Math.min(n - 1, ideal + radius); x++) {
        const merit = scores[x] - Math.abs(x - ideal) * mean * 0.22;
        if (merit > value) { value = merit; at = x; }
      }
      if (at <= lines[lines.length - 1]) continue;
      if (Math.abs(at - ideal) > pitch * 0.15) irregular.push(lines.length);
      lines.push(at);
    }
    lines.push(n);
    return { lines, pitch, confidence: clamp(best, 0, 1), irregular };
  }
  function detectGrid(image) { return { x: detectAxis(projection(image, 'x')), y: detectAxis(projection(image, 'y')) }; }
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
  function renderPixels(image, xs, ys, samples, colors, threshold, edgeWeight) {
    const width = xs.length - 1, height = ys.length - 1;
    const data = new Uint8ClampedArray(width * height * 4), issues = [], palette = new Map(), cache = new Map();
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
      const key = `${col},${row}`, result = colors[key] ? { color: colors[key], confidence: 1 } : sampleCell(image, cellRect(xs, ys, col, row, samples), threshold, edgeWeight, cache);
      data.set(result.color, (row * width + col) * 4);
      if (result.confidence < 0.65) issues.push({ col, row, confidence: result.confidence });
      if (result.color[3] > 0) { const hex = result.color.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join(''); palette.set(hex, (palette.get(hex) || 0) + 1); }
    }
    return { width, height, data, issues, palette: [...palette].sort((a, b) => b[1] - a[1]) };
  }
  function validateProject(p) {
    if (!p || p.version !== 1 || typeof p.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(p.image) || p.image.length > 40e6) throw Error('项目格式无效');
    if (!Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 1 || p.height < 1 || p.width > 2048 || p.height > 2048) throw Error('项目图片尺寸无效');
    for (const [key, size] of [['xs', p.width], ['ys', p.height]]) {
      const lines = p[key];
      if (!Array.isArray(lines) || lines.length < 2 || lines.length > 129 || lines[0] !== 0 || lines[lines.length - 1] !== size || lines.some((v, i) => !Number.isFinite(v) || (i > 0 && v - lines[i - 1] < 0.5))) throw Error('项目网格无效');
    }
    if (!Number.isFinite(p.threshold) || p.threshold < 2 || p.threshold > 40 || !Number.isFinite(p.edgeWeight) || p.edgeWeight < 0 || p.edgeWeight > 1) throw Error('项目取色参数无效');
    for (const field of ['samples', 'colors']) {
      if (!p[field] || typeof p[field] !== 'object' || Array.isArray(p[field])) throw Error('项目格子数据无效');
      for (const [key, value] of Object.entries(p[field])) {
        if (!/^\d+,\d+$/.test(key)) throw Error('项目坐标无效');
        const [x, y] = key.split(',').map(Number);
        if (x >= p.xs.length - 1 || y >= p.ys.length - 1) throw Error('项目坐标越界');
        if (field === 'colors' && (!Array.isArray(value) || value.length !== 4 || value.some(v => !Number.isInteger(v) || v < 0 || v > 255))) throw Error('项目颜色无效');
        if (field === 'samples' && (!value || !['x', 'y', 'w', 'h'].every(k => Number.isFinite(value[k])) || value.x < 0 || value.y < 0 || value.w < 1 || value.h < 1 || value.x + value.w > p.width + 0.01 || value.y + value.h > p.height + 0.01)) throw Error('项目取样区域无效');
      }
    }
    return p;
  }
  const api = { clamp, lab, distance2, uniformLines, pitchLines, projection, detectAxis, detectGrid, cellRect, fitRect, sampleCell, renderPixels, validateProject };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PixelCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
