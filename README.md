# 像素校准室 · Pixel Studio

> 🎮 **告别 AI「伪像素」！专为拼豆与像素画打造：一键校准网格，还原规整、纯净、真正的点阵图。**  
> Turn messy, blurry AI "pseudo-pixel art" from gpt-image & banana into crisp, aligned grids — perfect for Perler/Fuse Beads (拼豆) and pixel art crafting!

🔗 **在线体验 / Live Demo:** [https://symkube.github.io/pixel_grid_studio/](https://symkube.github.io/pixel_grid_studio/)

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen?logo=github)](https://symkube.github.io/pixel_grid_studio/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Zero Install](https://img.shields.io/badge/Zero%20Install-Browser%20Only-blue)](#)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25%20Local-success)](#)

---

[🇨🇳 中文说明](#-中文说明) · [🇬🇧 English Guide](#-english-guide)

---

## 🇨🇳 中文说明

### 🧐 为什么需要「像素校准室」？

用 **gpt-image**、**banana** 等 AI 图像生成模型制作像素风图纸或拼豆（Perler / Fuse Beads）素材时，我们经常会遇到令人头疼的**「假像素（Pseudo-Pixel）」**问题：
- ❌ **格子忽大忽小**：网格错位扭曲，不是严格均等的正方形阵列。
- ❌ **边缘发虚混色**：带有反走样、抗锯齿或模糊噪点，一个格子里挤着多种过渡杂色，根本没法对应实物豆子颜色。
- ❌ **无法直接照着拼**：不能直接数格子、无法匹配品牌色号，手动重新描图又极其耗时费力。

**「像素校准室 (Pixel Studio)」** 专为解决此痛点而生！它能自动推算画面中的潜藏网格，一键吸附对齐色块边缘，并自动剔除杂色过渡，几分钟内即可将 AI 概念图校准为**规整、纯净、每格对应一颗豆子的标准像素画**。

#### ✨ 核心特色
- 🚀 **即开即用**：纯前端静态网页，打开浏览器即可使用，无需安装任何软件或依赖。
- 🔒 **100% 本地隐私安全**：所有图片处理与算法计算全部在浏览器本地完成，图片**绝不上传**到任何服务器。
- 🤖 **智能网格感知**：自动推测横纵像素间距，提供一键「自动迭代校准」，智能吸附边缘与色块中心。
- 🎨 **色彩智能纯化**：内置众数取色与均值取色算法，自动消灭边缘羽化与混色噪点，配合多色格排查与放大取色镜。
- 📐 **多规格灵活导出**：支持导出标准的 1:1 像素点阵图（1格=1像素/1颗豆子），或 8× / 16× / 32× 社交平台无损高清放大图；支持保存 `.pixel.json` 工程随时继续。

---

### 🚀 怎么玩？（4 步极速上手）

```
[1. 选择图片] ──> [2. 自动识别] ──> [3. 手动校准] ──> [4. 纯化颜色 & 导出]
```

#### 第 1 步：选择图片与预处理
- **导入图片**：支持 PNG、JPEG、WebP 格式；也可以直接在首页点击 **5 张内置示例图片**快速体验。
- **透明度处理**：若图片带有透明通道，可自由选择「保留透明」、「铺底色转为不透明」或「仅使可见像素不透明」。
- **智能裁剪**：自动检测主体并剔除周围的多余背景边缘；支持拖拽框选、键盘微调坐标及局部 8 倍放大镜。

#### 第 2 步：自动识别网格
- 点击左侧 **「自动识别网格」**，算法会自动分析画面中的重复边缘，计算最可能的横向与纵向格子间距。
- 点击候选数值或输入框，中央画布会实时显示等距参考线，方便你直观对照原图。

#### 第 3 步：校准与微调网格
- **自动对齐**：点击 **「自动迭代校准」**，算法会自动根据画面边缘和色块纯净度微调网格线位置。
- **直观手动微调**：
  - 直接在画布上拖拽网格线或端点（支持边缘梯度自动吸附）。
  - 点击 **「手动加入网格线」**，轻松补充算法遗漏的线。
  - 支持多选连续网格线进行合并，或点击 **「切分全部过宽」/「合并全部过窄」** 一键修复网格异常。

#### 第 4 步：调整颜色与导出
- **色彩自动纯化**：默认采用「众数取色」，自动取格内最多的主色调，剔除 AI 生成时的边缘模糊杂色。
- **杂色排查与微调**：
  - 勾选 **「标记多色格」**，画面中存在混色争议的格子会立刻突出显示。
  - 点击 **「对当前所有多色格应用均值取色」** 快速柔化过渡，或点击 **「手动取色」** 打开高倍聚焦放大镜从原图中精准吸色。
- **一键导出成果**：
  - **1× 原始像素**：标准的 1 格 = 1 像素 PNG（1 格对应 1 颗拼豆），可直接作为拼豆图纸基准或导入游戏引擎。
  - **8× / 16× / 32× 高清放大**：边缘锐利不发虚，发社交媒体、朋友圈展示绝不模糊。
  - **保存项目**：点击顶部「保存项目」可下载 `.pixel.json` 文件，完整保留原图、网格和手动颜色。

---

### 🧶 拼豆爱好者的绝佳搭档（后续图纸制作推荐）

本项目的一大核心应用场景就是**拼豆（Perler / Fuse Beads）图纸校准**！  
在像素校准室完成校准并导出 **1× 原始像素 PNG** 后，**强烈推荐配合以下神器使用**：

👉 **[拼豆图纸工具 (pindou.ciya.club)](https://pindou.ciya.club/)**
- **主流品牌色卡匹配**：将本工具导出的 1:1 像素图直接导入该网站，可一键将像素自动对齐到各大品牌拼豆色号（漫漫、Artkal、Miyuki、Perler 等）。
- **生成完整施工图纸**：自动统计每种颜色所需的拼豆颗数、生成带色号标号的分块施工图纸和拼盘排版，做手工对色再也不费眼睛！

---

### 💡 获得最佳效果：AI 生图小技巧

要想生成更适合校准为像素画的 AI 图片（如使用 gpt-image 或 banana），推荐在提示词和生成流程中参考以下经验：
1. **双参考图法**：生成时提供一张**画风参考**（明确想要的像素颗粒质感）和一张**内容参考**（主体造型），分工更明确。
2. **加上阶梯状像素白边**：提示词中要求主体外围有一圈「**阶梯状白色像素描边**」并搭配纯色背景，AI 生成的网格会有规律得多。
3. **明确细节优先级**：在指令中加入类似「**强调面部特征，简化身体细节**」，让有限的格子聚焦在主体最具辨识度的地方。
4. **建议尺寸范围**：本项目最适合制作 **60 × 60 格以内** 的角色头像、小道具或拼豆小件。（提示词要求的格数通常只是目标，AI 实际生成的格数往往偏多，例如要求 15×15 实际可能接近 25×25）。

---

### 💻 开发者与部署

本项目为纯原生静态 Web 应用（HTML5 Canvas + JavaScript + CSS），无编译与打包步骤。

- **本地运行**：直接用浏览器打开 `index.html`。
- **运行算法测试**：
  ```sh
  node --test tests/core.test.cjs
  ```
- **更新示例图数据包**（可选）：若替换了 `pics/` 下的示例图，可运行：
  ```sh
  node tools/build-examples.cjs
  ```
- **部署到 GitHub Pages**：
  仓库自带 `.github/workflows/pages.yml`。将代码推送到 GitHub 的 `main` 分支后，进入仓库 **Settings → Pages**，将 **Source** 设为 **GitHub Actions**，即可自动发布上线。

### 📄 开源许可与版权声明 (License & Copyright)

- **软件与代码**：本项目除第三方资源外，其余部分均采用 [MIT 许可证](LICENSE) 开源。
- **图片版权**：项目中的示例图片版权归原作者所有，仅供演示和交流参考。
- **第三方图标**：图标资源来源于 [Lucide Icons](https://lucide.dev/)（遵循 ISC 许可，详见 `vendor/LICENSE-lucide`）。

---

## 🇬🇧 English Guide

### 🧐 Why Pixel Studio?

When generating pixel-style artwork or fuse bead patterns using AI tools like **gpt-image** or **banana**, you almost inevitably face the problem of **"Pseudo-Pixel Art" (Fake Pixels)**:
- ❌ **Uneven & Warped Grids**: Pixel cells are not uniform squares; lines wobble and dimensions vary across the image.
- ❌ **Fuzzy Antialiasing & Noise**: Color bleeding and blurry gradients leave several conflicting shades inside a single cell, making it impossible to match real-world bead colors.
- ❌ **Cannot Be Used for Crafting Directly**: You cannot directly count rows or place beads onto pegboards without tedious manual re-charting.

**Pixel Studio** was created to solve this! It automatically detects the latent repeating grid, aligns cell boundaries to actual color transitions, purifies mixed colors, and exports **crisp, clean, 1-cell-per-bead pixel art** in minutes.

#### ✨ Key Features
- 🚀 **Zero Install & Runs Anywhere**: Pure static web app. Just open it in any modern web browser — no servers, npm packages, or build tools required.
- 🔒 **100% Private & Client-Side**: All image processing and algorithms run locally inside your browser. Your images are **never uploaded** anywhere.
- 🤖 **Smart Grid Detection**: Estimates horizontal and vertical cell intervals automatically, with 1-click iterative refinement to snap lines to color edges.
- 🎨 **Intelligent Color Purification**: Mode (majority) and mean color clustering remove anti-aliasing artifacts; built-in multicolor inspection and focused magnifier eyedropper.
- 📐 **Flexible Export**: Export true 1:1 pixel PNGs (1 cell = 1 pixel / 1 bead) for fuse beads and games, or 8× / 16× / 32× crisp scaled PNGs for social sharing. Project files (`.pixel.json`) let you save and resume anytime.

---

### 🚀 How to Play (4-Step Quick Start)

```
[1. Choose Image] ──> [2. Auto Detect] ──> [3. Refine Grid] ──> [4. Purify & Export]
```

#### Step 1: Choose or Drop an Image
- **Import**: Supports PNG, JPEG, and WebP. You can also click any of the **5 built-in sample images** on the welcome screen to test right away.
- **Transparency Handling**: For images with an alpha channel, choose to keep transparency, flatten onto a background color, or convert visible pixels to opaque.
- **Smart Crop**: Automatically frames the subject and removes uniform borders. Supports freeform dragging, manual coordinate inputs, and an 8× zoom lens.

#### Step 2: Auto-Detect Grid
- Click **"Auto-Detect Grid"** on the left panel. The algorithm analyzes repeating edge profiles to recommend optimal horizontal and vertical cell dimensions.
- Click any candidate spacing to preview real-time reference gridlines over the faded original image.

#### Step 3: Calibrate & Refine Grid Lines
- **Auto Refine**: Click **"Auto Refine Grid"** to let the iterative solver snap gridlines to visual color boundaries and maximize cell purity.
- **Intuitive Manual Adjustments**:
  - Drag lines or endpoints directly on the canvas (supports gradient snapping).
  - Click **"Add Grid Line"** to place any missed horizontal or vertical lines.
  - Select and merge multiple lines, or use **"Split All Wide" / "Merge All Narrow"** for quick batch repairs.

#### Step 4: Cleanup Colors & Export
- **Purify Colors**: Mode sampling is applied by default, choosing the dominant color in each cell and stripping away fuzzy edge transitions.
- **Multicolor Flagging & Eyedropper**:
  - Toggle **"Flag Multicolor Cells"** to instantly spot cells with ambiguous or blended colors.
  - Click **"Apply Mean to All Multicolor Cells"** to blend them, or click **"Manual Pick"** to zoom in and pick exact colors with the eyedropper.
- **Export**:
  - **1× Original Pixels**: Standard 1 cell = 1 pixel PNG (1 cell = 1 fuse bead), ready for bead pattern software, Aseprite, or game engines.
  - **8× / 16× / 32× Scaled PNG**: Crisp, nearest-neighbor upscaled images perfect for sharing without blur.
  - **Save Project**: Export `.pixel.json` to keep your original image, grid lines, and custom colors safely saved.

---

### 🧶 Perfect Companion for Perler / Fuse Beads

One of the most popular use cases for Pixel Studio is preparing **Perler / Fuse Bead (拼豆)** crafting patterns!  
After calibrating your AI image here and exporting the **1× Original Pixel PNG**, we highly recommend importing it into:

👉 **[Bead Pattern Tool (pindou.ciya.club)](https://pindou.ciya.club/)**
- **Color Matching to Real Beads**: Automatically maps pixels to actual color codes from top bead brands (Artkal, Perler, Miyuki, Mard, etc.).
- **Pattern & Bead Count Generation**: Automatically counts required bead quantities, generates numbered grid blueprints, and splits patterns across pegboards for easy assembly!

---

### 💡 Pro Tips for AI Pixel Art Generation

To get AI-generated images (e.g. from gpt-image or banana) that are easiest to calibrate into pixel art:
1. **Use Two Reference Images**: Provide one style reference (showing the desired pixel chunkiness) and one content reference (subject matter).
2. **Ask for a Stepped White Pixel Outline**: Requesting a "stepped white pixel outline" against a background dramatically improves the regularity of AI-generated grids.
3. **Prioritize Crucial Features**: Instruct the model to "emphasize facial features, simplify body and background", keeping limited pixels focused on identity.
4. **Sweet Spot Dimensions**: Best suited for sprites and portraits **under 60 × 60 cells**. (Remember: AI models often produce more cells than requested; e.g. asking for 15×15 often yields ~25×25).

---

### 💻 Development & Deployment

This project is built using vanilla web standards (HTML5 Canvas, CSS, JavaScript) without build steps or external dependencies.

- **Run Locally**: Open `index.html` directly in your browser.
- **Run Algorithm Tests**:
  ```sh
  node --test tests/core.test.cjs
  ```
- **Rebuild Example Bundles** (optional):
  ```sh
  node tools/build-examples.cjs
  ```
- **Deploy to GitHub Pages**:
  The repository includes `.github/workflows/pages.yml`. Simply push to the `main` branch, go to **Settings → Pages**, set **Source** to **GitHub Actions**, and your live site will deploy automatically.

---

### 📄 License & Copyright

- **Software & Code**: Open source and available under the [MIT License](LICENSE).
- **Image Copyright**: Copyright of all sample images belongs to their respective original authors and creators, provided for demonstration purposes only.
- **Third-Party Assets**: Icon assets are provided by [Lucide Icons](https://lucide.dev/) (ISC License, see `vendor/LICENSE-lucide`).
