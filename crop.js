(() => {
  'use strict';
  const $ = id => document.getElementById(id), canvas = $('crop-canvas'), ctx = canvas.getContext('2d');
  const dialog = $('crop-dialog'), lens = $('crop-lens'), lctx = lens.getContext('2d');
  const keys = ['x', 'y', 'w', 'h'];
  let source, rect, drag, resolveCrop, view, drawing = false, focus = { x: 0, y: 0 };
  function drawingMode(value) { drawing = value; $('crop-new').setAttribute('aria-pressed', value); $('crop-new').classList.toggle('active', value); canvas.style.cursor = value ? 'crosshair' : 'default'; }
  function valid() { return keys.every(k => Number.isSafeInteger(rect[k])) && rect.w > 0 && rect.h > 0 && Number.isSafeInteger(rect.x + rect.w) && Number.isSafeInteger(rect.y + rect.h); }
  function status() {
    const ok = valid(); $('crop-apply').disabled = !ok;
    $('crop-error').textContent = ok ? '' : '请输入整数坐标和大于 0 的宽高';
    const notes = [];
    if (ok && (rect.x < 0 || rect.y < 0 || rect.x + rect.w > source.width || rect.y + rect.h > source.height)) notes.push('超出原图的部分将保留透明');
    if (ok && Math.max(rect.w, rect.h) > 2048) notes.push('导入工作图时将按比例缩小至最长边 2048 像素');
    $('crop-extent').textContent = notes.join('；');
    return ok;
  }
  function syncInputs() { for (const k of keys) $('crop-' + k).value = rect[k]; }
  function frame() {
    const ok = valid(), left = ok ? Math.min(0, rect.x) : 0, top = ok ? Math.min(0, rect.y) : 0;
    const right = ok ? Math.max(source.width, rect.x + rect.w) : source.width, bottom = ok ? Math.max(source.height, rect.y + rect.h) : source.height;
    const scale = Math.min((canvas.width - 60) / (right - left), (canvas.height - 60) / (bottom - top));
    view = { scale, x: (canvas.width - (right - left) * scale) / 2 - left * scale, y: (canvas.height - (bottom - top) * scale) / 2 - top * scale };
  }
  function handles() {
    const l = rect.x, r = l + rect.w, t = rect.y, b = t + rect.h, cx = (l + r) / 2, cy = (t + b) / 2;
    return [['nw', l, t], ['n', cx, t], ['ne', r, t], ['e', r, cy], ['se', r, b], ['s', cx, b], ['sw', l, b], ['w', l, cy]];
  }
  function drawLens() {
    const scale = 8, half = lens.width / (2 * scale);
    lctx.clearRect(0, 0, lens.width, lens.height); lctx.imageSmoothingEnabled = false;
    lctx.drawImage(source, (half - focus.x) * scale, (half - focus.y) * scale, source.width * scale, source.height * scale);
    if (valid()) { lctx.strokeStyle = '#f3b34d'; lctx.lineWidth = 2; lctx.strokeRect((rect.x - focus.x + half) * scale, (rect.y - focus.y + half) * scale, rect.w * scale, rect.h * scale); }
    const c = lens.width / 2;
    for (const [color, width] of [['#000b', 3], ['#fff', 1]]) {
      lctx.strokeStyle = color; lctx.lineWidth = width; lctx.beginPath();
      lctx.moveTo(c - 12, c); lctx.lineTo(c + 12, c); lctx.moveTo(c, c - 12); lctx.lineTo(c, c + 12); lctx.stroke();
    }
    $('crop-focus').textContent = `X ${focus.x} · Y ${focus.y} · 8×`;
  }
  function draw() {
    if (!source || !view) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, view.x, view.y, source.width * view.scale, source.height * view.scale);
    if (valid()) {
      const x = view.x + rect.x * view.scale, y = view.y + rect.y * view.scale, w = rect.w * view.scale, h = rect.h * view.scale;
      ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.rect(0, 0, canvas.width, canvas.height); ctx.rect(x, y, w, h); ctx.fill('evenodd');
      const pixel = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * pixel; ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = '#216aaf'; ctx.lineWidth = pixel; ctx.strokeRect(x, y, w, h);
      for (const [, hx, hy] of handles()) {
        const px = view.x + hx * view.scale, py = view.y + hy * view.scale, radius = 4 * pixel;
        ctx.fillStyle = '#fff'; ctx.fillRect(px - radius, py - radius, 2 * radius, 2 * radius); ctx.strokeRect(px - radius, py - radius, 2 * radius, 2 * radius);
      }
    }
    drawLens();
  }
  function point(e) {
    const b = canvas.getBoundingClientRect();
    return { x: Math.round(((e.clientX - b.left) / b.width * canvas.width - view.x) / view.scale), y: Math.round(((e.clientY - b.top) / b.height * canvas.height - view.y) / view.scale) };
  }
  function defaultRect() {
    const probe = document.createElement('canvas'), scale = Math.min(1, 2048 / Math.max(source.width, source.height));
    probe.width = Math.max(1, Math.round(source.width * scale)); probe.height = Math.max(1, Math.round(source.height * scale));
    const pc = probe.getContext('2d', { willReadFrequently: true }); pc.drawImage(source, 0, 0, probe.width, probe.height);
    const { data, width, height } = pc.getImageData(0, 0, probe.width, probe.height);
    const color = (x, y) => { const i = (y * width + x) * 4, a = data[i + 3] / 255; return [data[i] * a, data[i + 1] * a, data[i + 2] * a, data[i + 3]]; };
    function extent(axis, reverse, from, to) {
      const size = axis === 'x' ? width : height, at = reverse ? size - 1 : 0;
      const samples = [];
      for (let i = from; i < to; i += Math.max(1, Math.floor((to - from) / 128))) samples.push(axis === 'x' ? color(at, i) : color(i, at));
      const reference = [0, 1, 2, 3].map(k => samples.map(c => c[k]).sort((a, b) => a - b)[Math.floor(samples.length / 2)]);
      // Compare every strip with its outer-edge color, so gradual gradients are not trimmed away.
      for (let depth = 0; depth < size; depth++) {
        const pos = reverse ? size - 1 - depth : depth; let different = 0;
        for (let i = from; i < to; i++) {
          const c = axis === 'x' ? color(pos, i) : color(i, pos);
          if (c.some((v, k) => Math.abs(v - reference[k]) > 12) && ++different > Math.floor((to - from) * 0.005)) return depth;
        }
      }
      return size;
    }
    let top = extent('y', false, 0, width), bottom = height - extent('y', true, 0, width);
    if (bottom <= top) { top = 0; bottom = height; }
    let left = extent('x', false, top, bottom), right = width - extent('x', true, top, bottom);
    if (right <= left) { left = 0; right = width; }
    const x = Math.floor(left * source.width / width), y = Math.floor(top * source.height / height);
    return { x, y, w: Math.ceil(right * source.width / width) - x, h: Math.ceil(bottom * source.height / height) - y };
  }
  function hit(p) {
    if (!valid()) return 'new';
    const tolerance = 9 * canvas.width / canvas.getBoundingClientRect().width / view.scale;
    for (const [name, x, y] of handles().filter(([name]) => name.length === 2)) if (Math.abs(x - p.x) <= tolerance && Math.abs(y - p.y) <= tolerance) return name;
    if (p.y >= rect.y - tolerance && p.y <= rect.y + rect.h + tolerance) {
      if (Math.abs(p.x - rect.x) <= tolerance) return 'w';
      if (Math.abs(p.x - rect.x - rect.w) <= tolerance) return 'e';
    }
    if (p.x >= rect.x - tolerance && p.x <= rect.x + rect.w + tolerance) {
      if (Math.abs(p.y - rect.y) <= tolerance) return 'n';
      if (Math.abs(p.y - rect.y - rect.h) <= tolerance) return 's';
    }
    const safe = tolerance * 2;
    const nearVertical = (Math.abs(p.x - rect.x) < safe || Math.abs(p.x - rect.x - rect.w) < safe) && p.y >= rect.y - safe && p.y <= rect.y + rect.h + safe;
    const nearHorizontal = (Math.abs(p.y - rect.y) < safe || Math.abs(p.y - rect.y - rect.h) < safe) && p.x >= rect.x - safe && p.x <= rect.x + rect.w + safe;
    return nearVertical || nearHorizontal ? 'blocked' : 'new';
  }
  function pointerMode(p, e) {
    const mode = hit(p);
    if (mode !== 'new') return mode;
    return e.altKey && !drawing && valid() && p.x > rect.x && p.x < rect.x + rect.w && p.y > rect.y && p.y < rect.y + rect.h ? 'move' : 'new';
  }
  const cursors = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', move: 'move', new: 'crosshair', blocked: 'default' };
  function update(e) {
    focus = point(e); canvas.style.cursor = cursors[drag?.mode || pointerMode(focus, e)];
    if (!drag) { drawLens(); return; }
    const { start, initial, mode } = drag;
    if (mode === 'move') rect = { ...initial, x: initial.x + focus.x - start.x, y: initial.y + focus.y - start.y };
    else {
      let l = initial.x, r = l + initial.w, t = initial.y, b = t + initial.h;
      if (mode === 'new') { l = start.x; r = focus.x; t = start.y; b = focus.y; }
      else {
        if (mode.includes('w')) l += focus.x - start.x;
        if (mode.includes('e')) r += focus.x - start.x;
        if (mode.includes('n')) t += focus.y - start.y;
        if (mode.includes('s')) b += focus.y - start.y;
      }
      rect = { x: Math.min(l, r), y: Math.min(t, b), w: Math.max(1, Math.abs(r - l)), h: Math.max(1, Math.abs(b - t)) };
    }
    syncInputs(); status(); draw();
  }
  canvas.onpointerdown = e => { if (e.button !== 0 || drag) return; const start = point(e), mode = pointerMode(start, e); if (mode === 'blocked') return; drag = { start, initial: { ...rect }, mode, pointerId: e.pointerId }; canvas.setPointerCapture(e.pointerId); e.preventDefault(); update(e); };
  canvas.onpointermove = e => { if (!drag || drag.pointerId === e.pointerId) update(e); };
  canvas.onpointerup = e => { if (!drag || drag.pointerId !== e.pointerId) return; update(e); drag = null; drawingMode(false); if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); frame(); draw(); };
  canvas.onpointercancel = () => { if (drag) { rect = drag.initial; drag = null; syncInputs(); status(); frame(); draw(); } };
  for (const k of keys) $('crop-' + k).oninput = () => {
    rect = Object.fromEntries(keys.map(key => [key, $('crop-' + key).value === '' ? NaN : Number($('crop-' + key).value)]));
    if (status()) { drawingMode(false); focus = { x: rect.x + (k === 'w' ? rect.w : 0), y: rect.y + (k === 'h' ? rect.h : 0) }; frame(); }
    draw();
  };
  function reset() { drawingMode(false); rect = { x: 0, y: 0, w: source.width, h: source.height }; focus = { x: 0, y: 0 }; syncInputs(); status(); frame(); draw(); }
  $('crop-new').onclick = () => drawingMode(!drawing);
  $('crop-reset').onclick = reset;
  function finish(value) { const resolve = resolveCrop; resolveCrop = null; drag = null; dialog.close(); resolve?.(value); source = null; }
  $('crop-cancel').onclick = () => finish(null);
  $('crop-skip').onclick = () => finish(source);
  $('crop-apply').onclick = () => {
    if (!status()) return;
    // Apply the existing working-image limit before allocating the output bitmap.
    const scale = Math.min(1, 2048 / Math.max(rect.w, rect.h));
    try {
      const result = document.createElement('canvas'); result.width = Math.max(1, Math.round(rect.w * scale)); result.height = Math.max(1, Math.round(rect.h * scale));
      const target = result.getContext('2d'); target.imageSmoothingEnabled = false;
      const l = Math.max(0, rect.x), t = Math.max(0, rect.y), r = Math.min(source.width, rect.x + rect.w), b = Math.min(source.height, rect.y + rect.h);
      if (r > l && b > t) target.drawImage(source, l, t, r - l, b - t, (l - rect.x) * result.width / rect.w, (t - rect.y) * result.height / rect.h, (r - l) * result.width / rect.w, (b - t) * result.height / rect.h);
      finish(result);
    } catch { $('crop-error').textContent = '无法生成此裁剪尺寸，请调整后重试'; }
  };
  dialog.oncancel = e => { e.preventDefault(); finish(null); };
  new ResizeObserver(() => { if (source && dialog.open) draw(); }).observe(canvas);
  window.chooseCrop = image => new Promise(resolve => {
    source = image; resolveCrop = resolve; canvas.width = 900; canvas.height = 600;
    dialog.showModal(); drawingMode(false); rect = defaultRect(); focus = { x: rect.x, y: rect.y }; syncInputs(); status(); frame(); draw();
  });
})();
