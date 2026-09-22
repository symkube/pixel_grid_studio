# 像素校准室 · Pixel Studio

[中文](#中文) · [English](#english)

## 中文

直接在浏览器打开 `index.html`。无需安装、无需网络，图片仅在浏览器本地处理。

顶部语言菜单可切换中文与 English，浏览器会记住语言偏好。

### 部署到 GitHub Pages

项目为纯静态网站，无需服务器、构建工具或 API 密钥。仓库已包含 `.github/workflows/pages.yml`，将测试算法并发布网页所需的文件。

1. 在 GitHub 创建空仓库，将本项目上传到 `main` 分支；使用 Git 上传时，应包含 `.github/workflows/pages.yml`。
2. 打开仓库的 **Settings → Pages → Build and deployment**，将 **Source** 设为 **GitHub Actions**。
3. 打开 **Actions → Deploy GitHub Pages → Run workflow**，选择 `main` 并运行。之后每次推送到 `main` 都会自动部署。
4. 成功后，在 **Settings → Pages** 或部署任务的 `github-pages` 环境中打开实际网站地址。普通项目仓库通常为 `https://<用户名>.github.io/<仓库名>/`。

如果默认分支不是 `main`，将工作流中的 `on.push.branches` 改为实际分支名。GitHub Pages 是否支持私有仓库取决于账号方案。网站发布后，访客导入的图片仍只在各自浏览器内处理。

工作流仅发布页面、脚本、样式、`pics` 和 `vendor`；测试、诊断记录和本地生成文件不会进入网站部署包。上传仓库前，请确认仓库中的例图与诊断素材适合公开且有权发布。项目暂未指定整体开源许可证；Lucide 的许可文件保留在 `vendor/LICENSE-lucide`。

导入前的首屏提供适用范围、四条 AI 图片生成建议，以及 `pics` 中的 5 张可点击例图。例图与自选图片共用透明度处理和裁剪流程；返回第一步时可继续当前图片，不会丢失已有调整。白色像素描边建议附有独立示意图。像素格数的 15→25、30→50 仅作为经验示例，不是固定换算比例。

## 使用

1. 选择图片：导入 PNG、JPEG 或 WebP 时，若同时含可见内容和有效透明度，会提示完全透明、半透明像素的比例，可选择保留透明、铺指定底色转不透明，或仅将可见像素转不透明；全不透明或整图全透明不弹此提示。随后默认生成去掉近纯色边缘的裁剪框；纯色整图保留原范围，自动框选可随时调整或重置。拖动四边或四角调整范围，远离边框拖动可重画，Alt 拖动框内可整体移动；边缘有 18 CSS 像素的安全带，避免误建新框。旁边显示鼠标附近的 8 倍放大图。左、上、宽、高支持直接输入整数，不限制在原图范围内；超出部分保留透明，宽高须大于 0。可跳过或取消裁剪。
2. 自动识别：点击识别按钮估计网格，停留在本步，分别给出按推荐顺序排列的横向、纵向间距候选。点击候选或间距输入框，可在淡化的原图上单独预览对应方向的等距参考线；点击中央画布或关闭按钮恢复实际网格。两个间距始终显示，0 表示按局部证据估计；高级参数默认折叠，每项带说明按钮、百分比滑条和数字输入。局部窗口按横向图宽、纵向图高计算，默认 50%，至少 8 px；过窄 60% 表示小于参考间距的 60%，过宽 65% 表示超过参考间距 65%（1.65 倍）。选择「下一步」时应用当前参数，再进入手动网格步骤。预览参考线不直接替换实际边界。
3. 手动调整网格：顶部「自动迭代校准」按图像边缘和色块纯净度调整网格，无变化时显示绿色对勾及「已达到当前最优状态」，仍可查看待检查位置。拖动线条或两端圆点可移动边界，拖动时加粗；点击或框选端点可选择同一方向的连续线。点击较远端点会补选中间线；点击选区端点取消该端，点击中间线则改为单选。画布工具区可按平均坐标合并选中线，或点击「手动加入网格线」、选择横线或竖线后在图上点击加入；Esc 取消加线。增删线保留原图并继承对应格子的手动颜色，支持撤销。过宽、过窄支持批量处理和逐项确认。显示与吸附设置位于行列数上方；按行列数重建总会先显示警告。间距与偏移设置在底部默认折叠，说明按钮解释其影响。
4. 手动调整颜色：默认使用带色差阈值的众数取色。选中格子后，在中央工具栏直接选择众数或均值；点击「手动取色」自动进入一次性吸管状态，临时显示原图并居中定位选中格子，等比缩放至宽高均不超过中央工作区约 1/4。点击该格内的颜色即可完成，恢复原视图与缩放；Esc 或再次点击「手动取色」取消。众数、均值支持整个选区；手动取色一次处理一格，多选时定位左上角格子。左侧「查看原图 / 查看修改后」切换中央底图，下一行分类按钮强调众数格、均值格、手动颜色或多色格，再次点击取消；其他格子淡化并覆盖滚动细线，右侧预览与导出始终保留完整修改结果。多色阈值用于检查众数格，已设为均值或手动颜色的格子视为已处理。可对当前全部多色格应用均值，或对当前全部非多色格应用众数（包括清除这些格子的手动颜色）。「重置回初始状态」清除颜色和局部取样调整、恢复默认取色参数，保留图片及网格，支持撤销。第四步不再提供矩形取样、区域移动或方向键移动取样；旧项目的局部取样数据仍保留。

第 2、3、4 步底部均提供「重置参数为默认值」：分别恢复识别参数、校准与显示参数、取色与颜色显示参数；保留网格边界和格子颜色方式。颜色参数重置与「重置回初始状态」是两个独立操作。

导出一格一像素 PNG 或整数倍放大 PNG；保存项目保留当前图像、网格、局部取样、手动颜色和取色模式。裁剪不会修改磁盘上的原始图片，项目保存的是裁剪后工作图。

网格识别依赖画面中可见的重复边缘，对纯色、斜线丰富或存在多套网格的图片，需手动修正。局部调整只影响取样，不改变原图。图片最大边长为 2048 像素，超出时会提示并缩小；每个方向最多 128 格。均值取色完全排除 alpha=0 的像素（RGB 与透明度平均均不计入）；半透明像素的 RGB 按 alpha 加权，透明度按有效覆盖面积平均；整格无可见像素时保持全透明。

## 开发与验证

例图缩略图直接使用 `pics` 中的图片。为兼容直接通过 `file://` 打开页面时的 Canvas 安全限制，导入例图使用按需加载的 `pics/examples-data.js`；替换例图后运行 `node tools/build-examples.cjs` 重新生成数据包。新增例图时同时更新首屏列表和该生成脚本。`pics/white-outline-reference.png` 仅用于建议中的白边示意，不参与例图导入列表。

页面使用原生 HTML、CSS、Canvas 和 JavaScript，无构建步骤。`core.js` 包含网格分析和取色算法，`app.js` 包含编辑器状态及交互，`vendor/lucide.min.js` 为 MIT 许可的 Lucide 图标库。

运行算法测试：`node --test tests/core.test.cjs`。

文件名、分辨率和未保存提示与主操作共用顶部栏；撤销、重做位于中央画布工具栏。

项目 JSON 包含原图和所有编辑参数。撤销历史保留最近 40 次操作，切换图片或打开项目时清空。

参数界面后续重设计已记入 `MEMO.md`。宽窄处理使用当前局部参考；切分先预测等分位置再局部吸附梯度，无边缘时保留预测位置。过窄内部格合并两侧边界至平均位置，边缘格删除内部边界且固定图像外框。网格改变后，局部取样和手动颜色按新格中心对应的旧格继承，必要时可撤销恢复。

## English

Pixel Studio helps turn AI-generated pixel-style images into a calibrated pixel grid. Open `index.html` directly in a browser: no installation or network connection is required, and images are processed locally. Use the language menu in the header to switch between Chinese and English; the browser remembers your preference.

The start screen includes five clickable examples, guidance on suitable images, and four image-generation tips. Examples use the same transparency and crop workflow as imported files. Returning to the first step lets you continue the current image without losing edits. The illustrated white-outline tip is a separate reference image. Suggested grid-size examples such as 15→25 and 30→50 are observations, not fixed conversion ratios.

### Deploy to GitHub Pages

This is a static website with no server, build system, or API keys. The included `.github/workflows/pages.yml` runs the algorithm tests and publishes the website files.

1. Create an empty GitHub repository and upload this project to its `main` branch, including `.github/workflows/pages.yml`.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Actions → Deploy GitHub Pages → Run workflow**, select `main`, and run it. Future pushes to `main` deploy automatically.
4. Once deployment succeeds, open the actual site URL from **Settings → Pages** or the deployment's `github-pages` environment. A project site normally uses `https://<username>.github.io/<repository>/`.

If your default branch is not `main`, update `on.push.branches` in the workflow. GitHub Pages availability for private repositories depends on your account plan. Visitors' imported images remain in their own browsers after the site is published.

Only the page, scripts, styles, `pics`, and `vendor` are deployed. Tests, diagnostic records, and local generated files are excluded from the website artifact. Before publishing the repository, check that its example and diagnostic images are suitable for public release and that you have permission to publish them. No project-wide open-source license has been selected; Lucide's license is preserved in `vendor/LICENSE-lucide`.

### Usage

1. **Choose an image.** Import PNG, JPEG, or WebP. Images containing both visible pixels and transparency offer three choices: keep transparency, flatten onto a background color, or make visible pixels opaque. Fully opaque and fully transparent images skip this prompt. The crop dialog initially excludes nearly uniform borders; uniform images keep their full bounds. Drag edges or corners to resize, drag away from an edge to redraw, or Alt-drag inside to move the selection. An 18 CSS-pixel safety zone around the boundary helps avoid accidental redraws. An 8× magnifier follows the pointer. Left, top, width, and height accept integers, including coordinates outside the image; out-of-bounds areas remain transparent, and width and height must be positive. You can reset, skip, or cancel cropping.
2. **Auto detect.** Detect the grid and inspect horizontal and vertical spacing suggestions, ranked by recommendation. Clicking a suggestion or spacing input previews equally spaced reference lines over a faded original image; clicking the canvas or closing the preview restores the actual grid. A spacing of 0 estimates it from local evidence. Advanced settings provide help, percentage sliders, and numeric inputs. The local window defaults to 50% of image width or height, with a minimum of 8 px. A narrow threshold of 60% flags cells below 60% of reference spacing; a wide threshold of 65% flags cells above 1.65 times the reference. Moving to the next step applies the current settings. Preview lines alone do not replace actual boundaries.
3. **Adjust the grid.** Auto refine uses image edges and color purity to move boundaries. When no improvement is found, a green check indicates the current optimum, while review markers remain available. Drag lines or endpoint handles to reposition them. Click or box-select consecutive lines in one direction; clicking a distant endpoint includes the lines between, clicking a selected end removes it, and clicking an interior line selects it alone. Merge selected lines at their average coordinate, or add a horizontal or vertical line by clicking the image; Esc cancels insertion. Grid edits preserve the original image, inherit manual cell colors, and support undo. Wide and narrow cells can be processed in bulk or reviewed individually. Rebuilding by row and column counts always displays a warning. Spacing and offset settings are available in the collapsed section below.
4. **Adjust colors.** Cells initially use mode sampling with a color-distance threshold. Select cells and choose mode or mean in the canvas toolbar. Manual picking temporarily shows the original and zooms to one selected cell, keeping each dimension within roughly a quarter of the workspace. Click a color inside that cell to finish and restore the previous view, or press Esc to cancel. Mode and mean apply to the entire selection; manual picking targets its top-left cell. Original/Modified switches the canvas background. Category buttons emphasize mode, mean, manual, or multicolor cells; other cells fade under animated stripes. Preview and export always retain the complete result. The multicolor threshold checks mode-sampled cells; mean and manual cells count as handled. Apply mean to all flagged cells, or mode to all unflagged cells, clearing their manual overrides. Reset color state clears cell methods, manual colors, and local sampling, restores color defaults, and keeps the image and grid; it is undoable. Rectangle sampling and sampling movement controls are no longer available, but older projects retain their stored sampling data.

Steps 2–4 each include **Reset settings**, restoring that step's detection, refinement/display, or color/display defaults while preserving grid boundaries and cell color methods. Resetting color settings is separate from resetting the entire color state.

Export a PNG at one pixel per cell or an integer enlargement. Save a project to retain the working image, grid, local sampling, manual colors, and sampling methods. Cropping never modifies the original disk file; the project stores the cropped working image.

### Limits and Data

Grid detection relies on visible repeating edges. Uniform images, diagonal detail, or multiple competing grids may require manual adjustment. Local sampling edits affect sampling rather than the source image. Images are limited to 2048 px on their longest side and resized with a notification when necessary. Each direction supports up to 128 cells.

Mean sampling excludes fully transparent pixels from both RGB and alpha averages. Translucent RGB values are alpha-weighted; alpha is averaged over the effective covered area. A cell with no visible pixels stays fully transparent.

Project JSON contains the working image and editing parameters. Undo retains the last 40 operations and is cleared when switching images or opening a project. The header shows the filename, dimensions, and unsaved state; undo and redo are in the canvas toolbar.

### Development and Verification

The app uses plain HTML, CSS, Canvas, and JavaScript with no build step. `core.js` contains grid analysis and color sampling, `app.js` manages editor state and interactions, and `i18n.js` handles interface translations. `vendor/lucide.min.js` is the MIT-licensed Lucide icon library.

Run the algorithm tests:

```sh
node --test tests/core.test.cjs
```

Example thumbnails use files in `pics`. To support canvas access when opened through `file://`, importing examples loads `pics/examples-data.js` on demand. After replacing example images, regenerate this bundle:

```sh
node tools/build-examples.cjs
```

When adding examples, update both the start-screen list and the generation script. `pics/white-outline-reference.png` illustrates the outline tip and is not an importable example.

Future parameter-interface work is recorded in `MEMO.md`. Wide/narrow repairs use the current local spacing reference. Splitting predicts evenly spaced positions and snaps to nearby gradients where available. Merging an interior narrow cell averages its two boundaries; edge cells remove an interior boundary while keeping the image perimeter fixed. After a grid edit, local samples and manual colors are inherited from the old cell containing each new cell's center. These edits support undo.
