# WorkPlace 品牌与图标

产品名已确定为 **WorkPlace**，保留 W、P 大写。定位是长期自用、持续扩展的个人 AI 编程工作台。

用户已选定 **A「工坊榫接」**，保留陶瓷白、暖铜与深石墨的材质关系。图形表达把不同 Agent、模型和工具组合成自己的工作台，不直接使用字母 W。正式设计资源位于 `workplace/`；三套初稿继续保留为探索记录。

- [打开已选定图标的独立预览](workplace/index.html)
- [下载完整图标包](workplace/exports/package/WorkPlace-icons.zip)
- [正式图标与字标展示](workplace/previews/identity.png)
- [打开三套图标对比页](candidates/index.html)：切换深色、浅色与单色，比较实际尺寸，下载对应资源。
- [三套候选对比原图](candidates/previews/overview.png)
- [打开调研展示页](index.html)
- [完整调研、来源与设计任务书](research/2026-10-09.md)
- [参考对照图](research/previews/reference-board.png)
- [官方图片来源](research/references/sources.json)

## 正式资源

- `workplace/icon.svg`、`icon-light.svg`：选定的大尺寸造型，保留原 A 图稿。
- `icon-small.svg`、`icon-light-small.svg`：16、20、24px 的专用版本，主体放大约 14%–16%，接缝由 14 单位加宽到 18，侧面与阴影简化。
- `symbol.svg`、`symbol-light.svg` 及对应 small 版本：深浅单色符号，小尺寸适当增加纵向高度并加宽接缝。
- `exports/dark/`、`exports/light/`：16、20、24、32、48、64、128、256、512、1024px PNG。
- `exports/mono-dark/`、`exports/mono-light/`：16、20、24、32、48、64、256px 透明 PNG。
- `exports/windows/`：深浅各一份 ICO，均含七个尺寸；16、24px 嵌入对应光学调整版，已逐像素核对 ICO 中的图像与独立 PNG 相同。
- `foreground.svg`、`background.svg`：独立前景和未裁圆角背景，供后续平台适配。

[小尺寸调整对比](workplace/previews/small-sizes.png)同时展示最近邻放大图与实际尺寸。主预览的 SVG、PNG 下载跟随外观切换；桌面 ICO 快捷链接为深色，完整包包含两版。

本机用以下命令重建。脚本复用已选定 A 的几何定义，旧输出先移到项目 backups/，不会覆盖候选留档：

```powershell
python -B scripts/branding/workplace.py
```

正式预览已在 Chromium 与 WebKit 检查 1440、768、390、320px 宽度及三种外观，键盘操作、33 个本地资源引用和历史页入口正常。已核对透明通道、SVG、图标尺寸、ICO 内嵌像素和 48 文件 ZIP 的完整性。

## 应用接入

已应用到本机 Windows 程序：应用图标、托盘图标、窗口标题、网页页签图标、页头和菜单使用 WorkPlace；开始菜单入口为 **WorkPlace**。安装路径仍是 `%LOCALAPPDATA%\Programs\magpie\magpie.exe`，原有模型、命令、配置目录和协议继续使用。

正式资源生成后执行以下命令，将资源接入 GUI 并生成 Windows 图标资源。重新生成 `.syso` 前先把原文件移到项目 `backups/`；图标接入脚本会自动保留它替换的旧素材。

```powershell
python -B scripts/branding/apply_icons.py
go run github.com/tc-hib/go-winres@v0.3.3 make --in build/windows/winres.json --arch amd64 --out rsrc --file-version 0.0.0 --product-version 0.0.0
```

