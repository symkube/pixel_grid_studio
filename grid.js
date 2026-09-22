/* Local spacing estimation and sequential tracking. Used by core.js in both Node and the browser. */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const median = values => { const a = [...values].sort((a, b) => a - b); return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : 0; };
  const DEFAULTS = { searchRatio: 0.35, narrowRatio: 0.6, wideRatio: 1.65, localWindow: 256, aggressive: true, hintX: 0, hintY: 0 };
  function settings(options = {}) {
    return { ...DEFAULTS, ...options,
      spacingWeight: clamp(options.spacingWeight ?? 0.15, 0, 1),
      searchRatio: clamp(options.searchRatio ?? DEFAULTS.searchRatio, 0, 1),
      narrowRatio: clamp(options.narrowRatio ?? DEFAULTS.narrowRatio, 0, 1),
      wideRatio: clamp(options.wideRatio ?? DEFAULTS.wideRatio, 1, 3),
      localWindow: Math.round(clamp(options.localWindow ?? DEFAULTS.localWindow, 64, 1024)),
      pitchHint: clamp(options.pitchHint ?? 0, 0, 512),
    };
  }
  // Normalized autocorrelation is the spatial counterpart of power-spectrum analysis.
  // It estimates periods in overlapping local windows; it never supplies a grid phase.
  function spacingCandidates(scores, peaks, options = {}) {
    const o = settings(options), n = scores.length;
    const size = Math.min(n, Number.isFinite(o.localWindowRatio) ? Math.max(8, Math.round(n * clamp(o.localWindowRatio, 0.01, 1))) : o.localWindow);
    const windows = [];
    const starts = []; for (let start = 0; ; start += Math.max(1, Math.floor(size / 2))) { const s = Math.min(start, n - size); if (starts.at(-1) !== s) starts.push(s); if (s + size >= n) break; }
    for (const start of starts) {
      const end = start + size, center = (start + end) / 2;
      const region = peaks.filter(p => p.x >= start && p.x < end && p.reward > 0);
      const strong = region.filter(p => p.reward >= Math.max(0.5, median(region.map(p => p.reward)) * 0.6));
      const gaps = strong.slice(1).map((p, i) => p.x - strong[i].x).filter(v => v >= 3);
      const nominal = median(gaps);
      const signal = Array.from({ length: size }, (_, i) => {
        const at = i + start;
        return (scores[at] * 2 + (scores[at - 1] ?? scores[at]) + (scores[at + 1] ?? scores[at])) / 4;
      });
      const mean = signal.reduce((a, b) => a + b, 0) / size;
      const centered = signal.map(v => v - mean), correlations = [];
      for (let lag = 3; lag <= Math.min(128, Math.floor(size / 3)); lag++) {
        let dot = 0, aa = 0, bb = 0;
        for (let i = 0; i < size - lag; i++) { dot += centered[i] * centered[i + lag]; aa += centered[i] ** 2; bb += centered[i + lag] ** 2; }
        correlations.push({ pitch: lag, correlation: dot / Math.sqrt(aa * bb || 1) });
      }
      const candidates = [];
      const add = (pitch, correlation, source) => {
        if (!(pitch >= 3) || !Number.isFinite(pitch)) return;
        const directSupport = gaps.length ? gaps.filter(g => Math.abs(g - pitch) <= Math.max(1, pitch * 0.18)).length / gaps.length : 0;
        const score = Math.max(0, correlation) * 0.55 + directSupport * 0.45;
        const existing = candidates.find(c => Math.abs(c.pitch - pitch) < 1.1);
        const item = { pitch: Math.round(pitch * 10) / 10, correlation, directSupport, score, source };
        if (!existing) candidates.push(item);
        else if (score > existing.score || source === 'edge-gaps' && directSupport >= existing.directSupport) Object.assign(existing, item);
      };
      for (let i = 0; i < correlations.length; i++) {
        const c = correlations[i];
        if (c.correlation < 0.1 || c.correlation < (correlations[i - 1]?.correlation ?? -1) || c.correlation < (correlations[i + 1]?.correlation ?? -1)) continue;
        const left = correlations[i - 1]?.correlation ?? c.correlation, right = correlations[i + 1]?.correlation ?? c.correlation;
        const denom = left - 2 * c.correlation + right;
        const offset = denom ? clamp(0.5 * (left - right) / denom, -0.5, 0.5) : 0;
        add(c.pitch + offset, c.correlation, 'autocorrelation');
      }
      if (nominal) add(nominal, correlations.find(c => c.pitch === Math.round(nominal))?.correlation || 0, 'edge-gaps');
      candidates.sort((a, b) => b.score - a.score || a.pitch - b.pitch);
      windows.push({ start, end, center, candidates: candidates.slice(0, 5) });
    }
    return windows;
  }
  function estimateAt(windows, peaks, x, fallback, hint = 0) {
    if (hint > 0) return hint;
    const window = windows.reduce((a, b) => Math.abs(a.center - x) < Math.abs(b.center - x) ? a : b);
    const candidates = window?.candidates || [];
    const nearby = peaks.filter(p => p.reward > 0.5).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x)).slice(0, 9).sort((a, b) => a.x - b.x);
    const gaps = nearby.slice(1).map((p, i) => p.x - nearby[i].x).filter(v => v >= 3);
    const local = median(gaps) || fallback;
    // Close local evidence outranks a period that merely repeats at twice the actual cell size.
    const eligible = candidates.filter(c => c.pitch >= local * 0.65 && c.pitch <= local * 1.45);
    const candidate = eligible[0];
    return Math.max(3, candidate ? local * 0.65 + candidate.pitch * 0.35 : local);
  }
  function diagnostics(lines, scores, peaks, windows, options = {}) {
    const o = settings(options), fallback = median(lines.slice(1).map((v, i) => v - lines[i])) || scores.length;
    const anomalies = [];
    for (let i = 0; i < lines.length - 1; i++) {
      const gap = lines[i + 1] - lines[i], expected = estimateAt(windows, peaks, (lines[i] + lines[i + 1]) / 2, fallback, o.pitchHint);
      const reason = gap < expected * o.narrowRatio ? 'narrow' : gap > expected * o.wideRatio ? 'wide' : null;
      if (reason) anomalies.push({ index: i, start: lines[i], end: lines[i + 1], gap, expected, reason, border: i === 0 || i === lines.length - 2 });
    }
    return anomalies;
  }
  function detect(scores, evidence, options = {}) {
    const o = settings(options), n = scores.length, peaks = evidence.peaks.filter(p => p.reward > 0);
    const windows = spacingCandidates(scores, peaks, o), edits = { inserted: [], merged: [] };
    if (!peaks.length) return { lines: [0, n], pitch: n, confidence: 0, irregular: [], conflicts: [], anomalies: [], windows, edits, limitExceeded: false };
    const fallback = median(peaks.slice(1).map((p, i) => p.x - peaks[i].x)) || n;
    let entries = [{ x: 0, inferred: false }];
    if (o.spacingWeight === 0 || !o.aggressive) entries.push(...peaks.map(p => ({ x: p.x, inferred: false })));
    else {
      let previous = 0, lastGap = null;
      for (let step = 0; step < n && previous < n - 1; step++) {
        let pitch = estimateAt(windows, peaks, previous, fallback, o.pitchHint);
        if (lastGap && !o.pitchHint && lastGap > pitch * 0.65 && lastGap < pitch * 1.45) pitch = pitch * 0.7 + lastGap * 0.3;
        const target = previous + pitch, radius = Math.max(1, pitch * o.searchRatio);
        const rest = peaks.filter(p => p.x > previous + 0.5);
        if (target >= n - pitch * 0.25) {
          const borderPeak = rest.find(p => p.x < n - 1 && p.x - previous >= pitch * o.narrowRatio && p.reward > 0.5);
          if (borderPeak) entries.push({ x: borderPeak.x, inferred: false });
          break;
        }
        const candidates = rest.filter(p => Math.abs(p.x - target) <= radius && p.x - previous >= pitch * o.narrowRatio && p.x - previous <= pitch * o.wideRatio);
        // Permit a cropped first cell when its border has strong evidence.
        if (previous === 0 && rest[0]?.x < pitch * o.narrowRatio && rest[0].reward > 1) candidates.push(rest[0]);
        let best = null, bestScore = -Infinity;
        for (const p of candidates) {
          const deviation = (p.x - target) / radius;
          const score = Math.log1p(p.reward) - o.spacingWeight * 8 * deviation ** 2;
          if (score > bestScore) { best = p; bestScore = score; }
        }
        if (best) {
          for (const p of rest) if (p.x < best.x && p.x - previous < pitch * o.narrowRatio) edits.merged.push(p.x);
          const next = best.x; lastGap = next - previous; previous = next;
          entries.push({ x: next, inferred: false });
        } else {
          const nextPeak = rest[0];
          if (nextPeak && nextPeak.x - previous <= pitch * o.wideRatio) {
            if (nextPeak.x - previous < pitch * o.narrowRatio) {
              edits.merged.push(nextPeak.x);
              const stronger = rest.find(p => p.x - previous >= pitch * o.narrowRatio);
              if (stronger && stronger.x - previous <= pitch * o.wideRatio) { lastGap = stronger.x - previous; previous = stronger.x; entries.push({ x: previous, inferred: false }); continue; }
            } else { lastGap = nextPeak.x - previous; previous = nextPeak.x; entries.push({ x: previous, inferred: false }); continue; }
          }
          if (n - previous <= pitch * o.wideRatio && !nextPeak) break;
          const next = Math.round(target);
          if (next <= previous || next >= n) break;
          entries.push({ x: next, inferred: true }); edits.inserted.push(next); previous = next;
        }
      }
    }
    entries.push({ x: n, inferred: false });
    entries = entries.filter((p, i, a) => !i || p.x > a[i - 1].x);
    const limitExceeded = entries.length > 129;
    if (limitExceeded) entries = [entries[0], ...entries.slice(1, -1).sort((a, b) => (scores[b.x] || 0) - (scores[a.x] || 0)).slice(0, 127).sort((a, b) => a.x - b.x), entries.at(-1)];
    const lines = entries.map(p => p.x), irregular = entries.flatMap((p, i) => p.inferred ? [i] : []);
    edits.inserted = entries.filter(p => p.inferred).map(p => p.x);
    edits.merged = [...new Set(edits.merged)].filter(x => !lines.includes(x));
    const conflicts = peaks.filter(p => p.reward > 1 && !lines.some(x => Math.abs(x - p.x) <= 2)).map(p => p.x);
    const support = entries.slice(1, -1).map(p => p.inferred ? 0 : clamp((scores[p.x] - evidence.baseline) / (evidence.noise * 8), 0, 1));
    return { lines, pitch: median(lines.slice(1).map((v, i) => v - lines[i])), confidence: support.reduce((a, b) => a + b, 0) / Math.max(1, support.length), irregular, conflicts, windows, edits, limitExceeded, anomalies: diagnostics(lines, scores, peaks, windows, o) };
  }
  const api = { DEFAULTS, settings, spacingCandidates, estimateAt, diagnostics, detect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PixelGrid = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
