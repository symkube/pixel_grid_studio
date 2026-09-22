(() => {
  'use strict';
  const C = PixelCore, $ = id => document.getElementById(id);
  const source = $('source-canvas'), ctx = source.getContext('2d');
  const preview = $('preview-canvas'), pctx = preview.getContext('2d');
  const original = document.createElement('canvas'), octx = original.getContext('2d', { willReadFrequently: true });
  const output = document.createElement('canvas');
  let pixels, result, imageURL, name = '山间小屋 · 示例', xs = [], ys = [], samples = {}, colors = {};
  let threshold = 16, edgeWeight = 0.35, multiColorThreshold = 0.65, colorView = 'all', spacingWeight = 0.15, selection = null, tool = 'select', zoom = 1, gradients, peakEvidence, refinement = null;
  let undoStack = [], redoStack = [], dirty = false, drag = null, timer, pending = false, detection = null, fileBusy = false;
  let savedState = '';
  let gridOptions = { ...C.Grid.DEFAULTS }, spacingWindows = null, spacingWindowSize = 0, gridIssues = [], gridIssueCursor = -1;
  const selectedLines = { x: new Set(), y: new Set() };
  let lineSelectDrag = null;
  let cellModes = {}, multiColorKeys = new Set();
  let handleDrag = null, addLineAxis = null, addLinePosition = null;
  let step = 1, documentReady = false, hasGrid = false, samplingMode = 'mode', issueReview = null;
  let colorBaseView = 'modified', stripeTimer = null;
  let manualPick = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stripeTile = document.createElement('canvas'); stripeTile.width = stripeTile.height = 12;
  const stripeCtx = stripeTile.getContext('2d'); stripeCtx.strokeStyle = '#50695f55'; stripeCtx.lineWidth = 0.7;
  stripeCtx.beginPath();
  for (let x = -12; x <= 12; x += 12) { stripeCtx.moveTo(x, 0); stripeCtx.lineTo(x + 12, 12); }
  stripeCtx.stroke();
  const stripePattern = ctx.createPattern(stripeTile, 'repeat');
  let spacingPreviewAxis = null, gridBuildOptions = '', detecting = false;
  const optionsKey = () => JSON.stringify({ spacingWeight, gridOptions });
  const optionFields = { 'hint-x': 'hintX', 'hint-y': 'hintY' };
  const percentFields = { 'spacing-weight': null, 'search-ratio': 'searchRatio', 'local-window': 'localWindowRatio', 'narrow-ratio': 'narrowRatio', 'wide-ratio': 'wideRatio' };
  function axisOptions(axis) { return { ...gridOptions, spacingWeight, pitchHint: axis === 'x' ? gridOptions.hintX : gridOptions.hintY }; }
  function updateSpacingEvidence() {
    const windowKey = `${gridOptions.localWindowRatio}:${gridOptions.localWindow}`;
    if (!spacingWindows || spacingWindowSize !== windowKey) {
      spacingWindows = { x: C.Grid.spacingCandidates(gradients.x, peakEvidence.x.peaks, gridOptions), y: C.Grid.spacingCandidates(gradients.y, peakEvidence.y.peaks, gridOptions) };
      spacingWindowSize = windowKey;
      renderCandidates();
    }
    const nextIssues = ['x', 'y'].flatMap(axis => C.Grid.diagnostics(axis === 'x' ? xs : ys, gradients[axis], peakEvidence[axis].peaks, spacingWindows[axis], axisOptions(axis)).map(issue => ({ ...issue, axis })));
    if (JSON.stringify(nextIssues) !== JSON.stringify(gridIssues)) gridIssueCursor = -1;
    gridIssues = nextIssues;
  }
  function renderCandidates() {
    for (const axis of ['x', 'y']) {
      const row = $('candidates-' + axis); row.replaceChildren();
      const candidates = hasGrid ? rankedCandidates(axis) : [];
      candidates.forEach((candidate, i) => {
        const button = document.createElement('button'); button.type = 'button';
        const rank = document.createElement('span'); rank.className = 'candidate-rank'; rank.textContent = i === 0 ? '推荐' : `${i + 1}`;
        button.append(rank, ` ${candidate.pitch} px`); button.dataset.pitch = candidate.pitch;
        button.title = `第 ${i + 1} 推荐：${candidate.pitch} 像素`;
        button.setAttribute('aria-pressed', gridOptions[axis === 'x' ? 'hintX' : 'hintY'] === candidate.pitch);
        button.onclick = () => { remember(); gridOptions[axis === 'x' ? 'hintX' : 'hintY'] = candidate.pitch; spacingPreviewAxis = axis; refresh(); };
        row.append(button);
      });
      if (!candidates.length) row.textContent = hasGrid ? '未找到可靠候选' : '等待识别';
    }
  }
  function rankedCandidates(axis) {
    const candidates = [];
    for (const candidate of (spacingWindows?.[axis] || []).flatMap(w => w.candidates).sort((a, b) => b.score - a.score || a.pitch - b.pitch)) {
      if (candidate.score <= 0 || candidates.some(c => Math.abs(c.pitch - candidate.pitch) < 1)) continue;
      candidates.push(candidate); if (candidates.length === 4) break;
    }
    return candidates;
  }
  function spacingPreview() {
    if (step !== 2 || !spacingPreviewAxis) return null;
    const axis = spacingPreviewAxis, field = $('hint-' + axis);
    const value = document.activeElement === field ? Number(field.value) : gridOptions[axis === 'x' ? 'hintX' : 'hintY'];
    const pitch = value || rankedCandidates(axis)[0]?.pitch;
    return Number.isFinite(pitch) && pitch > 0 ? { axis, pitch } : null;
  }
  function syncSpacingPreview() {
    const active = spacingPreview();
    source.classList.toggle('spacing-preview', !!active);
    $('spacing-preview-bar').hidden = !active;
    $('grid-dimensions').hidden = !!active;
    const categoryName = { mode: '众数格', mean: '均值格', manual: '手动颜色', multicolor: '多色格' }[colorView];
    $('canvas-view-title').textContent = manualPick ? '原图 · 点击选中格子内的颜色（Esc 取消）' : active ? '间距预览' : step === 4 ? `${colorBaseView === 'original' ? '原图' : '修改后'}${categoryName ? ` · 强调${categoryName}` : ''}` : '原图与网格';
    $('spacing-preview-label').textContent = active ? `${active.axis === 'x' ? '横向' : '纵向'} ${active.pitch} px` : '';
    document.querySelectorAll('[data-spacing-axis]').forEach(row => row.classList.toggle('previewing', row.dataset.spacingAxis === active?.axis));
  }
  const toolNames = { select: '选择格子', grid: '调整网格线', eyedropper: '从原图取色' };
  lucide.createIcons();
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(timer); timer = setTimeout(() => $('toast').classList.remove('visible'), 3500); }
  function snapshot() { return JSON.stringify({ xs, ys, samples, colors, cellModes, threshold, edgeWeight, multiColorThreshold, spacingWeight, gridOptions, detection, refinement, samplingMode, hasGrid, gridBuildOptions }); }
  function remember() { undoStack.push(snapshot()); if (undoStack.length > 40) undoStack.shift(); redoStack = []; }
  function changed() { dirty = snapshot() !== savedState; $('dirty-state').textContent = dirty ? '有未保存的调整' : '本地工作区'; $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length; }
  function restore(serialized) { if (manualPick) setTool('select'); const s = JSON.parse(serialized); ({ xs, ys, samples, colors, cellModes, threshold, edgeWeight, multiColorThreshold, spacingWeight, gridOptions, detection, refinement, samplingMode, hasGrid, gridBuildOptions } = s); multiColorThreshold ??= 0.65; cellModes ??= {}; samplingMode ??= 'mode'; selection = null; issueReview = null; selectedLines.x.clear(); selectedLines.y.clear(); if (!hasGrid && step > 2) setStep(2); refresh(); }
  function syncSteps() {
    document.querySelectorAll('[data-step]').forEach(button => {
      const value = Number(button.dataset.step);
      button.disabled = detecting || value > 1 && !documentReady || value > 2 && !hasGrid;
      if (value === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-phase]').forEach(panel => { panel.hidden = Number(panel.dataset.phase) !== step; });
    document.querySelector('.results').hidden = step < 3;
    $('grid-warning-legend').hidden = step !== 2 && step !== 3;
    $('grid-edit-actions').hidden = step !== 3;
    $('cell-color-tools').hidden = step !== 4;
    document.querySelectorAll('[data-tool]').forEach(button => {
      const allowed = step === 3 ? button.dataset.tool === 'grid' : step === 4 ? button.dataset.tool === 'select' : false;
      button.hidden = !allowed;
    });
    $('step-back').disabled = detecting || step === 1;
    $('step-next').hidden = step === 4;
    $('step-next').disabled = detecting || (step === 1 ? !documentReady : step === 2 ? !hasGrid : false);
    $('export').disabled = !hasGrid;
    $('save-project').disabled = !documentReady;
    document.querySelector('.header-document').hidden = !documentReady;
    $('welcome-continue').hidden = !documentReady;
    document.body.dataset.step = step;
  }
  function setStep(value) {
    if (value < 1 || value > 4 || value > 1 && !documentReady || value > 2 && !hasGrid) return;
    step = value; spacingPreviewAxis = null; selection = null; selectedLines.x.clear(); selectedLines.y.clear(); issueReview = null;
    setTool(step === 3 ? 'grid' : 'select'); syncSteps(); refresh(); fit();
  }
  async function navigateStep(value) {
    if (detecting) return;
    if (step === 2 && value > 2 && hasGrid && gridBuildOptions !== optionsKey() && !await runDetection(false)) return;
    setStep(value);
  }
  document.querySelectorAll('[data-step]').forEach(button => button.onclick = () => navigateStep(Number(button.dataset.step)));
  $('step-back').onclick = () => setStep(step - 1);
  $('step-next').onclick = () => navigateStep(step + 1);
  $('close-spacing-preview').onclick = () => { spacingPreviewAxis = null; draw(); };
  $('canvas-viewport').addEventListener('click', () => { if (step === 2 && spacingPreviewAxis) { spacingPreviewAxis = null; draw(); } });
  for (const axis of ['x', 'y']) {
    const activate = () => { spacingPreviewAxis = axis; draw(); };
    $('hint-' + axis).addEventListener('focus', activate);
    $('hint-' + axis).addEventListener('click', activate);
    $('hint-' + axis).addEventListener('input', activate);
  }
  const parameterHelp = {
    'spacing-weight': ['间距约束', '越小越跟随图像边缘，越大越倾向保持间距规律。\n\n控制识别时对间距规律的重视程度。0% 只使用梯度峰；数值越高，越偏向“上一条线 + 参考间距”的位置，并按偏离距离的平方扣分。它是软约束，不会强制所有格子等宽。'],
    'search-ratio': ['搜索半径 / 间距', '越小越只在预测位置附近找线，越大越允许线偏得更远。\n\n在预测边界两侧寻找更合适的梯度峰。例如间距 20 px、35%，搜索半径约为 7 px。较大值允许更多偏移，也更容易选中邻近的其他边缘。算法为像素定位保留至少 1 px 的搜索半径。'],
    'local-window': ['局部窗口', '越小越关注附近的间距变化，越大越看重较大范围内的共同规律。\n\n百分比相对于原图对应方向的尺寸：横向按宽度，纵向按高度。例如 1000 × 600 的图，50% 对应横向 500 px、纵向 300 px。通过重叠窗口的自相关和边缘间距寻找周期。较小窗口更关注局部变化；较大窗口更稳定，但会混合不同区域的间距。窗口至少保留 8 px，且不超过该方向的图像尺寸。'],
    'narrow-ratio': ['过窄阈值', '越小越只把非常窄的格子算作异常，越大越容易判定为过窄。\n\n格子宽度低于参考间距乘以此百分比时，标记为过窄。例如参考间距 20 px、60%，小于 12 px 的格子会被标记。0% 不标记过窄。开启自动处理后，识别会尝试合并符合条件的窄格。'],
    'wide-ratio': ['过宽阈值', '越小越容易判定为过宽，越大越能容忍较宽的格子。\n\n这里填写超出参考间距的百分比。0% 对应 1 倍，100% 对应 2 倍。例如参考间距 20 px、65%，大于 33 px 的格子会被标记，等同原来的 1.65 倍。开启自动处理后，识别会尝试在宽格内补线。'],
    'pitch-x': ['水平间距', '越小列越密，越大列越宽，单位为像素。\n\n修改后会按此间距和水平偏移重新生成竖向边界，不保留原来的局部不等宽分布。默认显示当前列宽的中位数。此操作可能清除局部取样和手动颜色，可撤销。'],
    'pitch-y': ['垂直间距', '越小行越密，越大行越高，单位为像素。\n\n修改后会按此间距和垂直偏移重新生成横向边界，不保留原来的局部不等高分布。默认显示当前行高的中位数。此操作可能清除局部取样和手动颜色，可撤销。'],
    'origin-x': ['水平偏移', '数值越大，竖线起点越向右移动，单位为像素。\n\n偏移决定等距竖线相对于图片左边缘的位置；每经过一个水平间距，排列重复。修改后会重新生成该方向边界，图片外框保持固定，可撤销。'],
    'origin-y': ['垂直偏移', '数值越大，横线起点越向下移动，单位为像素。\n\n偏移决定等距横线相对于图片上边缘的位置；每经过一个垂直间距，排列重复。修改后会重新生成该方向边界，图片外框保持固定，可撤销。'],
    'color-threshold': ['颜色合并阈值', '数值越小越严格区分相近颜色，数值越大越容易把相近颜色归为同一组。\n\n众数取色会先按颜色距离聚类，再从主要颜色簇取代表色。这个参数只影响众数取色，不改变均值取色和手动指定颜色。'],
    'color-edge': ['边缘权重', '越小越忽略格子边缘、侧重中心区域，越大越重视边缘像素。\n\n边缘常常包含网格线、抗锯齿或相邻格子的颜色，因此较高权重可能让边界颜色更容易进入统计；较低权重通常更适合边界不干净的生成图。'],
    'multi-color-threshold': ['多色格阈值', '越小越只标记混色严重的格子，越大越容易把格子标记为多色。\n\n众数取色会统计主要颜色簇在采样中的加权占比。占比低于此阈值时，标记为多色。例如阈值为 65%，主要颜色只占 60% 的格子会被标记。\n\n「对当前所有多色格应用均值取色」只处理当前被标记的众数格，支持整体撤销。已经使用均值或指定颜色的格子视为已处理，不再标记；重新应用众数可恢复检查。']
  };
  document.querySelectorAll('[data-help]').forEach(button => button.onclick = () => {
    const [title, message] = parameterHelp[button.dataset.help];
    $('parameter-help-title').textContent = title; $('parameter-help-text').textContent = message; $('parameter-help-dialog').showModal();
  });
  document.querySelectorAll('[data-warning-help]').forEach(button => button.onclick = () => {
    const wide = Number(((gridOptions.wideRatio - 1) * 100).toFixed(1)), narrow = Number((gridOptions.narrowRatio * 100).toFixed(1));
    const explanations = {
      dashed: ['虚线标记', '虚线表示需要核查的边界或建议，不一定是错误。\n\n橙色虚线：自动识别按间距推测补出的边界，已经加入网格，但缺少足够的图像边缘证据。\n\n红色短虚线：这里有较强的图像边缘，但没有被当前网格采用，可能是漏线，也可能只是格子内部的纹理。\n\n橙红色虚线：迭代校准后仍需复核的位置，例如宽窄异常或边界可能还需继续移动。\n\n蓝色虚线：校准给出的补线建议，或逐项确认时预览的切分、合并位置；确认前尚未加入实际网格。\n\n预览间距时的蓝色实线只是等距参考线，不是异常标记。'],
      wide: ['过宽标记', `橙色区域表示这一列或这一行偏宽，可能少了一条或多条分割线。\n\n当前阈值：比参考间距大 ${wide}% 以上，即超过 ${Number(gridOptions.wideRatio.toFixed(3))} 倍。例如参考间距为 20 px，大于 ${Number((20 * gridOptions.wideRatio).toFixed(2))} px 时标记为过宽。\n\n参考间距优先使用所选横向或纵向间距；设为 0 时按附近图像边缘估计。标记只是提醒，原图也可能确实存在较宽色块。第三步可逐项确认是否切分，也可批量切分全部过宽。`],
      narrow: ['过窄标记', `粉色区域表示这一列或这一行偏窄，可能多出了一条分割线，或两条线靠得太近。\n\n当前阈值：小于参考间距的 ${narrow}%。例如参考间距为 20 px，小于 ${Number((20 * gridOptions.narrowRatio).toFixed(2))} px 时标记为过窄。${narrow === 0 ? '当前为 0%，不会标记过窄。' : ''}\n\n参考间距优先使用所选横向或纵向间距；设为 0 时按附近图像边缘估计。图片边缘可能本来就是不完整格，不一定需要合并。第三步可逐项确认是否合并，也可批量合并全部过窄。`]
    };
    const [title, message] = explanations[button.dataset.warningHelp];
    $('parameter-help-title').textContent = title; $('parameter-help-text').textContent = message; $('parameter-help-dialog').showModal();
  });
  $('choose-image').onclick = () => $('image-input').click();
  $('use-demo').onclick = () => $('import-examples').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $('welcome-continue').onclick = () => navigateStep(hasGrid ? 3 : 2);
  let exampleBundle = null;
  function loadExampleBundle() {
    if (!exampleBundle) exampleBundle = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'pics/examples-data.js';
      script.onload = () => resolve(window.PixelExamples);
      script.onerror = () => { script.remove(); exampleBundle = null; reject(Error('无法加载例图数据，请检查 pics/examples-data.js')); };
      document.head.append(script);
    });
    return exampleBundle;
  }
  document.querySelectorAll('[data-example]').forEach(button => button.onclick = async () => {
    if (fileBusy) return;
    fileBusy = true;
    document.querySelectorAll('[data-example]').forEach(item => { item.disabled = true; });
    button.setAttribute('aria-busy', 'true');
    try {
      const examples = await loadExampleBundle();
      const img = await loadImage(examples[button.dataset.example]);
      await prepareImport(img, button.dataset.example.split('/').at(-1));
    } catch (error) { toast('例图导入失败：' + error.message); }
    finally {
      fileBusy = false; button.removeAttribute('aria-busy');
      document.querySelectorAll('[data-example]').forEach(item => { item.disabled = false; });
    }
  });
  function confirmAction(message, { warning = false, title = '替换当前画面？', label = '继续' } = {}) {
    return new Promise(resolve => {
      const dialog = $('confirm-dialog'); $('confirm-message').textContent = message;
      dialog.classList.toggle('warning', warning); dialog.setAttribute('role', warning ? 'alertdialog' : 'dialog');
      $('confirm-title').textContent = title; $('confirm-warning-icon').toggleAttribute('hidden', !warning);
      const accept = dialog.querySelector('[value=confirm]'); accept.textContent = label; accept.className = warning ? 'danger-button' : 'primary';
      dialog.returnValue = '';
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }); dialog.showModal();
      if (warning) dialog.querySelector('[value=cancel]').focus();
    });
  }
  function selectedCells() {
    if (!selection) return [];
    const cells = [];
    for (let row = selection.y1; row <= selection.y2; row++) for (let col = selection.x1; col <= selection.x2; col++) cells.push({ col, row, key: `${col},${row}` });
    return cells;
  }
  function setTool(next) {
    if (manualPick && next !== 'eyedropper') {
      const previous = manualPick; manualPick = null;
      setZoom(previous.zoom); $('canvas-viewport').scrollTo({ left: previous.left, top: previous.top });
    }
    setAddLineMode(false);
    tool = next; document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    $('tool-name').textContent = toolNames[tool]; source.style.cursor = ({ select: 'default', grid: 'crosshair', eyedropper: 'crosshair' })[tool];
    draw(); if (result) updateSelection();
  }
  function beginManualPick() {
    if (!selection) return;
    if (manualPick) { setTool('select'); updateSelection(); return; }
    const col = selection.x1, row = selection.y1, viewport = $('canvas-viewport');
    selectCell(col, row);
    manualPick = { col, row, zoom, left: viewport.scrollLeft, top: viewport.scrollTop };
    setTool('eyedropper'); updateSelection();
    const width = xs[col + 1] - xs[col], height = ys[row + 1] - ys[row];
    setZoom(Math.min(viewport.clientWidth / (4 * width), viewport.clientHeight / (4 * height)));
    const bounds = source.getBoundingClientRect(), view = viewport.getBoundingClientRect();
    viewport.scrollTo({ left: viewport.scrollLeft + bounds.left - view.left + (xs[col] + width / 2) * zoom - viewport.clientWidth / 2,
      top: viewport.scrollTop + bounds.top - view.top + (ys[row] + height / 2) * zoom - viewport.clientHeight / 2 });
  }
  function syncControls() {
    $('cols').value = xs.length - 1; $('rows').value = ys.length - 1;
    $('pitch-x').value = medianPitch(xs).toFixed(1); $('pitch-y').value = medianPitch(ys).toFixed(1);
    $('origin-x').value = (xs[1] % medianPitch(xs)).toFixed(1); $('origin-y').value = (ys[1] % medianPitch(ys)).toFixed(1);
    $('threshold').value = threshold; $('threshold-value').textContent = threshold;
    $('multi-color-threshold').value = multiColorThreshold * 100;
    if (document.activeElement !== $('multi-color-threshold-number')) $('multi-color-threshold-number').value = Number((multiColorThreshold * 100).toFixed(1));
    $('multi-color-threshold-value').textContent = `${Number((multiColorThreshold * 100).toFixed(1))}%`;
    for (const [id, key] of Object.entries(percentFields)) {
      const value = Number(((key ? gridOptions[key] - (id === 'wide-ratio' ? 1 : 0) : spacingWeight) * 100).toFixed(1));
      $(id).value = value;
      if (document.activeElement !== $(id + '-number')) $(id + '-number').value = value;
    }
    for (const [id, key] of Object.entries(optionFields)) $(id).value = gridOptions[key];
    $('aggressive-grid').checked = gridOptions.aggressive;
    const wide = gridIssues.filter(i => i.reason === 'wide').length, narrow = gridIssues.length - wide;
    $('grid-issue-count').textContent = gridIssues.length ? `${wide} 处过宽 · ${narrow} 处过窄` : '没有宽窄异常';
    $('next-grid-issue').disabled = !gridIssues.length;
    for (const [id, reason] of [['split-all', 'wide'], ['review-wide', 'wide'], ['merge-all', 'narrow'], ['review-narrow', 'narrow']]) $(id).disabled = !gridIssues.some(issue => issue.reason === reason);
    syncColorViewControls();
    $('threshold').disabled = false;
    $('edge-weight').disabled = false;
    $('apply-mode-all').disabled = !result || result.issues.length === result.width * result.height;
    $('apply-mean-issues').disabled = !result || !result.issues.length;
    $('edge-weight').value = Math.round(edgeWeight * 100); $('edge-weight-value').textContent = `${Math.round(edgeWeight * 100)}%`;
    $('filename').textContent = name; $('filename').title = name; $('image-size').textContent = `${original.width} × ${original.height}`;
    $('grid-dimensions').textContent = `${xs.length - 1} 列 × ${ys.length - 1} 行`;
    $('grid-status').textContent = detection ? (detection.limitExceeded ? '边缘超过 128 格上限，需手动确认' : detection.confidence < 0.2 ? '梯度证据不足，建议手动设定' : '识别完成 · 候选按推荐顺序排列') : hasGrid ? '已有网格' : '等待分析';
    $('grid-status').title = detection ? `边界梯度支持度 ${Math.round(detection.confidence * 100)}%（不代表识别正确概率）` : '';
    $('grid-edits').hidden = !detection;
    $('grid-edits').textContent = detection ? `自动补线 ${detection.inserted || 0} 条 · 合并窄格 ${detection.merged || 0} 处（可撤销）` : '';
    $('refine-status').hidden = !refinement;
    const optimal = !!refinement && refinement.moved === 0;
    $('refine-status').classList.toggle('optimal', optimal); $('refine-check').toggleAttribute('hidden', !optimal);
    if (refinement) $('refine-status-text').textContent = `${optimal ? '已达到当前最优状态 · ' : ''}${refinement.iterations} 轮 · 调整 ${refinement.moved} 条 · ${refinement.review.length} 处需检查`;
    const insertions = refinement ? refinement.suggestions.x.length + refinement.suggestions.y.length : 0;
    $('insert-lines').hidden = !insertions; $('insert-lines-label').textContent = `应用 ${insertions} 条补线建议`;
    renderCandidates(); updateSelection(); syncSteps(); syncIssueReview(); changed();
  }
  function medianPitch(lines) { const diffs = lines.slice(1).map((v, i) => v - lines[i]).sort((a, b) => a - b); return diffs[Math.floor(diffs.length / 2)]; }
  function updateSelection() {
    const cells = selectedCells(), count = cells.length;
    $('selection-status').textContent = count ? `已选择 ${count} 格 · ${selection.x1 + 1}, ${selection.y1 + 1}` : '未选择';
    $('manual-count').textContent = `${Object.keys(colors).length} 格`;
    const modes = cells.map(c => colors[c.key] ? 'manual' : cellModes[c.key] || samplingMode);
    const sameMode = count && modes.every(mode => mode === modes[0]) ? modes[0] : null;
    document.querySelectorAll('[data-cell-color-mode]').forEach(button => {
      button.disabled = !count;
      const active = button.dataset.cellColorMode === 'manual' ? !!manualPick : !manualPick && button.dataset.cellColorMode === sameMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
    $('cell-color-hint').textContent = manualPick ? '点击原图取色 · Esc 取消' : !count ? '先在画布中选择格子' : `${count === 1 ? '当前格子' : `已选 ${count} 格${sameMode ? '' : ' · 混合取色'}`}${sameMode === 'manual' ? ' · 已指定颜色' : ''}`;
  }
  function refresh() {
    updateSpacingEvidence();
    syncIssueReview();
    if (refinement && (JSON.stringify(xs) !== JSON.stringify(refinement.xs) || JSON.stringify(ys) !== JSON.stringify(refinement.ys))) refinement = null;
    result = C.renderPixels(pixels, xs, ys, samples, colors, threshold, edgeWeight, samplingMode, multiColorThreshold, cellModes);
    multiColorKeys = new Set(result.issues.map(({ col, row }) => `${col},${row}`));
    output.width = result.width; output.height = result.height;
    output.getContext('2d').putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
    drawPreview(); draw(); renderLineHandles(); syncControls(); updateExportSize();
    $('issue-count').textContent = result.issues.length ? `${result.issues.length} 个多色格待检查` : '没有明显多色格';
    $('next-issue').disabled = !result.issues.length;
    $('color-view-counts').textContent = `众数 ${result.modes.filter(m => m === 'mode').length} · 均值 ${result.modes.filter(m => m === 'mean').length} · 手动 ${result.modes.filter(m => m === 'manual').length} · 多色 ${result.issues.length}`;
    $('output-size').textContent = `${result.width} × ${result.height} px`; $('color-count').textContent = `${result.palette.length} 种颜色`;
    $('palette').replaceChildren(...result.palette.slice(0, 16).map(([hex, count]) => { const swatch = document.createElement('span'); swatch.style.background = '#' + hex; swatch.title = `#${hex} · ${count} 格`; return swatch; }));
  }
  function scheduleRefresh() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; refresh(); }); }
  function drawPreview() {
    if (!result) return;
    const scale = Math.max(1, Math.floor(640 / Math.max(result.width, result.height)));
    preview.width = result.width * scale; preview.height = result.height * scale;
    preview.style.width = `${100 * result.width / Math.max(result.width, result.height)}%`;
    preview.style.height = `${100 * result.height / Math.max(result.width, result.height)}%`;
    preview.style.aspectRatio = `${result.width} / ${result.height}`;
    pctx.imageSmoothingEnabled = false; pctx.drawImage(output, 0, 0, preview.width, preview.height);
    if (selection) { pctx.strokeStyle = '#f8fcff'; pctx.lineWidth = 2; pctx.strokeRect(selection.x1 * scale + 1, selection.y1 * scale + 1, (selection.x2 - selection.x1 + 1) * scale - 2, (selection.y2 - selection.y1 + 1) * scale - 2); pctx.strokeStyle = '#244f47'; pctx.lineWidth = 1; pctx.strokeRect(selection.x1 * scale, selection.y1 * scale, (selection.x2 - selection.x1 + 1) * scale, (selection.y2 - selection.y1 + 1) * scale); }
  }
  function updateLineSelectionUI() {
    const count = selectedLines.x.size + selectedLines.y.size;
    $('merge-lines').disabled = Math.max(selectedLines.x.size, selectedLines.y.size) < 2;
    $('merge-lines-label').textContent = count ? `合并选中网格线（${count}）` : '合并选中网格线';
    document.querySelectorAll('.grid-handle').forEach(button => { const selected = selectedLines[button.dataset.axis].has(Number(button.dataset.index)); button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', selected); });
  }
  function chooseLineRange(axis, indices) {
    selectedLines.x.clear(); selectedLines.y.clear();
    if (indices.length) {
      const first = Math.min(...indices), last = Math.max(...indices);
      for (let i = first; i <= last; i++) selectedLines[axis].add(i);
    }
    updateLineSelectionUI(); draw();
  }
  function toggleLine(axis, index) {
    const current = [...selectedLines[axis]].sort((a, b) => a - b);
    if (!current.includes(index)) chooseLineRange(axis, [...current, index]);
    else if (index === current[0] || index === current.at(-1)) chooseLineRange(axis, current.filter(i => i !== index));
    else chooseLineRange(axis, [index]);
  }
  function lineHandlePoints() {
    const stage = $('canvas-stage'), canvasRect = source.getBoundingClientRect(), stageRect = stage.getBoundingClientRect();
    const sx = canvasRect.width / source.width, sy = canvasRect.height / source.height, ox = canvasRect.left - stageRect.left, oy = canvasRect.top - stageRect.top;
    const points = [];
    xs.slice(1, -1).forEach((x, i) => { points.push({ axis: 'x', index: i + 1, x: ox + x * sx, y: oy - 12, side: 'top' }, { axis: 'x', index: i + 1, x: ox + x * sx, y: oy + canvasRect.height + 12, side: 'bottom' }); });
    ys.slice(1, -1).forEach((y, i) => { points.push({ axis: 'y', index: i + 1, x: ox - 12, y: oy + y * sy, side: 'left' }, { axis: 'y', index: i + 1, x: ox + canvasRect.width + 12, y: oy + y * sy, side: 'right' }); });
    return points;
  }
  function renderLineHandles() {
    const layer = $('grid-handles'); if (!layer || !pixels) return;
    layer.replaceChildren();
    layer.hidden = step !== 3 || !$('show-grid').checked;
    if (layer.hidden) return;
    for (const point of lineHandlePoints()) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'grid-handle';
      button.dataset.axis = point.axis; button.dataset.index = point.index; button.dataset.side = point.side;
      button.title = `第 ${point.index} 条${point.axis === 'x' ? '竖线' : '横线'}：点击选择，拖动调整位置`; button.setAttribute('aria-label', button.title);
      button.classList.toggle('dragging', drag?.type === 'grid' && drag.axis === point.axis && drag.index === point.index);
      button.style.left = `${point.x}px`; button.style.top = `${point.y}px`;
      button.addEventListener('click', event => { event.stopPropagation(); if (event.detail === 0) toggleLine(point.axis, point.index); });
      layer.append(button);
    }
    updateLineSelectionUI();
  }
  function draw() {
    syncStripeAnimation();
    if (!pixels) return;
    syncSpacingPreview();
    const spacing = spacingPreview();
    ctx.clearRect(0, 0, source.width, source.height);
    if (step === 4 && result) drawColorView();
    else { ctx.globalAlpha = spacing ? 0.3 : 1; ctx.drawImage(original, 0, 0); ctx.globalAlpha = 1; }
    const lw = 1 / zoom;
    if (spacing) {
      const end = spacing.axis === 'x' ? source.width : source.height;
      ctx.beginPath();
      // Avoid drawing thousands of overlapping strokes at very small pitches.
      const stride = Math.max(1, Math.ceil(2 / (spacing.pitch * zoom)));
      for (let i = stride; i * spacing.pitch < end; i += stride) {
        const at = i * spacing.pitch;
        if (spacing.axis === 'x') { ctx.moveTo(at, 0); ctx.lineTo(at, source.height); }
        else { ctx.moveTo(0, at); ctx.lineTo(source.width, at); }
      }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2.5, 4 * lw); ctx.stroke();
      ctx.strokeStyle = '#176cce'; ctx.lineWidth = Math.max(1.5, 2 * lw); ctx.stroke();
      return;
    }
    if ((step === 2 || step === 3) && $('show-gradient').checked && gradients) {
      const maxX = Math.max(...gradients.x, 1), maxY = Math.max(...gradients.y, 1), size = 28 * lw;
      ctx.fillStyle = '#ffffffe0'; ctx.fillRect(0, 0, source.width, size); ctx.fillRect(0, 0, size, source.height);
      ctx.fillStyle = '#2464a9bb';
      gradients.x.forEach((v, x) => ctx.fillRect(x, 0, 1, size * v / maxX)); gradients.y.forEach((v, y) => ctx.fillRect(0, y, size * v / maxY, 1));
    }
    if (step >= 2 && hasGrid && $('show-grid').checked) {
      for (const issue of step === 3 || step === 2 ? gridIssues : []) {
        ctx.fillStyle = issue.reason === 'wide' ? '#e8a34425' : '#cb57792b';
        if (issue.axis === 'x') ctx.fillRect(issue.start, 0, issue.gap, source.height); else ctx.fillRect(0, issue.start, source.width, issue.gap);
      }
      ctx.lineWidth = lw * 0.7; ctx.strokeStyle = `rgba(25,53,46,${Number($('grid-opacity').value) / 100})`;
      ctx.beginPath(); xs.slice(1, -1).forEach(x => { ctx.moveTo(x, 0); ctx.lineTo(x, source.height); }); ys.slice(1, -1).forEach(y => { ctx.moveTo(0, y); ctx.lineTo(source.width, y); }); ctx.stroke();
      if (detection) { ctx.strokeStyle = '#ce862bc0'; ctx.setLineDash([4 * lw, 4 * lw]); ctx.beginPath(); (detection.xIssues || []).forEach(i => { ctx.moveTo(xs[i], 0); ctx.lineTo(xs[i], source.height); }); (detection.yIssues || []).forEach(i => { ctx.moveTo(0, ys[i]); ctx.lineTo(source.width, ys[i]); }); ctx.stroke(); ctx.setLineDash([]); }
      if (detection) { ctx.strokeStyle = '#da63559f'; ctx.setLineDash([2 * lw, 5 * lw]); ctx.beginPath(); (detection.xConflicts || []).forEach(x => { ctx.moveTo(x, 0); ctx.lineTo(x, source.height); }); (detection.yConflicts || []).forEach(y => { ctx.moveTo(0, y); ctx.lineTo(source.width, y); }); ctx.stroke(); ctx.setLineDash([]); }
      ctx.lineWidth = lw * 1.6; ctx.strokeStyle = '#d88937'; ctx.beginPath(); selectedLines.x.forEach(i => { if (xs[i] !== undefined) { ctx.moveTo(xs[i], 0); ctx.lineTo(xs[i], source.height); } }); selectedLines.y.forEach(i => { if (ys[i] !== undefined) { ctx.moveTo(0, ys[i]); ctx.lineTo(source.width, ys[i]); } }); ctx.stroke();
      if (refinement) {
        for (const axis of ['x', 'y']) {
          const stroke = (position, color) => { ctx.strokeStyle = color; ctx.beginPath(); if (axis === 'x') { ctx.moveTo(position, 0); ctx.lineTo(position, source.height); } else { ctx.moveTo(0, position); ctx.lineTo(source.width, position); } ctx.stroke(); };
          ctx.setLineDash([5 * lw, 3 * lw]); refinement.suggestions[axis].forEach(p => stroke(p.position, '#3290d6'));
          refinement.review.filter(r => r.axis === axis).forEach(r => stroke(r.position, '#d56c37'));
        }
        ctx.setLineDash([]);
      }
    }
    if (step === 4 && $('show-issues').checked && result) {
      ctx.fillStyle = '#d88937';
      for (const { col, row } of result.issues) { const w = Math.min((xs[col + 1] - xs[col]) * 0.34, 3 * lw), h = Math.min((ys[row + 1] - ys[row]) * 0.34, 3 * lw); ctx.fillRect(xs[col + 1] - w, ys[row], w, h); }
    }
    if (selection) {
      const x = xs[selection.x1], y = ys[selection.y1], w = xs[selection.x2 + 1] - x, h = ys[selection.y2 + 1] - y;
      if (!manualPick) { ctx.fillStyle = '#2b947128'; ctx.fillRect(x, y, w, h); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * lw; ctx.strokeRect(x, y, w, h); ctx.strokeStyle = '#248062'; ctx.lineWidth = 1.5 * lw; ctx.strokeRect(x, y, w, h);
    }
    if (step === 3 && issueReview?.current) {
      const issue = issueReview.current, current = issue.axis === 'x' ? xs : ys, next = proposal(issue);
      ctx.strokeStyle = '#2375c4'; ctx.lineWidth = 2 * lw; ctx.setLineDash([5 * lw, 3 * lw]);
      for (const p of next.lines.filter(v => !current.includes(v))) {
        ctx.beginPath(); if (issue.axis === 'x') { ctx.moveTo(p, 0); ctx.lineTo(p, source.height); } else { ctx.moveTo(0, p); ctx.lineTo(source.width, p); } ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (step === 3 && (drag?.type === 'grid' || addLinePosition !== null)) {
      const axis = drag?.type === 'grid' ? drag.axis : addLineAxis;
      const position = drag?.type === 'grid' ? (axis === 'x' ? xs : ys)[drag.index] : addLinePosition;
      ctx.save(); ctx.setLineDash(addLineAxis ? [6 * lw, 3 * lw] : []); ctx.beginPath();
      if (axis === 'x') { ctx.moveTo(position, 0); ctx.lineTo(position, source.height); } else { ctx.moveTo(0, position); ctx.lineTo(source.width, position); }
      ctx.lineWidth = Math.max(2, 4 * lw); ctx.strokeStyle = '#176cce'; ctx.stroke(); ctx.restore();
    }
  }
  function setZoom(value) {
    zoom = C.clamp(value, 0.05, manualPick ? 1024 : 16); source.style.width = `${source.width * zoom}px`; source.style.height = `${source.height * zoom}px`;
    $('canvas-stage').style.width = `${Math.max(source.width * zoom + (manualPick ? $('canvas-viewport').clientWidth : 0), $('canvas-viewport').clientWidth - 68)}px`;
    $('canvas-stage').style.height = `${Math.max(source.height * zoom + (manualPick ? $('canvas-viewport').clientHeight : 0), $('canvas-viewport').clientHeight - 68)}px`;
    $('zoom-value').textContent = `${Math.round(zoom * 100)}%`; draw(); renderLineHandles();
  }
  function fit() { if (manualPick) setTool('select'); const v = $('canvas-viewport'); setZoom(Math.min((v.clientWidth - 70) / source.width, (v.clientHeight - 70) / source.height, 3)); v.scrollTo({ left: 0, top: 0 }); }
  function locate(e) { const b = source.getBoundingClientRect(); return { x: C.clamp((e.clientX - b.left) / b.width * source.width, 0, source.width - 0.001), y: C.clamp((e.clientY - b.top) / b.height * source.height, 0, source.height - 0.001) }; }
  function cellAt(p) { return { col: Math.max(0, xs.findIndex(v => v > p.x) - 1), row: Math.max(0, ys.findIndex(v => v > p.y) - 1) }; }
  function selectCell(col, row) { selection = { x1: col, y1: row, x2: col, y2: row }; updateSelection(); draw(); drawPreview(); }
  function replaceGrid(newX, newY, status = null, options = gridOptions) { remember(); gridOptions = options; gridBuildOptions = optionsKey(); xs = newX; ys = newY; samples = {}; colors = {}; cellModes = {}; selection = null; selectedLines.x.clear(); selectedLines.y.clear(); issueReview = null; hasGrid = true; detection = status; refinement = null; refresh(); }
  async function allowGridReplace() { return !hasGrid || !(detection === null || Object.keys(samples).length || Object.keys(colors).length || Object.keys(cellModes).length) || await confirmAction('重建网格会替换手动边界，并清除局部取样、格子取色方式和手动颜色。此操作可以撤销。'); }
  function setAddLineMode(enabled) {
    addLineAxis = enabled ? document.querySelector('[name=line-direction]:checked').value : null; addLinePosition = null;
    $('add-line').setAttribute('aria-pressed', enabled); $('add-line-controls').hidden = !enabled;
    source.style.cursor = enabled ? 'crosshair' : tool === 'grid' ? 'crosshair' : 'default';
    if (enabled) { $('show-grid').checked = true; selectedLines.x.clear(); selectedLines.y.clear(); updateLineSelectionUI(); renderLineHandles(); }
    draw();
  }
  function viewCategory(col, row) {
    if (manualPick) return true;
    const key = `${col},${row}`;
    if (colorView === 'all') return true;
    if (colorView === 'multicolor') return multiColorKeys.has(key);
    return colorView === result.modes[row * result.width + col];
  }
  function drawColorView() {
    if (!result) return;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const faded = new Path2D();
    for (let row = 0; row < result.height; row++) for (let col = 0; col < result.width; col++) {
      const x = xs[col], y = ys[row], w = xs[col + 1] - x, h = ys[row + 1] - y;
      const active = viewCategory(col, row);
      ctx.globalAlpha = active ? 1 : 0.18;
      if (manualPick || colorBaseView === 'original') ctx.drawImage(original, x, y, w, h, x, y, w, h);
      else {
        const i = (row * result.width + col) * 4, color = result.data;
        ctx.fillStyle = `rgba(${color[i]},${color[i + 1]},${color[i + 2]},${color[i + 3] / 255})`;
        ctx.fillRect(x, y, w, h);
      }
      if (!active) faded.rect(x, y, w, h);
    }
    if (colorView !== 'all' && !manualPick) {
      const offset = reducedMotion.matches ? 0 : (performance.now() / 125) % 12;
      stripePattern.setTransform(new DOMMatrix().scale(1 / zoom).translate(offset, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = stripePattern; ctx.fill(faded);
    }
    ctx.restore();
  }
  function syncStripeAnimation() {
    const active = step === 4 && colorView !== 'all' && !manualPick && !document.hidden && !reducedMotion.matches;
    if (!active) { clearTimeout(stripeTimer); stripeTimer = null; return; }
    if (stripeTimer !== null) return;
    // Animate only the editor overlay, without rerunning sampling or the preview.
    stripeTimer = setTimeout(() => { stripeTimer = null; draw(); }, 80);
  }
  document.addEventListener('visibilitychange', () => { if (pixels) draw(); });
  reducedMotion.addEventListener('change', () => { if (pixels) draw(); });
  function syncColorViewControls() {
    for (const [attribute, current] of [['colorBase', colorBaseView], ['colorCategory', colorView]]) {
      const selector = attribute === 'colorBase' ? '[data-color-base]' : '[data-color-category]';
      document.querySelectorAll(selector).forEach(button => {
        const active = button.dataset[attribute] === current;
        button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
      });
    }
  }
  function insertionPosition(p, e) {
    const lines = addLineAxis === 'x' ? xs : ys, at = p[addLineAxis];
    if (lines.some(v => Math.abs(v - at) < 0.5)) return null;
    const index = lines.findIndex(v => v > at);
    if (index < 1 || at <= lines[0] || at >= lines.at(-1) || lines[index] - lines[index - 1] < 1) return null;
    const min = lines[index - 1] + 0.5, max = lines[index] - 0.5, requested = C.clamp(Math.round(at), min, max);
    return $('snap-gradient').checked && !e.altKey ? C.snapBoundary(gradients[addLineAxis], requested, snapRadius(), min, max, peakEvidence[addLineAxis]) : requested;
  }
  function insertManualLine(p, e) {
    const axis = addLineAxis, lines = axis === 'x' ? xs : ys, at = insertionPosition(p, e);
    if (lines.length >= 129) { toast('每个方向最多 128 格'); return; }
    if (at === null || lines.some(v => Math.abs(v - at) < 0.5)) { toast('此处无法再加入网格线'); return; }
    const next = [...lines, at].sort((a, b) => a - b);
    remember(); issueReview = null; applyGridEdit(axis === 'x' ? next : xs, axis === 'y' ? next : ys);
    setAddLineMode(false); refresh(); toast('已加入网格线，可撤销');
  }
  $('add-line').onclick = () => setAddLineMode(!addLineAxis);
  $('cancel-add-line').onclick = () => setAddLineMode(false);
  document.querySelectorAll('[name=line-direction]').forEach(input => input.onchange = () => { if (input.checked && addLineAxis) { addLineAxis = input.value; addLinePosition = null; draw(); } });
  function beginGridDrag(axis, index, e, offset = 0, capture = source) {
    const before = snapshot(), previousRedo = redoStack;
    remember(); issueReview = null; detection = null; refinement = null;
    drag = { type: 'grid', axis, index, offset, pointerId: e.pointerId, capture, before, previousRedo };
    draw(); renderLineHandles();
  }
  function moveGridDrag(e) {
    if (drag?.type !== 'grid' || drag.pointerId !== e.pointerId) return;
    const lines = drag.axis === 'x' ? xs : ys, min = lines[drag.index - 1] + 0.5, max = lines[drag.index + 1] - 0.5;
    const requested = C.clamp(Math.round(locate(e)[drag.axis] + drag.offset), min, max);
    lines[drag.index] = $('snap-gradient').checked && !e.altKey ? C.snapBoundary(gradients[drag.axis], requested, snapRadius(), min, max, peakEvidence[drag.axis]) : requested;
    scheduleRefresh();
  }
  function stagePoint(e) { const rect = $('canvas-stage').getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
  function updateLineBox() {
    if (!lineSelectDrag) return; const box = $('line-select-box'), a = lineSelectDrag.start, b = lineSelectDrag.current;
    box.style.left = `${Math.min(a.x, b.x)}px`; box.style.top = `${Math.min(a.y, b.y)}px`; box.style.width = `${Math.abs(a.x - b.x)}px`; box.style.height = `${Math.abs(a.y - b.y)}px`;
  }
  $('canvas-viewport').addEventListener('pointerdown', e => {
    if (step !== 3 || tool !== 'grid' || e.button !== 0 || addLineAxis || drag || handleDrag) return;
    const handle = e.target.closest('.grid-handle');
    if (handle) {
      const axis = handle.dataset.axis, index = Number(handle.dataset.index);
      handleDrag = { axis, index, x: e.clientX, y: e.clientY, pointerId: e.pointerId, offset: (axis === 'x' ? xs : ys)[index] - locate(e)[axis] };
      $('canvas-viewport').setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    const canvasRect = source.getBoundingClientRect(), p = stagePoint(e);
    if (e.clientX >= canvasRect.left && e.clientX <= canvasRect.right && e.clientY >= canvasRect.top && e.clientY <= canvasRect.bottom) return;
    lineSelectDrag = { start: p, current: p }; $('line-select-box').hidden = false; updateLineBox(); $('canvas-viewport').setPointerCapture(e.pointerId); e.preventDefault();
  }, true);
  $('canvas-viewport').addEventListener('pointermove', e => {
    if (handleDrag && e.pointerId === handleDrag.pointerId) {
      if (!drag && Math.hypot(e.clientX - handleDrag.x, e.clientY - handleDrag.y) >= 4) beginGridDrag(handleDrag.axis, handleDrag.index, e, handleDrag.offset, $('canvas-viewport'));
      if (drag) moveGridDrag(e); e.stopPropagation(); return;
    }
    if (!lineSelectDrag) return; lineSelectDrag.current = stagePoint(e); updateLineBox();
  }, true);
  $('canvas-viewport').addEventListener('pointerup', e => {
    if (handleDrag && e.pointerId === handleDrag.pointerId) {
      if (drag) finishDrag(e); else toggleLine(handleDrag.axis, handleDrag.index);
      handleDrag = null;
      if ($('canvas-viewport').hasPointerCapture(e.pointerId)) $('canvas-viewport').releasePointerCapture(e.pointerId);
      e.preventDefault(); e.stopPropagation(); return;
    }
    if (!lineSelectDrag) return; const a = lineSelectDrag.start, b = stagePoint(e), left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
    const hits = lineHandlePoints().filter(point => point.x >= left && point.x <= right && point.y >= top && point.y <= bottom);
    const axis = hits.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0]?.axis || 'x';
    chooseLineRange(axis, hits.filter(p => p.axis === axis).map(p => p.index));
    lineSelectDrag = null; $('line-select-box').hidden = true;
    if ($('canvas-viewport').hasPointerCapture(e.pointerId)) $('canvas-viewport').releasePointerCapture(e.pointerId);
    e.preventDefault();
  }, true);
  $('canvas-viewport').addEventListener('pointercancel', e => { if (handleDrag?.pointerId === e.pointerId) { finishDrag(e); handleDrag = null; } lineSelectDrag = null; $('line-select-box').hidden = true; });
  source.addEventListener('pointerdown', e => {
    if (e.button !== 0 || step < 3) return;
    const p = locate(e), cell = cellAt(p);
    if (manualPick) {
      if (cell.col !== manualPick.col || cell.row !== manualPick.row) { toast('请在当前放大的选中格子内取色'); return; }
      const key = `${manualPick.col},${manualPick.row}`, i = (Math.floor(p.y) * source.width + Math.floor(p.x)) * 4;
      remember(); colors[key] = Array.from(pixels.data.slice(i, i + 4)); delete cellModes[key];
      setTool('select'); refresh(); toast('该格取色完成'); return;
    }
    if (step === 3 && addLineAxis) { insertManualLine(p, e); return; }
    source.setPointerCapture(e.pointerId);
    if (tool === 'select') { selectCell(cell.col, cell.row); drag = { type: 'select', start: cell }; }
    else if (tool === 'grid') {
      let best = { distance: Infinity };
      for (const [axis, lines, value] of [['x', xs, p.x], ['y', ys, p.y]]) lines.slice(1, -1).forEach((v, i) => { const distance = Math.abs(v - value); if (distance < best.distance) best = { axis, index: i + 1, distance }; });
      if (best.distance * zoom > 12) { toast('请拖动靠近指针的网格线'); return; }
      beginGridDrag(best.axis, best.index, e, (best.axis === 'x' ? xs : ys)[best.index] - p[best.axis]);
    }
  });
  source.addEventListener('pointermove', e => {
    const p = locate(e); $('cursor-position').textContent = `X ${Math.floor(p.x)}   Y ${Math.floor(p.y)}`;
    if (step === 3 && addLineAxis) { addLinePosition = insertionPosition(p, e); draw(); return; }
    if (!drag) return;
    if (drag.type === 'select') { const cell = cellAt(p); selection = { x1: Math.min(drag.start.col, cell.col), y1: Math.min(drag.start.row, cell.row), x2: Math.max(drag.start.col, cell.col), y2: Math.max(drag.start.row, cell.row) }; updateSelection(); draw(); drawPreview(); }
    else if (drag.type === 'grid') moveGridDrag(e);
  });
  function finishDrag(e) {
    if (!drag) return;
    if (drag.type === 'grid') {
      const current = drag; if (current.pointerId !== e.pointerId) return;
      if (e.type !== 'pointercancel') moveGridDrag(e);
      drag = null;
      if (current.capture.hasPointerCapture(e.pointerId)) current.capture.releasePointerCapture(e.pointerId);
      if (e.type === 'pointercancel') { undoStack.pop(); redoStack = current.previousRedo; restore(current.before); } else refresh();
      return;
    }
    drag = null; if (source.hasPointerCapture(e.pointerId)) source.releasePointerCapture(e.pointerId); refresh();
  }
  source.addEventListener('pointerup', finishDrag); source.addEventListener('pointercancel', finishDrag);
  source.addEventListener('pointerleave', () => { if (addLineAxis) { addLinePosition = null; draw(); } });
  preview.addEventListener('click', e => { if (step !== 4) return; const b = preview.getBoundingClientRect(); selectCell(C.clamp(Math.floor((e.clientX - b.left) / b.width * result.width), 0, result.width - 1), C.clamp(Math.floor((e.clientY - b.top) / b.height * result.height), 0, result.height - 1)); setTool('select'); });
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  function mergeSelectedLines() {
    const oldX = xs, oldY = ys, selectedX = [...selectedLines.x].filter(i => i > 0 && i < oldX.length - 1).sort((a, b) => a - b), selectedY = [...selectedLines.y].filter(i => i > 0 && i < oldY.length - 1).sort((a, b) => a - b);
    if (selectedX.length < 2 && selectedY.length < 2) { toast('请至少框选同一方向的两条网格线'); return; }
    try {
      const nextX = selectedX.length >= 2 ? C.mergeLines(oldX, selectedX) : oldX;
      const nextY = selectedY.length >= 2 ? C.mergeLines(oldY, selectedY) : oldY;
      remember(); issueReview = null; applyGridEdit(nextX, nextY); refresh(); toast('已按平均坐标合并，可撤销');
    } catch (error) { toast(error.message); }
  }
  function applyGridEdit(newX, newY) {
    ({ samples, colors, cellModes } = C.remapOverrides(xs, ys, newX, newY, samples, colors, cellModes));
    xs = newX; ys = newY; selection = null; selectedLines.x.clear(); selectedLines.y.clear(); detection = null; refinement = null;
  }
  const issueKey = issue => `${issue.axis}:${issue.start}:${issue.end}`;
  function proposal(issue) { return C.repairInterval(issue.axis === 'x' ? xs : ys, issue, gradients[issue.axis], gridOptions); }
  function applyIssue(issue, next) { applyGridEdit(issue.axis === 'x' ? next : xs, issue.axis === 'y' ? next : ys); }
  function focusIssue(issue) {
    selection = issue.axis === 'x' ? { x1: issue.index, x2: issue.index, y1: 0, y2: ys.length - 2 } : { x1: 0, x2: xs.length - 2, y1: issue.index, y2: issue.index };
    const view = $('canvas-viewport'), rect = source.getBoundingClientRect(), v = view.getBoundingClientRect();
    const x = issue.axis === 'x' ? (issue.start + issue.end) / 2 : source.width / 2;
    const y = issue.axis === 'y' ? (issue.start + issue.end) / 2 : source.height / 2;
    view.scrollTo({ left: view.scrollLeft + rect.left - v.left + x * zoom - view.clientWidth / 2, top: view.scrollTop + rect.top - v.top + y * zoom - view.clientHeight / 2 });
    updateSelection(); draw(); drawPreview();
  }
  function syncIssueReview() {
    $('issue-review').hidden = !issueReview;
    if (!issueReview) return;
    const remaining = gridIssues.filter(i => i.reason === issueReview.reason && !issueReview.skipped.has(issueKey(i)));
    issueReview.current = remaining[0] || null;
    const current = issueReview.current;
    $('review-status').textContent = `${issueReview.reason === 'wide' ? '过宽' : '过窄'}：已处理 ${issueReview.applied}，已跳过 ${issueReview.skipped.size}，剩余 ${remaining.length}`;
    $('review-apply').textContent = issueReview.reason === 'wide' ? '确认切分' : '确认合并';
    $('review-skip').disabled = !current;
    if (!current) { $('review-detail').textContent = '本轮确认完成'; $('review-apply').disabled = true; return; }
    const next = proposal(current);
    $('review-apply').disabled = !!next.reason;
    const change = issueReview.reason === 'wide' ? `切为 ${next.lines.length - (current.axis === 'x' ? xs.length : ys.length) + 1} 格` : '合并相邻边界';
    $('review-detail').textContent = `${current.axis === 'x' ? '列' : '行'} ${current.index + 1} · ${current.gap.toFixed(1)} px / 参考 ${current.expected.toFixed(1)} px · ${next.reason || change}${current.border ? ' · 图像边缘' : ''}`;
  }
  function beginReview(reason) {
    issueReview = { reason, skipped: new Set(), applied: 0, current: null };
    syncIssueReview(); if (issueReview.current) focusIssue(issueReview.current);
  }
  function batchRepair(reason) {
    issueReview = null; const seen = new Set(); let changed = 0, skipped = 0;
    // Recompute after every edit: adjacent narrow intervals may share a boundary.
    for (let attempt = 0; attempt < 512; attempt++) {
      updateSpacingEvidence();
      const issue = gridIssues.find(i => i.reason === reason && !seen.has(issueKey(i)));
      if (!issue) break;
      seen.add(issueKey(issue)); const next = proposal(issue);
      if (next.reason) { skipped++; continue; }
      if (!changed) remember();
      applyIssue(issue, next.lines); changed++;
    }
    refresh(); toast(`已处理 ${changed} 处${skipped ? `，${skipped} 处受网格上限限制或无法处理` : ''}，可撤销`);
  }
  $('split-all').onclick = () => batchRepair('wide');
  $('merge-all').onclick = () => batchRepair('narrow');
  $('review-wide').onclick = () => beginReview('wide');
  $('review-narrow').onclick = () => beginReview('narrow');
  $('review-apply').onclick = () => {
    const issue = issueReview?.current; if (!issue) return;
    const next = proposal(issue); if (next.reason) { toast(next.reason); return; }
    remember(); issueReview.applied++; applyIssue(issue, next.lines); refresh();
    if (issueReview.current) focusIssue(issueReview.current);
  };
  $('review-skip').onclick = () => { if (!issueReview?.current) return; issueReview.skipped.add(issueKey(issueReview.current)); syncIssueReview(); if (issueReview.current) focusIssue(issueReview.current); else { selection = null; draw(); drawPreview(); updateSelection(); } };
  $('review-stop').onclick = () => { issueReview = null; selection = null; syncIssueReview(); draw(); drawPreview(); updateSelection(); };
  $('merge-lines').onclick = mergeSelectedLines;
  $('undo').onclick = () => { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); };
  $('redo').onclick = () => { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); };
  $('zoom-in').onclick = () => setZoom(zoom * 1.25); $('zoom-out').onclick = () => setZoom(zoom / 1.25); $('fit').onclick = fit;
  for (const id of ['show-grid', 'show-issues', 'grid-opacity', 'show-gradient']) $(id).addEventListener('input', () => { $('grid-opacity-value').textContent = `${$('grid-opacity').value}%`; draw(); renderLineHandles(); });
  function snapRadius() { return C.clamp(Number($('snap-radius').value) || 6, 1, 40); }
  $('snap-radius').onchange = () => { $('snap-radius').value = snapRadius(); };
  for (const [id, key] of Object.entries(percentFields)) for (const field of [$(id), $(id + '-number')]) {
    field.oninput = () => {
      const value = Number(field.value);
      const valid = field.value !== '' && Number.isFinite(value) && value >= Number(field.min) && value <= Number(field.max);
      field.setAttribute('aria-invalid', !valid);
      if (!valid) return;
      if (!field.dataset.editing) { remember(); field.dataset.editing = '1'; }
      if (key) gridOptions[key] = value / 100 + (id === 'wide-ratio' ? 1 : 0); else spacingWeight = value / 100;
      $(field.id === id ? id + '-number' : id).value = value;
      refinement = null; issueReview = null; scheduleRefresh();
    };
    field.onchange = () => {
      delete field.dataset.editing;
      if (field.getAttribute('aria-invalid') === 'true') {
        toast(`请输入 ${field.min}% 至 ${field.max}%`);
        field.value = Number(((key ? gridOptions[key] - (id === 'wide-ratio' ? 1 : 0) : spacingWeight) * 100).toFixed(1));
        field.removeAttribute('aria-invalid');
      }
      refresh();
    };
  }
  for (const [id, key] of Object.entries(optionFields)) $(id).onchange = e => {
    const value = Number(e.target.value);
    if (!e.target.value || !Number.isFinite(value) || value < Number(e.target.min) || value > Number(e.target.max) || key === 'localWindow' && !Number.isInteger(value)) { toast('参数超出允许范围，局部窗口须为整数'); syncControls(); return; }
    remember(); gridOptions[key] = value; refinement = null; issueReview = null; refresh();
  };
  $('aggressive-grid').onchange = e => { remember(); gridOptions.aggressive = e.target.checked; refresh(); };
  $('reset-detection-params').onclick = () => {
    remember();
    spacingWeight = 0.15;
    gridOptions = { ...C.Grid.DEFAULTS, localWindowRatio: 0.5 };
    spacingWindows = null; spacingWindowSize = 0; spacingPreviewAxis = null;
    refinement = null; issueReview = null;
    document.querySelectorAll('[data-phase="2"] input').forEach(input => { input.removeAttribute('aria-invalid'); delete input.dataset.editing; });
    refresh(); toast('自动识别参数已恢复默认值');
  };
  $('reset-grid-params').onclick = () => {
    $('snap-radius').value = 6;
    $('snap-gradient').checked = true;
    $('show-grid').checked = true;
    $('show-gradient').checked = false;
    $('grid-opacity').value = 45;
    $('grid-opacity-value').textContent = '45%';
    syncControls(); draw(); renderLineHandles();
    toast('网格调整参数已恢复默认值');
  };
  $('next-grid-issue').onclick = () => {
    if (!gridIssues.length) return;
    issueReview = null; syncIssueReview();
    const issue = gridIssues[(++gridIssueCursor) % gridIssues.length];
    selectCell(issue.axis === 'x' ? issue.index : 0, issue.axis === 'y' ? issue.index : 0);
    const view = $('canvas-viewport');
    view.scrollTo({ left: issue.axis === 'x' ? (issue.start + issue.gap / 2) * zoom - view.clientWidth / 2 : 0, top: issue.axis === 'y' ? (issue.start + issue.gap / 2) * zoom - view.clientHeight / 2 : 0 });
    toast(`${issue.axis === 'x' ? '列' : '行'} ${issue.index + 1}：${issue.gap.toFixed(1)} px，局部参考 ${issue.expected.toFixed(1)} px${issue.border ? '（图像边缘可能是不完整格）' : ''}`);
  };
  function detectionStatus(d) {
    return { confidence: Math.min(d.x.confidence, d.y.confidence), irregular: d.x.irregular.length + d.y.irregular.length,
      xIssues: d.x.irregular, yIssues: d.y.irregular, xConflicts: d.x.conflicts || [], yConflicts: d.y.conflicts || [],
      inserted: (d.x.edits?.inserted.length || 0) + (d.y.edits?.inserted.length || 0),
      merged: (d.x.edits?.merged.length || 0) + (d.y.edits?.merged.length || 0),
      limitExceeded: d.x.limitExceeded || d.y.limitExceeded };
  }
  $('refine-grid').onclick = async () => {
    $('refine-grid').disabled = true;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try { const next = C.refineGrid(pixels, xs, ys, { ...gridOptions, radius: snapRadius(), gradients }); remember(); issueReview = null; selectedLines.x.clear(); selectedLines.y.clear(); xs = next.xs; ys = next.ys; refinement = next; detection = null; refresh(); toast(next.moved === 0 ? '已达到当前最优状态' : `完成 ${next.iterations} 轮校准，调整 ${next.moved} 条边界`); }
    catch (error) { toast('校准失败：' + error.message); }
    finally { $('refine-grid').disabled = false; }
  };
  $('insert-lines').onclick = () => {
    if (!refinement) return;
    const newX = [...xs, ...refinement.suggestions.x.map(p => p.position)].sort((a, b) => a - b);
    const newY = [...ys, ...refinement.suggestions.y.map(p => p.position)].sort((a, b) => a - b);
    remember(); issueReview = null; applyGridEdit(newX, newY); refresh(); toast('已应用补线建议，可撤销');
  };
  for (const id of ['threshold', 'edge-weight']) {
    $(id).addEventListener('input', e => {
      if (!e.target.dataset.editing) { remember(); e.target.dataset.editing = 'true'; }
      threshold = Number($('threshold').value); edgeWeight = Number($('edge-weight').value) / 100; scheduleRefresh();
    });
    $(id).addEventListener('change', e => { delete e.target.dataset.editing; refresh(); });
  }
  document.querySelectorAll('[data-color-base]').forEach(button => button.onclick = () => {
    colorBaseView = button.dataset.colorBase; syncColorViewControls(); draw();
  });
  document.querySelectorAll('[data-color-category]').forEach(button => button.onclick = () => {
    colorView = colorView === button.dataset.colorCategory ? 'all' : button.dataset.colorCategory;
    syncColorViewControls(); draw();
  });
  document.querySelectorAll('[data-cell-color-mode]').forEach(button => button.onclick = () => {
    if (!selection) return;
    const mode = button.dataset.cellColorMode;
    if (mode === 'manual') { beginManualPick(); return; }
    setTool('select');
    remember(); selectedCells().forEach(cell => { delete colors[cell.key]; cellModes[cell.key] = mode; });
    refresh(); toast(`已将所选 ${selectedCells().length} 格设为${mode === 'mode' ? '众数' : '均值'}取色`);
  });
  for (const id of ['multi-color-threshold', 'multi-color-threshold-number']) {
    $(id).oninput = e => {
      const value = Number(e.target.value);
      if (e.target.value === '' || !Number.isFinite(value) || value < 0 || value > 100) { e.target.setAttribute('aria-invalid', 'true'); return; }
      e.target.removeAttribute('aria-invalid');
      if (!e.target.dataset.editing) { remember(); e.target.dataset.editing = 'true'; }
      multiColorThreshold = value / 100; scheduleRefresh();
    };
    $(id).onchange = e => { delete e.target.dataset.editing; e.target.removeAttribute('aria-invalid'); refresh(); };
  }
  $('apply-mean-issues').onclick = () => {
    if (manualPick) setTool('select');
    refresh();
    const targets = [...result.issues];
    if (!targets.length) { toast('当前没有多色格'); return; }
    remember(); targets.forEach(({ col, row }) => { cellModes[`${col},${row}`] = 'mean'; });
    refresh(); toast(`已将 ${targets.length} 个多色格改为均值取色，可撤销`);
  };
  $('apply-mode-all').onclick = () => {
    if (manualPick) setTool('select');
    refresh(); const targets = [];
    for (let row = 0; row < result.height; row++) for (let col = 0; col < result.width; col++) {
      const key = `${col},${row}`; if (!multiColorKeys.has(key)) targets.push(key);
    }
    if (!targets.length) { toast('当前没有非多色格'); return; }
    remember(); targets.forEach(key => { delete colors[key]; cellModes[key] = 'mode'; }); refresh(); toast(`已对 ${targets.length} 个非多色格应用众数取色，可撤销`);
  };
  $('reset-color-state').onclick = async () => {
    if (!await confirmAction('重置所有格子的颜色取色方式、手动颜色和局部取样？图片与网格会保留，此操作可以撤销。', { title: '重置颜色状态' })) return;
    if (manualPick) setTool('select');
    remember(); samples = {}; colors = {}; cellModes = {}; threshold = 16; edgeWeight = 0.35; multiColorThreshold = 0.65; samplingMode = 'mode'; colorView = 'all'; colorBaseView = 'modified'; selection = null; refresh(); toast('已重置颜色状态，可撤销');
  };
  $('reset-color-params').onclick = () => {
    if (manualPick) setTool('select');
    remember();
    threshold = 16; edgeWeight = 0.35; multiColorThreshold = 0.65;
    colorView = 'all'; colorBaseView = 'modified';
    $('show-issues').checked = true; $('export-scale').value = '16';
    document.querySelectorAll('[data-phase="4"] input').forEach(input => { input.removeAttribute('aria-invalid'); delete input.dataset.editing; });
    refresh(); toast('颜色处理参数已恢复默认值');
  };
  $('rebuild').onclick = async () => {
    const cols = Number($('cols').value), rows = Number($('rows').value);
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > Math.min(128, source.width) || rows > Math.min(128, source.height)) { toast('行列数需为 1–128 的整数，且不超过原图尺寸'); syncControls(); return; }
    if (await confirmAction(`将按 ${cols} 列 × ${rows} 行重新生成整张网格。现有手动边界、局部取样和手动颜色都会被替换或清除。此操作可撤销。`, { warning: true, title: '警告：重建整张网格', label: '确认重建' })) replaceGrid(C.uniformLines(source.width, cols), C.uniformLines(source.height, rows)); else syncControls();
  };
  for (const id of ['pitch-x', 'pitch-y', 'origin-x', 'origin-y']) $(id).addEventListener('change', async () => {
    const px = Number($('pitch-x').value), py = Number($('pitch-y').value), ox = Number($('origin-x').value), oy = Number($('origin-y').value);
    if (![px, py, ox, oy].every(Number.isFinite) || px < 2 || py < 2 || ox < 0 || oy < 0) { toast('请输入有效的间距和非负偏移'); syncControls(); return; }
    if (await allowGridReplace()) {
      const horizontal = id.endsWith('-x');
      replaceGrid(horizontal ? C.pitchLines(source.width, px, ox) : xs, horizontal ? ys : C.pitchLines(source.height, py, oy));
    } else syncControls();
  });
  async function runDetection(recommend = true) {
    if (detecting) return false;
    if (!await allowGridReplace()) return false;
    detecting = true; syncSteps();
    $('detect').disabled = true; $('grid-status').textContent = '正在分析边缘…';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      updateSpacingEvidence();
      const options = { ...gridOptions };
      if (recommend && !hasGrid) for (const axis of ['x', 'y']) {
        const key = axis === 'x' ? 'hintX' : 'hintY';
        if (!options[key]) options[key] = rankedCandidates(axis)[0]?.pitch || 0;
      }
      const d = { x: C.detectAxis(gradients.x, { ...options, spacingWeight, pitchHint: options.hintX }), y: C.detectAxis(gradients.y, { ...options, spacingWeight, pitchHint: options.hintY }) };
      spacingPreviewAxis = null; replaceGrid(d.x.lines, d.y.lines, detectionStatus(d), options);
      initialGrid = { cols: xs.length - 1, rows: ys.length - 1 };
      toast(d.x.limitExceeded || d.y.limitExceeded ? '边缘数超过上限，仅保留较强边缘，请检查网格' : '网格与候选间距已更新');
      return true;
    }
    catch (e) { toast('分析失败：' + e.message); return false; }
    finally { detecting = false; $('detect').disabled = false; syncSteps(); }
  }
  $('detect').onclick = () => runDetection();
  $('reset-all').onclick = async () => { if (!await confirmAction('重置网格、局部取样、手动颜色和取色参数？此操作可以撤销。')) return; remember(); xs = C.uniformLines(source.width, initialGrid.cols); ys = C.uniformLines(source.height, initialGrid.rows); threshold = 16; edgeWeight = 0.35; multiColorThreshold = 0.65; colorView = 'all'; colorBaseView = 'modified'; samplingMode = 'mode'; samples = {}; colors = {}; cellModes = {}; selection = null; issueReview = null; selectedLines.x.clear(); selectedLines.y.clear(); detection = null; refinement = null; refresh(); };
  $('next-issue').onclick = () => {
    if (!result.issues.length) return;
    const current = selection ? selection.y1 * result.width + selection.x1 : -1;
    const next = result.issues.find(c => c.row * result.width + c.col > current) || result.issues[0]; selectCell(next.col, next.row);
    const viewport = $('canvas-viewport'), stage = $('canvas-stage');
    viewport.scrollTo({ left: source.offsetLeft - stage.offsetLeft + xs[next.col] * zoom - viewport.clientWidth / 2, top: source.offsetTop - stage.offsetTop + ys[next.row] * zoom - viewport.clientHeight / 2, behavior: 'smooth' });
  };
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function baseName() { return name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '_'); }
  function updateExportSize() { if (result) $('export-size').textContent = `${result.width * Number($('export-scale').value)} × ${result.height * Number($('export-scale').value)} px · 透明背景保留`; }
  $('export-scale').onchange = updateExportSize;
  $('export').onclick = () => {
    const scale = Number($('export-scale').value), canvas = document.createElement('canvas'), filename = `${baseName()}-${result.width}x${result.height}-${scale}x.png`; canvas.width = result.width * scale; canvas.height = result.height * scale;
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(output, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => { if (blob) { download(blob, filename); toast('PNG 已导出'); } else toast('导出失败'); }, 'image/png');
  };
  $('save-project').onclick = () => {
    const project = { version: 1, name, width: original.width, height: original.height, image: imageURL, xs, ys, samples, colors, cellModes, threshold, edgeWeight, multiColorThreshold, spacingWeight, gridOptions, samplingMode, hasGrid, gridOptionsPending: hasGrid && gridBuildOptions !== optionsKey() };
    download(new Blob([JSON.stringify(project)], { type: 'application/json' }), `${baseName()}.pixel.json`); savedState = snapshot(); changed(); toast('项目已保存');
  };
  function readDataURL(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('无法读取文件')); reader.readAsDataURL(file); }); }
  function loadImage(url) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(Error('无法解码图片')); img.src = url; }); }
  let initialGrid = { cols: 48, rows: 48 };
  function installImage(img, filename, project = null) {
    if (manualPick) setTool('select');
    const factor = Math.min(1, 2048 / Math.max(img.width, img.height));
    original.width = Math.max(1, Math.round(img.width * factor)); original.height = Math.max(1, Math.round(img.height * factor)); octx.imageSmoothingEnabled = false; octx.drawImage(img, 0, 0, original.width, original.height);
    source.width = original.width; source.height = original.height; pixels = octx.getImageData(0, 0, source.width, source.height); imageURL = original.toDataURL('image/png'); name = filename;
    gradients = { x: C.projection(pixels, 'x'), y: C.projection(pixels, 'y') };
    peakEvidence = { x: C.gradientPeaks(gradients.x), y: C.gradientPeaks(gradients.y) };
    spacingWeight = project?.spacingWeight ?? 0.15;
    gridOptions = { ...C.Grid.DEFAULTS, ...project?.gridOptions }; spacingWindows = null; gridIssueCursor = -1;
    gridOptions.localWindowRatio ??= project ? C.clamp(gridOptions.localWindow / Math.max(source.width, source.height), 0.01, 1) : 0.5;
    gridOptions.wideRatio = C.clamp(gridOptions.wideRatio, 1, 2);
    gridBuildOptions = project?.gridOptionsPending ? '' : optionsKey(); spacingPreviewAxis = null;
    xs = project ? project.xs : [0, original.width]; ys = project ? project.ys : [0, original.height];
    samples = project ? project.samples : {}; colors = project ? project.colors : {}; threshold = project ? project.threshold : 16; edgeWeight = project ? project.edgeWeight : 0.35; multiColorThreshold = project?.multiColorThreshold ?? 0.65; colorView = 'all'; colorBaseView = 'modified';
    cellModes = { ...project?.cellModes };
    if (project?.samplingMode === 'mean') for (let row = 0; row < ys.length - 1; row++) for (let col = 0; col < xs.length - 1; col++) cellModes[`${col},${row}`] ??= 'mean';
    detection = null; refinement = null; samplingMode = 'mode';
    hasGrid = project ? project.hasGrid ?? true : false; documentReady = true; step = hasGrid && !project?.gridOptionsPending ? 3 : 2; issueReview = null;
    selectedLines.x.clear(); selectedLines.y.clear();
    initialGrid = { cols: xs.length - 1, rows: ys.length - 1 }; selection = null; undoStack = []; redoStack = []; savedState = snapshot(); syncSteps(); setTool(step === 3 ? 'grid' : 'select'); refresh(); fit();
    if (factor < 1) toast(`图片已缩小至 ${source.width} × ${source.height}`);
  }
  async function importImage(file) {
    if (!file || fileBusy) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('请选择 PNG、JPEG 或 WebP 图片'); return; }
    if (file.size > 30 * 1024 * 1024) { toast('图片文件不能超过 30 MB'); return; }
    fileBusy = true;
    try { const url = await readDataURL(file), img = await loadImage(url); await prepareImport(img, file.name); }
    catch (e) { toast('导入失败：' + e.message); } finally { fileBusy = false; }
  }
  async function prepareImport(img, filename) {
    const prepared = await chooseAlphaTreatment(img); if (!prepared) return;
    const cropped = await chooseCrop(prepared); if (!cropped) return;
    if (dirty && !await confirmAction('导入新图片会清除当前调整。请先保存需要保留的项目。')) return;
    installImage(cropped, filename);
  }
  async function chooseAlphaTreatment(img) {
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(img, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0, translucent = 0;
    const total = data.width * data.height;
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] === 0) transparent++; else if (data.data[i] < 255) translucent++;
    }
    if (transparent === total || transparent + translucent === 0) return img;
    const percent = count => `${(count / total * 100).toFixed(1)}%`;
    $('alpha-description').textContent = `这张图片包含完全透明像素 ${percent(transparent)}、半透明像素 ${percent(translucent)}。透明度会影响取色和导出；均值取色忽略完全透明像素。请选择处理方式，磁盘原图不会被修改。`;
    const dialog = $('alpha-dialog'); dialog.returnValue = '';
    document.querySelector('[name="alpha-treatment"][value="keep"]').checked = true;
    $('alpha-background').value = '#ffffff';
    const choice = await new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'continue' ? document.querySelector('[name="alpha-treatment"]:checked').value : null), { once: true });
      dialog.showModal();
    });
    if (!choice) return null;
    if (choice === 'keep') return img;
    if (choice === 'flatten') {
      context.globalCompositeOperation = 'destination-over'; context.fillStyle = $('alpha-background').value;
      context.fillRect(0, 0, canvas.width, canvas.height); context.globalCompositeOperation = 'source-over';
    } else {
      for (let i = 3; i < data.data.length; i += 4) if (data.data[i] > 0) data.data[i] = 255;
      context.putImageData(data, 0, 0);
    }
    return canvas;
  }
  $('import').onclick = () => $('image-input').click(); $('image-input').onchange = e => { importImage(e.target.files[0]); e.target.value = ''; };
  $('open-project').onclick = () => $('project-input').click(); $('project-input').onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file || fileBusy) return; fileBusy = true;
    try {
      if (file.size > 45e6) throw Error('项目文件过大');
      const project = C.validateProject(JSON.parse(await file.text())), img = await loadImage(project.image);
      if (img.width !== project.width || img.height !== project.height) throw Error('项目图片和网格尺寸不一致');
      if (dirty && !await confirmAction('打开项目会清除当前未保存的调整。')) return;
      installImage(img, typeof project.name === 'string' ? project.name.slice(0, 200) : '未命名项目', project); toast('项目已打开');
    } catch (error) { toast('打开失败：' + error.message); } finally { fileBusy = false; }
  };
  let dragDepth = 0;
  document.addEventListener('dragenter', e => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
  document.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
  document.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging'); importImage(e.dataTransfer.files[0]); });
  document.addEventListener('keydown', e => {
    if ($('confirm-dialog').open || $('crop-dialog').open || $('alpha-dialog').open || $('parameter-help-dialog').open || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $(e.shiftKey ? 'redo' : 'undo').click(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $('save-project').click(); }
    if (e.key === 'Escape') { if (manualPick) { setTool('select'); updateSelection(); return; } setAddLineMode(false); spacingPreviewAxis = null; selection = null; selectedLines.x.clear(); selectedLines.y.clear(); updateLineSelectionUI(); updateSelection(); draw(); drawPreview(); }
  });
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  const headerObserver = new ResizeObserver(() => {
    const height = document.querySelector('.app-header').offsetHeight + document.querySelector('.workflow').offsetHeight;
    document.documentElement.style.setProperty('--top-height', `${height}px`);
  });
  headerObserver.observe(document.querySelector('.app-header')); headerObserver.observe(document.querySelector('.workflow'));
  let resizeTimer; window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fit, 100); });

  function createDemo() {
    const base = document.createElement('canvas'); base.width = base.height = 48; const c = base.getContext('2d');
    const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
    rect('#bfd9d4', 0, 0, 48, 48);
    rect('#d9e9dc', 4, 5, 9, 2); rect('#d9e9dc', 7, 4, 4, 1); rect('#e8eedc', 34, 7, 8, 2); rect('#e8eedc', 36, 6, 4, 1);
    for (let x = 0; x < 48; x++) { const y = Math.round(12 + Math.abs(x - 14) * 0.48); rect('#8daaa9', x, y, 1, 30 - y); const z = Math.round(11 + Math.abs(x - 35) * 0.64); rect('#749697', x, z, 1, 31 - z); }
    rect('#668d78', 0, 24, 48, 24); rect('#7b9d70', 0, 31, 48, 17); rect('#8bab76', 0, 36, 48, 12);
    const tree = (x, y, h) => { rect('#526b57', x, y + h - 3, 2, 5); for (let j = 0; j < h; j++) { const half = Math.floor(j * 0.35); rect('#345e51', x - half, y + j, half * 2 + 2, 1); if (half > 0) rect('#47775e', x - half, y + j, half + 1, 1); } };
    tree(3, 13, 16); tree(9, 19, 12); tree(43, 14, 17); tree(38, 20, 12); tree(0, 23, 13); tree(46, 24, 14);
    rect('#6a825b', 10, 38, 29, 3); rect('#637652', 14, 40, 18, 2);
    rect('#f0dba1', 14, 26, 21, 13); rect('#dac087', 29, 27, 6, 12); rect('#c3a675', 14, 38, 21, 2);
    rect('#8c584b', 29, 16, 3, 8); rect('#d0aa85', 29, 15, 3, 1); rect('#a15e4d', 30, 17, 2, 2);
    for (let y = 18; y <= 28; y++) { const half = y - 18; rect('#694a45', 24 - half, y, half * 2 + 2, 2); rect(y % 3 === 0 ? '#ba7356' : '#c78560', 24 - half, y, half * 2 + 1, 1); if (half > 1) rect('#d19668', 24 - half, y, Math.max(1, half - 2), 1); }
    rect('#e4c688', 14, 29, 21, 1); rect('#6a6851', 23, 32, 5, 8); rect('#9b8c60', 24, 32, 3, 8); rect('#ecd495', 26, 36, 1, 1);
    for (const x of [16, 30]) { rect('#826c50', x, 31, 4, 5); rect('#506e66', x + 1, 32, 2, 3); rect('#eacb83', x + 1, 33, 2, 1); rect('#f3d79c', x, 36, 5, 1); }
    rect('#e9d6a1', 24, 39, 4, 2); rect('#c5ba89', 23, 41, 5, 2); rect('#d0c595', 22, 43, 6, 2); rect('#dace9f', 20, 45, 7, 3);
    rect('#527d58', 12, 36, 2, 5); rect('#6c945f', 10, 38, 5, 2); rect('#557e56', 34, 38, 5, 3);
    for (const [x, y] of [[5, 36], [9, 43], [15, 45], [34, 45], [40, 40], [42, 46], [3, 44], [37, 35]]) { rect('#628452', x, y + 1, 1, 2); rect('#f2e1ad', x, y, 1, 1); rect('#e6cf7d', x + 1, y + 1, 1, 1); }
    for (const [x, y] of [[2, 39], [17, 42], [32, 43], [39, 44], [7, 32], [44, 34], [13, 34], [30, 46]]) rect('#76935e', x, y, 2, 1);
    const small = c.getImageData(0, 0, 48, 48), large = document.createElement('canvas'); large.width = large.height = 480;
    const lctx = large.getContext('2d'), data = lctx.createImageData(480, 480);
    let seed = 725;
    for (let y = 0; y < 480; y++) for (let x = 0; x < 480; x++) {
      const sx = C.clamp(Math.floor((x + Math.sin(y / 67) * 1.6) / 10), 0, 47), sy = C.clamp(Math.floor((y + Math.sin(x / 93) * 1.2) / 10), 0, 47);
      const a = (sy * 48 + sx) * 4, b = (y * 480 + x) * 4; seed = (seed * 1664525 + 1013904223) >>> 0; const noise = (seed % 5) - 2;
      for (let k = 0; k < 3; k++) data.data[b + k] = small.data[a + k] + noise; data.data[b + 3] = 255;
    }
    lctx.putImageData(data, 0, 0); return large;
  }
  installImage(createDemo(), name);
  documentReady = false; setStep(1);
})();