随后按项目 Windows 构建方式编译，版本保留 `-workplace-dirty` 源码标记。不要运行旧的 `make icons`，它生成的是原鸟形图标。接入边界与自动更新行为见 [GUI app shell](../../subsystems/gui-shell.md#display-name-and-icons)。本机旧程序和安装记录保存在 `backups/workplace-install-20261009-014105/`。

## 三套候选留档

| 方向 | 图形与项目关系 | 本轮观察 |
| --- | --- | --- |
| [A · 工坊榫接](candidates/previews/joinery.png) | 陶瓷白与暖铜构件通过折线切口接合，对应自己组合 Agent、模型和工具的工作台。 | 已选定。正式资源已单独整理，并完成小尺寸调整。 |
| [B · 汇聚的泊位](candidates/previews/harbor.png) | 开放的冰蓝圆弧承托一枚银白核心，对应能力汇聚与统一入口。 | 缩小后圆弧醒目，但与通用用户符号接近；已扩大核心与圆弧的间隙。 |
| [C · 点亮的工位](candidates/previews/beacon.png) | 暖金色拱形空间内点亮一处工作面，对应个人、专注的创作空间。 | 已把矩形顶部改成拱形，扩大工作面；仍要留意与灯具、家居图标的联想。 |

图形为自行编写的 SVG 几何，使用同一组轮廓生成材质和单色版本；没有把官方参考图当作候选素材。对比页可展开与 Cursor、Linear、Raycast、Obsidian 的并排观察。这是设计观察，不是用户识别实验或商标检索。

## 候选留档资源

每个候选目录（`candidates/joinery/`、`candidates/harbor/`、`candidates/beacon/`）包含：

- `icon.svg`、`icon-light.svg`：深浅底座的可编辑桌面图标。
- `symbol.svg`：去除材质的单色图形。
- `foreground.svg`、`background.svg`：独立前景及未裁圆角的背景，保留后续平台适配空间；不是已完成的 Apple Icon Composer 包。
- `exports/icons/`、`exports/light/`：各含 16、24、32、48、64、128、256、512、1024px PNG。
- `exports/icons/app.ico`：深色底座，含 16、24、32、48、64、128、256px 七个入口。
- `exports/mono/`：384px 单色原图，以及 16、20、24、32、48px 深色与浅色透明 PNG。

对比页的 SVG、PNG 下载跟随当前外观切换，ICO 下载始终是深色底座版。小图按其 CSS 尺寸显示，浏览器应使用 100% 缩放。细节板另附最近邻放大的 16px 图，便于看清真实像素损失。

正式交付以 `workplace/` 为准；本节目录保留初稿，便于对照。

## 已保留的探索

这些目录均在项目根的 backups/ 下，未删除任何旧文件：

- branding-20261009-000545/：原 Kernyard、Quivra、Yardlane 三套提案，包含原导出脚本副本。
- workplace-20261009-001335/：直接使用字母 W 的探索稿及 PNG，用户已明确排除这个方向。
- branding-workplace-draft-20261009-002237/：开放面板探索稿、尚未完成导出的预览页与原导出脚本。收到“先调研”的要求后收起，没有将它当作定稿。

上述目录记录的是设计探索；当前本机安装状态见上面的“应用接入”。

## 生成参考图

本机已有 Pillow。运行：

```powershell
python scripts/branding/research_board.py
```

脚本只读取本目录已下载的官方参考图片，生成调研对照图。重新生成前会把旧输出移到项目 backups/，不会删除文件。参考图上的产品标志只用于分析，不是 WorkPlace 的候选图标。

## 生成候选资源

本机使用 Python、Pillow、Playwright 与已安装的 Chromium，排版使用 Windows 的微软雅黑和 Segoe UI 字体。

```powershell
python -B scripts/branding/candidates/render.py
```

`scripts/branding/candidates/artwork.py` 定义几何、材质和导出目录；`render.py` 渲染 PNG/ICO 及四张对比板。重新生成时，旧输出会保留原相对路径移入项目 `backups/workplace-candidates-时间戳/`。只需调图形时修改生成源，不要只改会被重新生成的 SVG。对比网页独立于导出脚本，可直接用浏览器打开。

候选设计阶段已在 Chromium 与 WebKit 检查 1440、768、390、320px 宽度下的三种外观、键盘切换、图片与下载路径；目视检查桌面、手机及官方参考对照。PNG 尺寸、透明通道、SVG 解析及 ICO 七个尺寸入口已核对。16px 的角点可能保留缩采样产生的极低透明度（alpha 2/255）。该阶段尚未修改应用运行代码；后续安装与验证记录见 `docs/state/progress.md`。
