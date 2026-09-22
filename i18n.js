(() => {
  'use strict';
  const STORAGE_KEY = 'pixel-studio-language';
  const messages = {
    '像素校准室 · Pixel Studio': 'Pixel Studio', '像素校准室': 'Pixel Studio', '语言': 'Language', '界面语言': 'Interface language', '中文': 'Chinese',
    '山间小屋 · 示例': 'Mountain Cabin · Demo', '本地工作区': 'Local workspace', '有未保存的调整': 'Unsaved changes',
    '打开项目': 'Open project', '保存项目': 'Save project', '导入图片': 'Import image', '导出 PNG': 'Export PNG', '处理步骤': 'Workflow',
    '选择图片': 'Choose image', '自动识别': 'Auto detect', '手动调整网格': 'Adjust grid', '手动调整颜色': 'Adjust colors',
    '自动识别网格': 'Detect grid', '等待分析': 'Waiting for analysis', '横向间距': 'Horizontal spacing', '纵向间距': 'Vertical spacing',
    '横向间距候选': 'Horizontal spacing suggestions', '纵向间距候选': 'Vertical spacing suggestions', '高级参数': 'Advanced settings',
    '间距约束': 'Spacing regularity', '搜索半径 / 间距': 'Search radius / spacing', '局部窗口 / 原图': 'Local window / image', '局部窗口': 'Local window',
    '过窄：低于间距': 'Too narrow: below spacing', '过宽：超出间距': 'Too wide: above spacing', '自动补线与合并窄格': 'Insert missing lines and merge narrow cells',
    '重置参数为默认值': 'Reset settings', '自动迭代校准': 'Auto refine', '校准位移上限': 'Maximum refinement shift', '应用补线建议': 'Apply line suggestions',
    '没有宽窄异常': 'No spacing issues', '切分全部过宽': 'Split all wide cells', '合并全部过窄': 'Merge all narrow cells',
    '逐项确认过宽': 'Review wide cells', '逐项确认过窄': 'Review narrow cells', '确认': 'Apply', '跳过': 'Skip', '结束确认': 'End review',
    '拖动时梯度吸附': 'Snap to gradients while dragging', '显示网格': 'Show grid', '显示梯度强度': 'Show gradient strength', '网格透明度': 'Grid opacity',
    '列数': 'Columns', '行数': 'Rows', '按行列数重建': 'Rebuild by rows and columns', '间距与偏移': 'Spacing and offset',
    '水平间距': 'Horizontal spacing', '垂直间距': 'Vertical spacing', '水平偏移': 'Horizontal offset', '垂直偏移': 'Vertical offset',
    '查看显示': 'View', '查看原图': 'Original', '查看修改后': 'Modified', '众数格': 'Mode cells', '均值格': 'Mean cells', '手动颜色': 'Manual colors', '多色格': 'Multicolor cells',
    '对当前所有非多色格应用众数取色': 'Apply mode color to all non-multicolor cells', '重置回初始状态': 'Reset color state',
    '颜色合并阈值': 'Color merge threshold', '边缘权重': 'Edge weight', '多色格阈值': 'Multicolor threshold',
    '对当前所有多色格应用均值取色': 'Apply mean color to all multicolor cells', '标记多色格': 'Mark multicolor cells', '正在计算': 'Calculating',
    '上一步': 'Previous step', '下一步': 'Next step', '本地处理 · 图片不上传': 'Processed locally · Images are never uploaded',
    '导入一张 AI 像素图，或用下面的例图试一试。': 'Import an AI-generated pixel image or try one of the examples below.', '浏览例图': 'Browse examples', '继续当前图片': 'Continue current image',
    '用例图开始': 'Start with an example', '点击图片即可导入': 'Click an image to import it', '适合什么样的图片？': 'What images work best?',
    '适合质量较高、像素轮廓较清楚的 AI 生成图，重点是手动调整原图色块与目标网格的对应关系。优先保留面部等局部特征，因此不同区域可能出现程度不一的压缩或拉伸。': 'Best for high-quality AI-generated images with clear pixel contours. The tool helps align source color blocks to a target grid while prioritizing local features such as faces, so some areas may be compressed or stretched.',
    '更适合制作 ': 'It works best for pixel art under ', '60 × 60 格以下': '60 × 60 cells', '的像素图。更高格数也能处理，但相比其他工具，优势可能不明显。': '. Larger grids are supported, but may benefit less from this workflow.',
    '生成图片前的建议': 'Tips before generating an image', '两张参考图，分工更明确': 'Use two references with distinct roles',
    '推荐尝试 GPT 或 Banana 图像生成模型，同时提供一张': 'Try an image generation model such as GPT or Banana and provide one ', '画风参考': 'style reference', '和一张': ' and one ', '内容参考': 'content reference', '，分别说明要借鉴的像素风格和要描绘的主体。': ', clearly identifying the pixel style and subject.',
    '给主体加像素白边，保留背景': 'Add a pixelated white outline and keep the background', '阶梯状白色像素描边': 'stepped white pixel outline', '要求主体外围有': 'Ask for a ',
    '，并配上背景。这有助于模型表现更清晰、规整的像素网格，但仍可能需要校准。': ' around the subject and include a background. This helps produce a clearer, more regular pixel grid, though refinement may still be needed.',
    '像素白边示意': 'Pixel outline example', '明确哪些特征最重要': 'State which features matter most', '在指令里说明细节的优先级，例如：': 'Describe detail priorities in the prompt, for example: ',
    '强调面部特征，简化身体细节': 'emphasize facial features and simplify body details', '，让有限的像素集中表达主体的辨识度。': ', so the limited pixels preserve the subject’s identity.',
    '像素格数只是目标，不是保证': 'Grid size is a target, not a guarantee',
    '可以要求特定的像素宽高，但模型往往难以严格遵循，且倾向生成更多格子。例如要求 15 × 15，实际可能接近 25 × 25；要求 30 × 30，可能接近 50 × 50。': 'You can request a specific pixel width and height, but models often produce more cells. A 15 × 15 request may be closer to 25 × 25, while 30 × 30 may approach 50 × 50. ',
    '这些是经验示例，不是固定换算比例。': 'These are practical examples, not a fixed conversion ratio.',
    '编辑工具': 'Editing tools', '选择格子': 'Select cells', '调整网格线': 'Adjust grid lines', '合并选中网格线': 'Merge selected grid lines', '手动加入网格线': 'Add grid line',
    '新网格线方向': 'New grid line direction', '竖线': 'Vertical', '横线': 'Horizontal', '取消加线': 'Cancel adding line', '撤销': 'Undo', '重做': 'Redo',
    '缩小': 'Zoom out', '适合窗口': 'Fit to view', '放大': 'Zoom in', '原图与网格': 'Original and grid', '关闭间距预览': 'Close spacing preview',
    '标记说明：': 'Markers:', '虚线': 'Dashed lines', '虚线标记说明': 'About dashed markers', '过宽': 'Too wide', '过宽标记说明': 'About wide-cell markers', '过窄': 'Too narrow', '过窄标记说明': 'About narrow-cell markers',
    '拖放图片到这里': 'Drop an image here', '实时预览': 'Live preview', '种颜色': ' colors', '选择一个格子开始调整': 'Select a cell to start editing',
    '众数取色': 'Mode color', '均值取色': 'Mean color', '手动取色': 'Pick color manually', '指定颜色': 'Custom color', '应用颜色': 'Apply color',
    '输出': 'Output', '导出倍率': 'Export scale', '透明背景保留': 'Transparency preserved', '会话': 'Session', '重置全部调整': 'Reset all changes',
    '透明度处理': 'Transparency', '取消': 'Cancel', '继续': 'Continue', '裁剪图片': 'Crop image', '取消导入': 'Cancel import', '跳过裁剪': 'Skip crop', '裁剪并继续': 'Crop and continue',
    '关闭': 'Close', '替换当前画面？': 'Replace the current image?', '项目已打开': 'Project opened', '项目已保存': 'Project saved', 'PNG 已导出': 'PNG exported',
    '等待识别': 'Waiting for detection', '所选格子取色方式': 'Selected cell color method', '众数': 'Mode', '均值': 'Mean', '先在画布中选择格子': 'Select cells on the canvas first',
    '标记说明': 'Marker guide', '松开以导入图片': 'Release to import image', '像素预览': 'Pixel preview', '实时': 'Live', '导出设置': 'Export settings', 'PNG 缩放': 'PNG scale',
    '1× · 原始像素': '1× · Original pixels', '8× · 清晰放大': '8× · Crisp enlargement', '16× · 清晰放大': '16× · Crisp enlargement', '32× · 清晰放大': '32× · Crisp enlargement',
    '项目操作': 'Project actions', '当前未保存的调整将被清除。': 'Current unsaved changes will be discarded.', '图片含有效透明度': 'Image contains transparency',
    '保留透明': 'Keep transparency', '保留原有透明与半透明效果。': 'Keep the existing transparent and translucent pixels.', '铺底色，转为不透明图片': 'Flatten onto a background color',
    '将透明和半透明区域与所选底色混合。': 'Blend transparent and translucent areas with the selected background color.', '底色': 'Background color',
    '可见像素转不透明': 'Make visible pixels opaque', '保留完全透明区域，将其余像素的透明度设为 100%；边缘可能变硬。': 'Keep fully transparent areas and make all other pixels opaque; edges may become harder.',
    '继续导入': 'Continue import', '局部放大': 'Magnifier', '左': 'Left', '上': 'Top', '宽': 'Width', '高': 'Height',
    '间距约束说明': 'About spacing regularity', '间距约束百分比': 'Spacing regularity percentage', '搜索半径说明': 'About search radius', '搜索半径百分比': 'Search radius percentage',
    '局部窗口说明': 'About local window', '局部窗口百分比': 'Local window percentage', '过窄阈值说明': 'About narrow threshold', '过窄阈值': 'Narrow threshold', '过窄阈值百分比': 'Narrow threshold percentage',
    '过宽阈值说明': 'About wide threshold', '过宽阈值': 'Wide threshold', '过宽阈值百分比': 'Wide threshold percentage', '校准位移上限（像素）': 'Maximum refinement shift (pixels)',
    '水平间距说明': 'About horizontal spacing', '垂直间距说明': 'About vertical spacing', '水平偏移说明': 'About horizontal offset', '垂直偏移说明': 'About vertical offset',
    '颜色合并阈值说明': 'About color merge threshold', '边缘权重说明': 'About edge weight', '多色格阈值说明': 'About multicolor threshold', '多色格阈值百分比': 'Multicolor threshold percentage',
    '恢复间距候选设置和识别参数，当前网格保留到下一次识别': 'Restore spacing suggestions and detection settings; keep the current grid until the next detection',
    '从边缘向中心迭代，结合色块纯净度和梯度调整现有网格': 'Refine the grid from the edges inward using color purity and gradients',
    '恢复校准位移、吸附及网格显示参数，保留当前网格边界': 'Restore refinement, snapping, and grid display settings while keeping current boundaries',
    '恢复所有格子的初始颜色状态，保留图片与网格，可撤销': 'Restore the initial color state for all cells while keeping the image and grid; undoable',
    '恢复取色阈值、边缘权重与显示参数，保留每格取色方式和手动颜色': 'Restore color thresholds, edge weight, and display settings while keeping cell methods and manual colors',
    '蓝色背景的人物像素头像': 'Pixel portrait on a blue background', '带白色像素描边的人物头像': 'Portrait with a white pixel outline', '白色阶梯描边与青色背景的像素画示例': 'Pixel art with a stepped white outline and cyan background',
    '编辑历史': 'Edit history', '适应画布': 'Fit canvas', '结束间距预览': 'End spacing preview', '网格标记说明': 'Grid marker guide', '原图网格编辑画布': 'Original image grid editing canvas',
    '网格线端点': 'Grid line endpoints', '最终像素预览': 'Final pixel preview', '重新框选': 'Draw crop again', '重置为整张图片': 'Reset to full image', '裁剪选区': 'Crop selection',
    '鼠标焦点附近的八倍放大图': '8× magnified view around the pointer', '拖动边界调整，远离边界拖动重新框选；Alt 拖动框内移动': 'Drag an edge to adjust it, drag away from an edge to redraw, or Alt-drag inside to move the crop',
    '对所选格子应用众数取色': 'Apply mode color to selected cells', '对所选格子应用均值取色': 'Apply mean color to selected cells', '放大所选格子并从原图取色': 'Magnify the selected cell and pick a color from the original',
    '虚线标记': 'Dashed markers', '过宽标记': 'Wide-cell markers', '过窄标记': 'Narrow-cell markers',
    '虚线表示推测边界、边缘冲突或待确认的调整建议；点击查看各颜色含义': 'Dashed lines mark inferred boundaries, edge conflicts, or suggestions awaiting review; click for the color guide',
    '橙色区域表示间距超过当前过宽阈值，可能缺少分割线': 'Orange areas exceed the wide-cell threshold and may be missing a dividing line',
    '粉色区域表示间距低于当前过窄阈值，可能存在多余分割线': 'Pink areas fall below the narrow-cell threshold and may contain an extra dividing line'
  };
  const patterns = [
    [/^(\d+) 格$/, '$1 cells'], [/^(\d+) 种颜色$/, '$1 colors'], [/^已选择 (\d+) 格 · (.+)$/, 'Selected $1 cells · $2'],
    [/^(\d+) 个多色格待检查$/, '$1 multicolor cells to review'], [/^(\d+) 处过宽 · (\d+) 处过窄$/, '$1 wide · $2 narrow'],
    [/^(\d+) 列 × (\d+) 行$/, '$1 columns × $2 rows'], [/^第 (\d+) 推荐：(.+) 像素$/, 'Suggestion $1: $2 pixels'],
    [/^应用 (\d+) 条补线建议$/, 'Apply $1 line suggestions'], [/^图片已缩小至 (.+)$/, 'Image resized to $1'],
    [/^众数 (\d+) · 均值 (\d+) · 手动 (\d+) · 多色 (\d+)$/, 'Mode $1 · Mean $2 · Manual $3 · Multicolor $4'],
    [/^自动补线 (\d+) 条 · 合并窄格 (\d+) 处（可撤销）$/, 'Inserted $1 lines · merged $2 narrow cells (undoable)'],
    [/^已达到当前最优状态$/, 'Current optimum reached'], [/^正在分析边缘…$/, 'Analyzing edges…'], [/^未选择$/, 'No selection'],
    [/^(.+) · 透明背景保留$/, '$1 · Transparency preserved'], [/^原图 · 点击选中格子内的颜色（Esc 取消）$/, 'Original · Click a color in the selected cell (Esc to cancel)'],
    [/^横向 (.+) px$/, 'Horizontal $1 px'], [/^纵向 (.+) px$/, 'Vertical $1 px'],
    [/^导入例图 (.+)$/, 'Import example $1'], [/^例图 (.+)$/, 'Example $1'], [/^#(.+) · (\d+) 格$/, '#$1 · $2 cells']
  ];
  const helpMessages = {
    'Spacing regularity': 'Lower values follow image edges more closely; higher values favor regular spacing.\n\nThis is a soft constraint: 0% uses gradient peaks only, while larger values increasingly favor positions near the previous line plus the reference spacing.',
    'Search radius / spacing': 'Lower values search close to the predicted position; higher values allow a line to move farther.\n\nFor 20 px spacing at 35%, the search radius is about 7 px. A larger radius permits more correction, but may select a nearby unrelated edge.',
    'Local window': 'Smaller windows follow local spacing changes; larger windows favor patterns shared across a wider area.\n\nThe percentage is based on image width for horizontal detection and height for vertical detection. The window is always at least 8 px.',
    'Narrow threshold': 'Cells narrower than this percentage of the local reference spacing are marked as narrow.\n\nLower values flag only extreme cases. At 60% with 20 px spacing, cells below 12 px are marked. Automatic processing may merge them.',
    'Wide threshold': 'Controls how much wider than the reference spacing a cell may be before it is marked.\n\nAt 65% with 20 px spacing, cells over 33 px are marked. Automatic processing may insert a missing line inside them.',
    'Horizontal spacing': 'Sets the horizontal cell spacing in pixels. Changing it rebuilds vertical boundaries using this spacing and the horizontal offset, replacing local width variations. The operation is undoable.',
    'Vertical spacing': 'Sets the vertical cell spacing in pixels. Changing it rebuilds horizontal boundaries using this spacing and the vertical offset, replacing local height variations. The operation is undoable.',
    'Horizontal offset': 'Moves the repeating vertical-line pattern relative to the image’s left edge. The image perimeter remains fixed, and the operation is undoable.',
    'Vertical offset': 'Moves the repeating horizontal-line pattern relative to the image’s top edge. The image perimeter remains fixed, and the operation is undoable.',
    'Color merge threshold': 'Lower values distinguish similar colors more strictly; higher values group them more readily. This affects mode sampling only, not mean or manually assigned colors.',
    'Edge weight': 'Lower values emphasize the center of each cell; higher values give edge pixels more influence. Cell edges often contain grid lines, antialiasing, or neighboring colors.',
    'Multicolor threshold': 'A mode-sampled cell is marked multicolor when its dominant color cluster falls below this share. Mean and manually colored cells count as already handled.',
    'Dashed markers': 'Dashed lines identify boundaries or suggestions that deserve review. Orange marks inferred boundaries, red marks unused image edges, orange-red marks unresolved refinement issues, and blue previews proposed edits.',
    'Wide-cell markers': 'Orange regions are wider than the current local spacing threshold and may be missing one or more dividing lines. Review or split them in step 3.',
    'Narrow-cell markers': 'Pink regions are narrower than the current local spacing threshold and may contain an extra boundary. Edge cells can be naturally incomplete, so review them before merging.'
  };
  let language = localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh-CN';
  const originalText = new WeakMap(), appliedText = new WeakMap(), originalAttrs = new WeakMap(), appliedAttrs = new WeakMap();
  const translate = value => messages[value] || patterns.reduce((out, [pattern, replacement]) => out === value && pattern.test(value) ? value.replace(pattern, replacement) : out, value);
  function localizeText(node) {
    const current = node.nodeValue;
    if (current !== appliedText.get(node)) originalText.set(node, current);
    const source = originalText.get(node) ?? current;
    const help = node.parentElement?.id === 'parameter-help-text' ? helpMessages[document.getElementById('parameter-help-title')?.textContent] : null;
    const next = language === 'en' ? help || translate(source) : source;
    if (current !== next) node.nodeValue = next;
    appliedText.set(node, next);
  }
  function localizeElement(element) {
    let originals = originalAttrs.get(element), applied = appliedAttrs.get(element);
    if (!originals) { originals = {}; applied = {}; originalAttrs.set(element, originals); appliedAttrs.set(element, applied); }
    for (const attr of ['title', 'aria-label', 'placeholder', 'alt']) if (element.hasAttribute(attr)) {
      const current = element.getAttribute(attr);
      if (current !== applied[attr]) originals[attr] = current;
      const next = language === 'en' ? translate(originals[attr]) : originals[attr];
      if (current !== next) element.setAttribute(attr, next);
      applied[attr] = next;
    }
  }
  function localize(root = document.body) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) return localizeText(root);
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) walker.currentNode.nodeType === Node.TEXT_NODE ? localizeText(walker.currentNode) : localizeElement(walker.currentNode);
  }
  function setLanguage(next) {
    language = next === 'en' ? 'en' : 'zh-CN'; localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language; localize(document); document.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
  }
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('language-select'); select.value = language; select.addEventListener('change', () => setLanguage(select.value));
    setLanguage(language);
    const observer = new MutationObserver(records => records.forEach(record => record.type === 'characterData' ? localizeText(record.target) : record.type === 'attributes' ? localizeElement(record.target) : record.addedNodes.forEach(localize)));
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder', 'alt'] });
  });
  window.PixelI18n = { get language() { return language; }, setLanguage, translate };
})();
