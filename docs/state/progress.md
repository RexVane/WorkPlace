# 进度

> 更早的条目已归档到 [archive/](archive/)，按月份分文件（如 `archive/2026-10.md`）。

## 2026-10-08 23:19 +08:00 | claude-opus-5-5 | 插件短名在 Windows 上找不到本地文件夹插件；重编正式版装回 3425
- 改了什么：
  - 全仓 Windows 失败里唯一的真 bug：从本地文件夹添加的插件，spec 是 Windows 路径 `C:\...\middleware-zz-tags`，`ShortName` 只按 `/` 切，`magpie plugin off zz-tags`（以及 on/rm/options、`SetOptions`）报 no plugin。`IsPath`（`store.go:269`）本就在所有系统上认 `C:\` 路径，改成两种分隔符都切；npm 包名不会含 `\`
  ```go
  // internal/plugin/store.go:493
  if i := strings.LastIndexAny(pkg, `/\`); i >= 0 {
  ```
  - `TestSetOptionsShortName` 加 Windows 路径用例（纯字符串，Linux/macOS 的 CI 也会跑）：改前失败，改后通过
  - 19 个 Windows 失败的其余分类（逐个读过测试）：15 个是测试按 Unix 写（chmod/0600 权限、只改 HOME 不改 APPDATA、Windows 路径原样写进 TOML、假设第 2 个 Desktop 目录是 Claude-3p、CRLF、用 sh 脚本冒充 exe；Codex 旧副本提醒在 Windows 上是代码里故意关掉的）；3 个是测试结束时子进程没退，临时目录删不掉，其中 `TestGatewayFixQuitsOnlyAMagpie` 的接管结果是 stuck，**是测试问题还是 Windows 上结束旧 magpie 的逻辑有问题，未查清**
- 验证：`go test ./internal/plugin/` 整包全过（bun 升级后原来的 3 个也过了）；根包只剩 `TestPluginListSaysMiddleware`（断言全过，仅清理失败）；`TestPluginOnOffRmShortName` 通过
- 正式版：`CGO_ENABLED=0 go build -tags production -trimpath -ldflags="-s -w -X main.version=bcee08d-dirty -H windowsgui"`，旧 exe 移到 `backups/magpie.exe-20261008-2317`，新 exe 装到 `%LOCALAPPDATA%\Programs\magpie\magpie.exe` 以 `tray` 启动（PID 28436），3425 监听。四档各发一条 16 token 的请求：`claude/claude-opus-5-5`、`group/auto-gpt-6-astra`、`group/auto-grok-4-7`、`deepseek/deepseek-flash` 都回 ok
- 影响文件：`internal/plugin/store.go`, `internal/plugin/store_shortname_test.go`
- 下一步：接管旧 magpie 在 Windows 上是否可靠待查；对照用的工作树 `/tmp/magpie-base` 待用户清理；所有代码改动都还没提交

## 2026-10-08 23:34 +08:00 | gpt-6 | AI 编程工作台英文命名与图标提案
- 改了什么：
  - 用户将目标明确为长期使用、持续自行开发的个人 AI 编程工作台，并要求英文品牌名；据此设计 Kernyard、Quivra、Yardlane 三套候选，推荐 Kernyard（kernel + yard 的创作工坊意象）。
  - 新增独立品牌预览页，可切换三套方案与深浅主题，展示图形、字标、配色、应用标题栏概念、桌面和托盘效果；页面明确工作台场景为视觉概念。
  - 手工绘制可编辑 SVG，导出每套 7 个 PNG 尺寸、包含 7 个尺寸的 Windows ICO，以及 5 个尺寸的黑白透明托盘图标；导出脚本覆盖旧产物前会移入项目 backups/。
  - 设计说明记录命名初筛、源文件使用方法及后续品牌集成涉及的更新源、配置兼容等边界；原程序品牌与运行配置尚未替换。调整前的中文概念保存在 backups/branding-20261008-232456/。
- 验证：Chromium 与 WebKit 各 15 项检查通过（品牌和主题切换、1440/390/320px 宽度、键盘选择、图片和下载路径）；查看桌面和手机截图；JavaScript 语法检查通过。此轮未修改应用运行代码，未跑 Go 测试。
- 影响文件：`docs/assets/branding/`（预览、SVG、导出图标、截图与说明），`scripts/branding/render.py`
- 下一步：用户选择品牌方案后，再处理正式程序、仓库身份、发布更新源与原配置的兼容迁移。

## 2026-10-09 00:27 +08:00 | gpt-6-astra | WorkPlace 图标调研与设计方向
- 改了什么：
  - 接续最近品牌对话，确认用户选名 WorkPlace、定位长期个人 AI 编程工作台；本轮用户进一步要求不直接用 W，并明确先调研，再结合项目设计图标。配色与图形均未定稿。
  - 先核对 README、子系统文档和实际图标调用，再读取 Cursor、Linear、Raycast、Obsidian 官方品牌资料，以及 Windows、Apple 图标规范；区分官网事实、视觉观察和设计建议。
  - 生成图文调研、四款官方参考图的对照板、图片来源清单及本地展示页；建议优先探索“工坊榫接”，另列“汇聚的泊位”“点亮的工位”，写明小尺寸、单色、跨平台和相似性评判方式。
  - 原三套品牌方案整体保留在 backups/branding-20261009-000545/；直接 W 稿在 backups/workplace-20261009-001335/；开放面板探索、未完成的品牌预览和旧导出脚本在 backups/branding-workplace-draft-20261009-002237/。当前展示页呈现调研，不将探索稿当成定稿。
- 验证：14 个文档本地引用及 4 个展示页本地引用有效；已生成并目视检查参考对照图；渲染脚本语法有效。未改应用运行代码，未跑 Go 测试；新图标尚待设计，没有声称完成小尺寸验证。
- 影响文件：`docs/assets/branding/README.md`、`docs/assets/branding/index.html`、`docs/assets/branding/research/`、`scripts/branding/research_board.py`；旧 `scripts/branding/render.py` 已随探索稿移入 backups/。
- 下一步：先展示三种 WorkPlace 候选图标的主体、单色与 16–48px 效果，再完善图标资产和品牌页面；保留名称 WorkPlace，避免直接字母 W。

## 2026-10-09 00:53 +08:00 | gpt-6-astra | WorkPlace 三套原创图标候选与尺寸对比
- 改了什么：
  - 用户认可调研后，绘制工坊榫接、汇聚的泊位、点亮的工位三套原创 SVG；以工具拼接、统一入口和个人创作空间对应项目能力，不直接使用字母 W，尚未选定最终图形和配色。
  - 生成同尺寸对比板、三张深浅色细节板、16–48px 彩色与单色图；目视后扩大泊位核心间隙，将工位顶部改成拱形并扩大内部工作面。优先推荐榫接，同时记录其 16px 接缝细节损失及另两套的通用符号联想。
  - 新增独立图标对比页，可切换深色、浅色、单色；SVG 和 PNG 下载跟随外观，ICO 为深色版。另可展开与四款常见工具的对照，Cursor 官方参考只裁去外围展示留白。
  - 每套导出深浅各九个 PNG 尺寸、七尺寸 ICO、深浅透明单色 PNG，并保留分离前景与未裁圆角背景。新增可复现脚本、更新调研入口和资源说明；旧输出进入 backups/，Python 缓存加入 .gitignore。
- 验证：Chromium、WebKit 各通过四种宽度 × 三种外观的 12 组检查、75 个本地引用、键盘切换与参考图展开；查看桌面、手机和对照截图；SVG 解析、PNG 尺寸及透明通道、ICO 七个入口已核对，JavaScript 语法和 git diff --check 通过。未改应用运行代码，未跑 Go 测试。
- 影响文件：`docs/assets/branding/candidates/`、`docs/assets/branding/index.html`、`docs/assets/branding/README.md`、`scripts/branding/candidates/`、`.gitignore`。
- 下一步：用户选择图形方向后，细化轮廓、光学尺寸与配色；本轮候选尚未安装为应用图标。

## 2026-10-09 01:03 +08:00 | gpt-6-astra | 确定 WorkPlace 工坊榫接图标并完成正式资源
- 改了什么：
  - 用户明确选择 A「工坊榫接」。建立独立 workplace/ 正式资源目录，大尺寸保留选定造型及陶瓷白、暖铜、深石墨配色，三套候选继续留档。
  - 针对 16、20、24px 放大主体、将接缝从 14 单位加宽至 18，减薄侧面与阴影；单色小图增加纵向高度。生成实际尺寸与最近邻放大的前后对照，目视确认接缝更清楚。
  - 导出深浅各十个 PNG 尺寸、深浅单色各七个尺寸、两份七尺寸 ICO，以及独立前景和背景；ICO 嵌入专用小尺寸版，打包为含 48 个文件的 ZIP。新增可复现导出脚本，重生成前将旧输出移入 backups/。
  - 新增已选定图标的独立预览和下载入口，更新调研页、候选页及 README 的选择状态；页面支持深浅与单色切换，手机上的小尺寸图按三列对齐。
- 验证：Chromium、WebKit 各通过四种宽度 × 三种外观的 12 组检查，33 个本地资源引用、键盘操作和历史页入口正常；查看桌面、手机和像素对比图；SVG、PNG 尺寸及透明通道、ICO 与 PNG 逐像素一致性、ZIP 完整性和 JavaScript 语法检查通过。未改应用运行代码，未跑 Go 测试。
- 影响文件：`docs/assets/branding/workplace/`、`docs/assets/branding/index.html`、`docs/assets/branding/candidates/index.html`、`docs/assets/branding/README.md`、`scripts/branding/workplace.py`。
- 下一步：后续品牌接入以 workplace/ 为正式资源来源；当前完成图标设计交付，尚未替换运行中的应用。

## 2026-10-09 01:46 +08:00 | gpt-6-astra | WorkPlace 图标与名称接入并安装到本机
- 改了什么：
  - 用户要求直接应用，暂停后又明确继续。以已选定 A「工坊榫接」为资源来源，接入 Windows 程序图标、托盘、网页页签和页头；窗口、面板、托盘菜单及开始菜单入口显示 WorkPlace。
  - 加入 `scripts/branding/apply_icons.py`，把正式资源复制到 GUI 和 Windows 构建目录，生成新图形的托盘动画；页头原来依赖鸟翼和尾巴的动画改为轻微浮起，遵守减少动态效果设置。内联装饰图移除重复 title，品牌名称检查不再同时匹配 SVG 标题与字标。
  - Windows 资源补齐 24px 图标，修改 ProductName、FileDescription 和清单描述；保留 magpie.exe、命令、配置目录、网关身份、单实例标识和协议。更新 GUI 子系统文档与品牌接入说明。
  - 使用 production 构建 `dccf8af-workplace-dirty`，沿用项目对源码版不自动安装上游发行版的处理，没有改用户的更新偏好。已替换 `%LOCALAPPDATA%\Programs\magpie\magpie.exe`，创建 WorkPlace 开始菜单入口，并打开新应用。
- 验证：
  - Chromium、WebKit 的品牌名称与悬停、手机和桌面布局、托盘设置及繁中/日文/德文检查通过，包含中英文场景；共 23 项。JavaScript 语法、文档本地链接和 `git diff --check` 通过。
  - Go 托盘尺寸、各语言菜单、切换语言、面板窗口选项及快捷方式测试通过；`go vet ./...` 通过。给忽略的 backups/ 加独立 go.mod，避免全仓工具误编译保留的源码快照。
  - 从新 exe 提取 ICO，16/24/32/48/64/128/256px 七个入口与正式 PNG 逐像素一致。实际运行窗口标题为 WorkPlace，并读取、目视确认其原生窗口图标。
  - 本机新进程 PID 39200，实际路径和安装文件 SHA-256 均符合构建产物；3425 由该进程监听，`/`、`/api/hello` 返回新源码版本，`/v1/models` 可读取原有 115 个模型。没有发送付费模型请求。
  - 本轮未重跑全仓 Go 测试、全部页面测试或 macOS/Linux 打包；范围为本机 Windows 品牌接入，跨平台编译图标与网站未重做。
- 备份：旧程序与安装清单在 `backups/workplace-install-20261009-014105/`；源文件、素材、原 Windows 资源分别在 `workplace-apply-20261009-012052/`、`workplace-runtime-icons-20261009-012254-849210/`、`workplace-build-20261009-013634/`（均位于 backups/）。
- 影响文件：`internal/gui/` 的应用名称、图标、页头、动画与相关测试，`internal/shortcut/shortcut.go`，`build/windows/`，`scripts/branding/apply_icons.py`，`docs/assets/branding/README.md`，`docs/subsystems/gui-shell.md`。
- 下一步：本机接入完成；运行和品牌改动保留在工作区，仅按规则提交本条进度。原有字体相关未提交改动保留。

## 2026-10-09 02:14 +08:00 | gpt-6-astra | 全面整理 WorkPlace 文档构建与工作区
- 改了什么：
  - 整理前保存 253 份工作区文件及补丁到 `backups/project-tidy-20261009-015714/`。中英文 README 增加 WorkPlace 入口，原 Magpie 文档完整保留在折叠参考中；新增 `docs/README.md` 与本地维护指南，串起源码、状态、设计、构建和恢复路径。
  - 将 `docs/screenshots/` 整体迁到 `docs/assets/screenshots/`；确认无进程使用后，将根部两份旧开发 exe、临时浏览器截图及 Python 缓存归档。正式图标、三套候选及研究来源保留；增加忽略的 `backups/README.md` 作为恢复索引。
  - 新增 `scripts/maintenance/archive.py`，先检查全部路径，再保留原名称和相对目录移入 backups；拒绝项目外、项目根、.git 和 backups 自身，重叠模式只搬目录一次，清单与原文件分开存放。Makefile 的 clean 与产物替换改用归档，icons 改用 WorkPlace 素材。
  - 新增 Windows PowerShell 构建入口，支持 amd64/arm64，记录版本与 SHA-256，验证产品信息；只归档目标架构的旧资源，恢复调用方环境。图标重复接入时，相同托盘帧不再生成冗余备份。
  - 补全 Git 对工具目录与构建缓存的忽略规则，Docker 上下文排除 backups、文档、脚本、工具目录及本地 exe/syso，避免打包整个本机备份。
  - 原有配色与字体调整保留为 `1865e0e`，WorkPlace 图标、名称及设计资源保留为 `85fb534`，维护整理保留为 `89c5a81`；通过暂存区分离混在 app.css 中的改动，没有回退工作区文件或推送远端。
- 验证：
  - 字体、主题、重置、持久化、菜单键盘操作与窄窗口检查 27 项通过，补跑 WebKit 的 Windows 字体检查 3 项通过；归档的路径保护、目录重叠、重名保留、清单隔离和空匹配 5 项测试通过。
  - PowerShell 实际构建 Windows amd64 与 arm64 均通过，两个架构的资源同时保留；Linux amd64 nogui 构建、`go vet ./...` 通过。arm64 未在实机运行；本机没有 GNU Make，未直接执行 Makefile；未构建 Docker 镜像或重跑全部 Go/459 个 GUI 文件的套件。
  - 重新应用正式图标前后，238 个运行资源 SHA-256 完全一致；217 处文档与预览引用有效，Python/PowerShell 语法、README 折叠结构及 diff 检查通过。
  - 整理后源码工作区干净；现有 WorkPlace 继续在 3425 运行，仍为已安装的 `dccf8af-workplace-dirty`，本次没有替换已安装程序或改用户配置。
- 影响文件：README 中英文、Makefile、`.gitignore`、`.dockerignore`、文档索引与维护指南、品牌及 GUI 文档、图标接入脚本、Windows 构建脚本、归档脚本及其测试、文档截图路径；并提交此前完整的样式与品牌工作。
- 下一步：本轮整理完成；后续开发从 `docs/README.md` 进入，旧 Windows 测试兼容性事项仍按历史进度另行跟进。

## 2026-10-09 16:35 +08:00 | gpt-6 | 接入路由与用量动效并隔离刷新状态
- 改了什么：
  - 用户授权替换路由交付后又要求一起处理 usage 用量页。路由接入光点轨迹、网关核心、请求计时与提示；补齐三条新文案的简中、繁中、日文和德文。
  - 交付版路由直接调用 loadQuotas，会替换用量页缓存并重画用量/托盘卡片。改为复用较新的有效缓存，并将独立余额请求保存到路由自己的快照；失败保留上次读数，订阅账号行不触发余额请求。账号指标遵循指标菜单，补齐减少动态效果的选择器优先级。
  ```js
  // internal/gui/assets/routing.js:426
  if (!balFlight && at - Math.max(balAt, balAsked) > 60e3) {
    balAsked = at;
    balFlight = api('usage/quotas').then((qs) => {
      if (!Array.isArray(qs)) return;
      balances = qs;
      balAt = Date.now();
      if (shown()) render();
    }).catch(() => {}).finally(() => { balFlight = null; });
  }
  ```
  - 用量动效置于 assets/usage/，接入数字、占比条、增量与分色柱图。修复模型占比错误读取 tokens 字段导致全为 0%、图表请求期间切周期/刷新遗漏最新读取，以及开启减少动态效果后旧数字仍继续滚动。图表明确标注包含缓存读写，概览卡片沿用原口径。
  - 用量图表独立快照，不写 usage、quotas、ledger；卡片动画以供应商/账号身份匹配，托盘不接入这些包装。资源版本哈希和兼容扫描支持子目录，Makefile 纳入按域放置的新测试。
- 验证：路由首轮 41 项中 38 项通过；余额隔离、核心与计时、宽窄布局在两引擎通过。随后指标菜单已通过两引擎；用量图例、刷新竞态与实时减少动态效果先在交付版失败，修改后行为断言通过，测试夹具补齐空 groups。新资源版本测试先失败、修正后通过；全量回归与截图仍待完成。
- 备份：原路由文件在 backups/routing-motion-20261009-154316/；用量接入前文件在 backups/usage-motion-20261009-161243/。两份交付目录仍保留，验收后整体归档。
- 影响文件：internal/gui/assets/routing.js、routing.css、i18n.js、index.html、usage/；internal/gui/api.go、assets_test.go；相关 GUI 测试、Makefile、GUI 子系统文档和测试说明。原 docs/workplace/maintenance.md 改动保留。
- 下一步：完成整套 GUI 回归、截图和构建，再备份并替换本机程序；所有改动保持本地。

## 2026-10-09 17:36 +08:00 | gpt-6 | 完成路由与用量页面整合及本地构建
- 改了什么：
  - 路由和用量交付均已接入指定项目；路由余额读取不再改写 quotas 或触发用量卡片刷新，用量分模型图表独立保存快照，保留原始统计口径与失败时的输入/输出图表。
  - 截图发现交付版 busy 与全局加载状态重名，舞台及节点叠加变淡并失去交互；改用 rt-busy，仅隔离路由活动状态，真实保存按钮仍按原加载规则工作。可读/可操作断言在修复前失败、修复后通过。
  - 路由恢复检查改为观察绘制帧，避免把 WebKit 遮挡期间排队 DOM 算作已显示光点；补齐真实形状的测试夹具。数字单位检查改用新图表坐标轴，并保留概览、请求、会话和托盘断言。
- 验证：用量专项 14、路由专项 8、窗口恢复 12、Chromium 隐藏帧补跑 9、WebKit 用量刷新补跑 6、数字单位 6、旧 WebKit 兼容 6 项通过；中文路由及用量深浅/窄屏截图已目视。Go 资源测试、go vet、Linux nogui 和 Windows amd64 production 构建通过。
- 验证限制：整套 GUI/Go 检查实际运行后发现其他失败，未跑完，在专项和构建完成后已停止；不能声称全仓通过。已单独提交本地跟踪记录 [验证详情与待查项](issues/2026-10-09-gui-verification.md)，区分已定位问题与尚未归因的失败。
- 构建：dist/workplace-windows-amd64/magpie.exe，51aa3bb-workplace-dirty；SHA-256 为 D937CE0BA5669DB16FE53409C9BC358BC0166EDED37C8A1167AB3FC171FB4EE8。保留现有 WorkPlace 品牌；没有替换正在运行的实例或改动 Orca 工作区。
- 备份：两份交付目录整体移入 backups/archive-20261009-172427-824256/files/，没有删除；旧构建在 backups/archive-20261009-172300-013418/，此前源码备份保留。原 docs/workplace/maintenance.md 改动未改。
- 影响文件：internal/gui/assets/routing.js、routing.css、i18n.js、index.html、usage/；internal/gui/api.go、assets_test.go；相关 GUI 测试、Makefile、GUI 子系统说明和测试说明。
- 下一步：本次源码整合和本地构建完成；需要发布或整仓验收时，先处理跟踪记录中的未解决事项。源码改动保留在工作区，仅提交本轮状态记录。

## 2026-10-09 18:29 +08:00 | gpt-6 | 用新页面构建重启 WorkPlace
- 改了什么：
  - 用户要求用新页面重启；通过应用自身的退出接口关闭旧开发窗口及后台，直接从 D:/AIApp/magpie/dist/workplace-windows-amd64/magpie.exe 启动 app routing。
  - 写入正式安装目录并重启的组合操作被自动审批拒绝（仅返回 blocked by policy）；改用项目内已验证产物完成启动，没有替换正式安装文件或改动 Orca 工作区代码。
  - 首次新实例随后退出，另一个开发启动任务又启动旧版；重新启动新程序并记录 stdout/stderr，再正常退出重复开发实例。没有将未查明的首次退出原因归为崩溃。
- 验证：新 PID 54100 的执行路径、构建 SHA-256 与已验证产物一致；窗口标题 WorkPlace、响应正常；3425 的 /api/hello 返回 51aa3bb-workplace-dirty；收尾时旧开发窗口和后台均为 0。已通过 app routing 请求打开路由页；两页资源嵌入当前构建。
- 限制：computer-use 的 orca 命令不在当前 PATH，未进行本轮原生窗口截图检查；以进程、窗口状态、网关版本及此前页面回归结果验证。
- 影响文件：仅本条进度；启动日志在 dist/restart-20261009-182434/，现有源码改动保留。
- 下一步：新实例保持运行，直接使用新路由页和用量页。

## 2026-10-09 19:45 +08:00 | k3-256k | 清理旧 exe 与自检残留，约定开发期一律源码启动
- 改了什么：
  - 用户明确要求真删不必要文件和 exe（此前两个 exe 的无归档消失也已由用户确认是本人授意删除，不再追查）。删除 12 个文件共 514.8 MB：backups 三个归档快照内的旧 magpie.exe、`backups/magpie.exe-20261008-*`、`magpie-windows-amd64.exe(.new)`、`workplace-install-20261009-014105/magpie.exe`、归档内的 `magpie-dev*.exe` ×2、`dist/workplace-windows-arm64/magpie.exe`、`backups/hello.txt`；另删 archive.py 自检残留目录 `backups/verification/`（12 个几字节假 app.exe）和空目录 `dist/workplace-windows-amd64/`。
  - 明确保留：`backups/go.mod`（让 Go 跳过备份源码，维护文档要求）、`.reg`/`.lnk` 安装记录、两个 `rsrc_*.syso`（下次构建要用）、各 `build.json`（版本与哈希记录）、dist 内 KB 级日志和审阅截图。
  - `docs/workplace/maintenance.md` 新增「开发阶段约定（2026-10-09 起）」：预览验证一律源码启动 `scripts/dev/windows.ps1`（go run -tags dev，预览 3437/网关 3436）；敲定后才构建 exe；旧 exe 一律删除不留档（任何版本可按 build.json 从 Git 重建）；dist 不堆积临时产物。
  - 项目根目录的"乱"是 Go 主包约定布局（main.go + CLI 子命令 + 测试平铺），属框架规定位置，未挪动；真正散乱的是 backups 散装产物，已按上条清理。
- 验证：删除前盘点全项目 exe 清单并确认无进程占用（3425 无监听、无 magpie 进程）；未触碰任何源码、未提交改动与 .git；删除后 backups 保留归档源码与文档快照完整。
- 影响文件：`docs/workplace/maintenance.md`（修改）；其余为上述删除项，无源码改动。
- 下一步：用户继续以源码开发页面；敲定后用 `scripts/build/windows.ps1` 重建 exe。

## 2026-10-09 20:59 +08:00 | deepseek-flash | 装入用量页标签动效（上下文/会话/切页），源码重启并实测四标签
- 改了什么：
  - 用户新交付 `D:\chrome download projects\路由页面动效改进 (2)\deliver\bundle\`：只有 `usage/usage-fx.js`（23566 B）与 `usage/usage-fx.css`（3203 B）两个文件加一份安装说明，说明称基于本地现版修改、`app.js`/`context.js`/`context.css`/`index.html` 都不用动。用户明确「会话只修改动效，保留项目原来即可」，即会话页结构不动。
  - 先与项目现版逐行对比确认纯增强（js 122 增 17 删、css 10 增 1 删），并验证：新代码引用的辅助函数（`active/still/visible/text/width/seen`）都是本地已有版本里的；`renderSessions`（app.js:16416）与 `renderSessTop`（app.js:16911）是经典脚本顶层函数声明、即全局可改写，而 `usage/usage-fx.js` 在 index.html:531 最后加载，包裹时机成立；新版选择的 DOM（`#sessStats/.sess-chart-head/#sessProjects/#sessModels/#sessTop/#sessList/#sessHours/.sess-hours` 与 `.ctx-*`）全部在 app.js/context.js 中真实存在。
  - 装前把现版移入 `backups/usage-fx-tabs-20261009-205110/`，再复制新文件入 `internal/gui/assets/usage/`；`node --check` 通过。
  - 新版新增：`contextMotion()`（圆环弧线、数值滚动、条宽/占比、窗口格闪烁、新 agent 与会话淡入）与 `sessionsMotion()`（六个统计数字、时间线峰值、项目/模型条与数值、列表数值与新会话闪烁、时段热力跳一下）都挂到 `window.UsageFx`；CSS 增加 `.usage-pane:not([hidden])` 切页淡入（`uxpane`）与时间线柱从轴长出（`uxbar`），并在 `prefers-reduced-motion` 下全部关闭。
  - 按用户要求重启：停掉后台任务 pwsh-33（旧 dev 实例，退出干净、3436/3437 释放），用 `scripts/dev/windows.ps1` 重新源码启动（任务 pwsh-46）。
- 验证：服务端返回的 `usage-fx.js` 为 23566 字节且含两个新函数；因 `%LOCALAPPDATA%\ms-playwright` 已被清空、项目无 node_modules，改用 `D:\AIApp\magpie-verify\ui-deps`（playwright 1.62.1）+ 系统 Edge 内核，对预览 3437 做真实浏览器实测并逐页截图（`dist/verify-tabs-20261009/`）：包裹确实生效（`String(renderSessions)` 含 `sessionsMotion`）、四个面板都拿到 `uxpane` 动画、无页面报错（仅浏览器预览下 `/wails/runtime.js` 404，属预览模式固有）。概览（30 天）显示设计稿的按模型堆叠柱状图与模型排行、5 个 KPI 卡，**不是原曲线图**；请求页为设计稿柱图 + 100 行明细；会话页完整渲染（200 行、6 个 KPI、30 柱、168 个时段格）且结构未改；上下文页约 14 秒后渲染 5 个 agent 共 16 张卡片。今日网关调用为 0（`/api/usage?period=today` calls=0，30 天为 509），概览空态是应用自身逻辑而非渲染故障。
- 限制：交付原有的 Playwright 套件（`usage/motion.test.cjs` 等）本轮无法运行（浏览器被清空），因此不代表全仓或该套件通过；动效仅由浏览器实测与截图确认，未做逐帧断言。
- 影响文件：`internal/gui/assets/usage/usage-fx.js`、`usage-fx.css`；备份见上；验证脚本与截图在 `dist/verify-tabs-20261009/`。
- 下一步：用户查看四个标签的实际动效；确认后连同此前未提交的页面改动一起提交，敲定后再构建 exe。

## 2026-10-09 21:38 +08:00 | deepseek-flash | 额度卡去掉走势曲线；全站数字统一 2 位小数
- 改了什么：
  - 用户看过额度卡后说「额度显示难看」「不要用曲线图」，并选择「直接删掉走势块：只留窗口进度条 + 剩余% + 重置时间」，余额类走势一并处理。据此把上游的额度走势功能整块移除（#651/#802 那套）：卡片里的窗口走势与余额走势两块、额度标题栏的走势范围选择器（`#quotaTrend`，"走势: 本周期"）、托盘卡片的细曲线（`quotaSpark`）全部删除。
  - 连带的死代码一并清掉（app.js 共删 289 行）：`quotaCurve`/`balanceCurve`/`quotaSpark`/`drawQuotaPlot`/`quotaReadings`/`curveZoom`/`renderQuotaTrend`/`setQuotaRange`/`quotaLines`/`quotaCycle`/`quotaCycleBreak`/`quotaSpan`/`quotaPaths`/`quotaTimeText`/`quotaHistOf`，以及 `quotaRange` 状态、`QUOTA_RANGES`、storage 监听；`balanceAmount` 保留（另被 `keysSum` 使用）。`loadQuotas()` 顺带不再发 `usage/quotas/history?days=35`（该请求原本只服务这些曲线），额度加载少一次请求。app.css 删除 `.quota-curve`/`.qc-*`/`.pq-spark*`/`.balance-curve` 与走势选择器样式共 33 行；index.html 删除 `#quotaTrend` 按钮。Go 侧 `/api/usage/quotas/history` 端点保留未动（本轮只动界面）。
  - 用户随后要求「数据精确到 0.01、保留 2 位、第三位四舍五入」。新增统一格式化器 `const dp2 = (n) => (+n || 0).toFixed(2)`（app.js，全局可用），并按用户选定的三类逐点替换：金额（`fmtCost`/`ledMoney`/`balanceAmount`/`caller-keys` 的 `usd`）、百分比（额度 `quotaText` 与圆环、缓存命中率、各 hit rate、排行占比、routing 的 `pct`/`sure`、context 的 `pct`、library 的 RTK 节省率）、数量与速度（`fmtN`、`ctxShort`、上下文徽标、`fmtBytes`、context `fmtK`、routing `tokens`、library `tokens`、各处 `tok/s` 与 `ledFormat`/`ledFormatLong` 的速度分支）。`fmtN` 里 1e7/1e5 两个"取整"分支合并进统一缩放，避免同一单位两种精度。
  - 保留整数不变：请求数、会话数、命令数、插件安装数、耗时（ms/s）、进度百分比、图表几何计算（条宽/柱高）——这些不是"精确到 0.01"的对象，且几何改动会破坏布局；如需一并改，另开一轮。
  - 按用户要求重启：旧 dev 实例（任务 pwsh-46）退出干净后，用 `scripts/dev/windows.ps1` 重新源码启动（任务 pwsh-138）。
- 验证：删除后全仓检索这些标识符在 JS/HTML/CSS 中均为 0 命中；`node --check` 五个改动文件全部通过；Playwright + 系统 Edge 对预览 3437 实测：页面与托盘面板（`?mode=panel`）均 0 条曲线、0 报错、`quotas/history` 请求不再发出，7 张额度卡仍带剩余% 与重置于时间，余额卡只剩金额一行，卡片高度由约 342px 降到 230–245px。精度改动后实测：Token 2.94M、缓存命中率 89.16%、输出速度 136.26 token/秒、费用 ≈$70.76+、排行 ≈$46.69 / 87.19% / 4.84%、额度剩余 1.00% / 94.17% / 41.00% / 29.51%、余额 ¥290.78，请求数仍为整数 509；截图在 `dist/verify-tabs-20261009/`（`quota-after.png`、`precision-overview.png`）。
- 限制：测试里写死的旧格式断言（如 `1.54B`、`66.0%`、`≈$0.400`、`95%`，涉及约 12 个 `internal/gui/tests/*.cjs`）**本轮未更新、也未执行**——本机 Playwright 浏览器已被清空，且用户选择先看效果再定，等确认显示口径后统一改。另：`go test -tags nogui ./internal/gui` 本轮失败两处，均与本次改动无关：`TestPurposeAssetMatchesUsage`（purposes.js 与 Go 目录不一致，既有）、网关接管相关测试 10 分钟超时（既有 Windows 问题）。
- 影响文件：`internal/gui/assets/app.js`、`app.css`、`index.html`、`routing.js`、`context.js`、`library.js`、`caller-keys.js`；测试 `internal/gui/tests/quota-read-at.test.cjs`（去掉曲线断言与 `latest` 文案）；`internal/gui/tests/quota-curve.test.cjs`、`balance-curve.test.cjs` 移入 `backups/quota-trend-removal-20261009-211335/removed-tests/`；改动前原件在 `backups/quota-trend-removal-20261009-211335/`。
- 下一步：用户查看 2 位小数与额度卡效果；确认后更新那批浏览器测试断言，并把本轮与之前的页面改动一起提交。

## 2026-10-09 21:54 +08:00 | deepseek-flash | 自定义供应商编辑器重排：字段分组与顺序
- 改了什么：
  - 用户指出供应商页的「自定义供应商」要改，方向选定为「字段与顺序 + 外观与排版」。改前实测该编辑器是 18 项平铺、无任何分组：名称 / Base URL / API 密钥 / 图标 / 请求头 / 代理 / 并发上限 / 排队上限 / 排队等待 / 价格倍率 /[联网搜索]/[脱敏]/ 账户余额 / 上下文窗口 / 最大输出 / 压缩阈值 / 模型 / 更多端点——模型反而排在最后，且与它相关的三项长度设置离得很远。
  - 新增分节标题：`secHead()`（app.js，紧邻 `field()`）与 `.ebody > .e-sec` 样式（app.css）——整行、上方一道 hairline、11px/600/大写/muted，与项目既有 `.label` 的观感一致。
  - 「模型」组上移到密钥之后：模型 → 上下文窗口 → 最大输出 → 压缩阈值；新增供应商（`addFormModels`）与编辑已有供应商（`renderModels(p)`）两条路径都在这一处渲染，原位置改用 `!custom` 守卫，旧的 `else if (custom)` 模型分支删除，避免重复。
  - 「图标」从第 4 项移到表单末尾，单独成「外观」一节；新增「网络与限流」（请求头/代理/并发上限/排队上限/排队等待）与「计费与账户」（价格倍率/账户余额，两个默认隐藏的条件开关夹在中间）两节。
  - i18n 新增 `Network and limits`（网络与限流 / 網路與限流 / ネットワークと制限 / Netzwerk und Grenzen）与 `Billing and account`（计费与账户 / 計費與帳戶 / 課金とアカウント / Abrechnung und Konto）两条 × 四语言。
  - 预设与订阅供应商的编辑器顺序不变：分节标题只在自定义供应商下渲染（`if (custom)`）。
- 验证：`node --check` 通过；`i18n-keys.test.cjs` 通过；用系统 Edge 实测——自定义编辑器新序列为 名称/Base URL/API 密钥 →〔模型〕模型/上下文窗口/最大输出/压缩阈值 →〔网络与限流〕请求头/代理/并发上限/排队上限/排队等待 →〔计费与账户〕价格倍率/[联网搜索]/[脱敏]/账户余额 →〔外观〕图标 → 更多端点；预设 DeepSeek 编辑器字段完整（Agent/ID/账号/密钥/…/模型/上下文窗口/最大输出/压缩阈值/备用/端点）且无自定义分节，两者均零页面报错。截图 `dist/verify-tabs-20261009/custom-editor.png`、`preset-editor.png`。按用户习惯重启（旧实例 pwsh-138 → 新实例 pwsh-163）。
- 限制：本机没有已保存的自定义供应商，编辑已有自定义供应商这一条路径未实测；浏览器测试套件仍无法运行（Playwright 浏览器已清空）。
- 影响文件：`internal/gui/assets/app.js`、`app.css`、`i18n.js`。
- 下一步：用户查看重排后的编辑器；若要继续调整（分节命名、字段位置、说明文案长度），按此结构微调即可。

## 2026-10-09 22:05 +08:00 | deepseek-flash | 金额不再被两位小数抹成 $0.00；查清 DeepSeek 官方用量"为 0"
- 改了什么：
  - 用户问「DeepSeek 官方的消耗为什么是 0」。查证：那些行**不是 0**，`/api/usage/requests?period=today` 里 244 行 deepseek-flash 全部 `priced=true`、`cost` 在 0.000296916~0.0072513 之间（单次调用几分之一美分），会话日志行按模型的官方目录价（models.dev / 厂商标价）计价，`≈` 只表示"按生效价格估算"。显示成 `≈$0.00` 是上一轮「全站 2 位小数」的结果——单价低于 0.01 的金额被四舍五入成 0.00。
  - 按用户新要求「能拿到具体价格就不必只显示两位」调整金额规则：新增 `costText()`（app.js，紧随 `dp2`）——≥0.01 用 2 位，0.0001~0.01 用 4 位，更小用 6 位。`fmtCost`（行费用与 KPI 合计）与 `ledMoney`（图表轴标签）改用它；余额 `balanceAmount` 与 WorkBuddy 积分 `num` 用同样的位数选择（≥0.01 两位，否则四位/六位）。百分比、token 量、速度仍统一 2 位（`dp2` 未动）。
  - 重启：旧实例 pwsh-163 → 新实例 pwsh-189。
- 验证：浏览器实测请求页 86 行费用**全部显示 4 位小数、没有一行是 $0.00**（≈$0.0011、≈$0.0012、≈$0.0018…），零页面报错；`node --check` 通过。截图与数据：`dist/verify-tabs-20261009/costs-after.png`、`costs-after.json`。
- 影响文件：`internal/gui/assets/app.js`。
- 下一步：用户复核请求页与额度卡的金额显示；其余数字仍为 2 位。

## 2026-10-09 22:49 +08:00 | deepseek-flash | Claude Code 改回标准网关端口 3425；查清"Opus 官方、其余走路由"的档位机制
- 改了什么：
  - 起因：用户先问「在 Claude Code 里用其他 magpie 的路由组，远端算 Claude Code 还是 Codex」，随后明确目标是「Opus 走 Claude 官方，其他档位走 magpie 路由」。
  - 查证中转场景的 agent 归属：转发给 Remote magpie 时 magpie 用自己的 User-Agent + 对方 key，另带 `X-Magpie-Agent`/`X-Magpie-Via`（remote_magpie.go:15-30）；对端 `who, agent := callerOf(r), agentOf(r)`（gateway.go:1189-1192）——**记录**用 `who`（原 agent，显示为「Claude Code · via 电脑名」），**路由决策**用 `agent`（发送方 → `magpie`）。组规则（rules.go:143-150 的 `RuleRequest.Agent`）、Claude 分档替身（gateway.go:140-152）、Codex memory 替身（codex_memory.go:46）都按 `agent`，所以经中转的 Claude Code 在远端**不**命中 `agents=claude`；测试见 `remote_magpie_agent_test.go`。
  - 查清用户要的分流做法：档位由 `~/.claude/settings.json` 的 `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU,FABLE}_MODEL`（haiku 另兜底 `ANTHROPIC_SMALL_FAST_MODEL`）决定，magpie 侧在 `internal/agent/claude.go:1757-1783` 读取并由 `claudeTierStandIn` 生效（仅当 `ANTHROPIC_BASE_URL` 指向 magpie，且 id 是 `claude-*` 全名；用户自己的组优先于替身）。用户现状为主模型与 Opus/Sonnet 档全是 `claude/claude-opus-5-5[1m]`、Haiku 档 `claude/claude-haiku-4-5`，即全部走 Claude 官方订阅。**本轮未改档位**（用户只让改端口），方案已给出待其决定。
  - 按用户要求把 `env.ANTHROPIC_BASE_URL` 从 `http://127.0.0.1:3436`（开发实例端口）改回 `http://127.0.0.1:3425`（标准网关）。改前备份 `settings.json.bak-20261009-224907`；`settings.local.json` 只含 permissions 不覆盖；文件无 BOM、LF 原样保留；改后 JSON 解析通过。
  - 让改动立刻可用：改用 `scripts/dev/windows.ps1 -GatewayPort 3425` 启动源码实例（预览仍 3437，任务 pwsh-11），原 3436 实例已停。
- 验证：3425 的 `/api/hello` 返回 `{"name":"magpie","version":"dev"}`；用 Claude Code 的 token（`Bearer magpie`）请求 `/v1/models` 认证通过、返回 115 个模型（含 `claude/claude-opus-5-5` 等）；3437 预览正常。
- 影响文件：仓库外 `C:\Users\guica\.claude\settings.json`（连同 `.bak-20261009-224907`）；仓库内无代码改动。
- 下一步：用户决定是否按「Opus 官方、Sonnet/Haiku 走路由组」改档位；若要「官方只服务 Opus」，需建一个排除 `claude/*` 的自定义组（自动组 `group/auto-claude-*` 含官方账号，达不到该目的）。另注意 3425 现由源码实例占用，将来构建 exe 前需先停它或依赖 magpie 自身的接管逻辑。

## 2026-10-11 01:00 +08:00 | deepseek-flash | 把 magpie visible 搬进 Agents 页：模型列表加「范围」整组勾选
- 改了什么：
  - 起因：用户说「一个 Agent 里装了一堆模型」。定下 A 方案：把 CLI 的 `magpie visible` 白名单搬进 GUI，落到已有的 `settings.Visible`（家族 / 供应商 id / 路由组 id），不新造状态。
  - `internal/provider/visible.go`：新增 `SetVisible(agent, names)`（写 `Visible`；空即删、相同即不写，改写后 `catalog.Touched()` 让 agent 自己的模型清单跟着重写）、`ScopeKind`/`ScopeName` 与 `ScopeNames()`（列出全部可选名及各自会显示的条目数；取自 `Served()`，即全目录而非某 agent 的，被范围挡掉的名字仍能勾回来；家族名优先于同名供应商）。
  - `internal/gui/agent_models.go`：`agentModelJSON` 加 `Candidates`（这个模型能被哪些名字显示，即 `Entry.Names()`）；新增 `scopeJSON`/`scopeUsed` 与 `agentScopeAPI`——`GET /api/agent-scope/{id}` 读范围与「已显示 / 全目录 / 范围名数」，`POST` 写范围并回带收窄后的模型列表、计数与范围，前端据此重画。`api.go` 里注册。
  - `internal/gui/assets/app.js`：模型列表工具栏加「范围」按钮，点开在列表的位置显示范围面板（家族 / 供应商 / 路由组三段，逐名勾选，头部 `n / 全部`，说明「后加的名字照样显示，直到你取消勾选」）。勾掉一个名立即保存并按新目录重画列表；被范围排除的模型仍留在列表里但变暗，悬停提示去「范围」勾回来；把最后一个名也勾掉时报「总得能看到点什么」并拒绝；目录提供的名字全勾上时保存为空（不钉死整份名单，页脚文案随之改）。范围在**打开列表时**就读（不是在打开面板时），按钮显示已保留几个名字（`Range: 3` / `Range: all models`）；本机实测中发现并修掉一个 bug：有已保存范围时按钮错显「all models」，因为范围要等点开面板才加载。
  - `internal/gui/assets/app.css`：范围按钮与面板样式（`.am-scope`、`.am-sheet`、`.am-sr`、`.am-mr.out` 等）；范围打开时隐藏搜索与左侧 rail。
  - `internal/gui/assets/i18n.js`：11 条新文案的 zh / zh-TW / ja / de 翻译（按钮文案用不带单位的 `Range: {n}`，避免各语言单复数问题）。**注意**：该文件在 git 里一直是 UTF-16LE + CRLF（全仓仅此一个），本轮编辑后工作区为 UTF-8 + LF，所以这次提交它整文件显示为改动；内容已逐行比对，只有新增 44 行，无任何删改。
  - 文档：`docs/subsystems/gui-shell.md` 加「An agent's range sheet」小节与验证命令；`docs/subsystems/agent-wiring.md` 约束里加「An agent's range」一条（含「不改 agent 自身配置字段、不会把已在用该模型的 agent 挪走」）。
- 验证：
  - `go test -tags nogui ./internal/provider`（228s）与 `./internal/settings` 全通过；新增 `TestScopeNamesOffersEveryName`、`TestSetVisibleNarrows`、`TestAgentScopeAPI` 通过。
  - `go test -tags nogui ./internal/gui`：新增用例通过；另有 4 个与本改动无关的既有失败（`TestGatewayHeldByAContainer`、`TestGatewayFixQuitsOnlyAMagpie`、`TestPurposeAssetMatchesUsage`、`TestUpdateThatWontStart`）——已 `git stash -u` 回基线复跑，确认同样失败。
  - 浏览器（Chromium + WebKit；`NODE_PATH=D:\AIApp\magpie-verify\ui-deps\node_modules`）：新增 `internal/gui/tests/agent-scope.test.cjs`（en + zh）4 个全过；`agent-models.test.cjs`、`agent-models-picker`、`agent-models-redraw`、`agent-model-groups`、`agent-models-all-hidden`、`i18n-keys`、`gui-ja`、`gui-de`、`gui-zh-tw` 的一致性用例全过。
  - 既有失败（非本轮引入）：`gui-zh-tw.test.cjs` 的窗口用例期望 `6.8 萬`、实际 `6.81 萬`（上一轮「全站 2 位小数」的遗留，基线同样失败）；`internal/agent` 的 `TestSuffixModesReachAgentFiles`、`TestCodexStaleOnlyForMagpiesChange`、`TestVSCodium`、`TestZedRelativeConfigDirUsesDefault` 等在本机基线上同样失败（环境相关）。
- 影响文件：`internal/provider/visible.go`、`internal/gui/agent_models.go`、`internal/gui/api.go`、`internal/gui/assets/app.js`、`internal/gui/assets/app.css`、`internal/gui/assets/i18n.js`、`internal/provider/visible_scope_test.go`（新）、`internal/gui/agent_scope_test.go`（新）、`internal/gui/tests/agent-scope.test.cjs`（新）、`docs/subsystems/gui-shell.md`、`docs/subsystems/agent-wiring.md`。
- 后续（同日 01:20，用户实测「哪有范围？」后补的修复）：**没接 magpie 的 Agent 行里根本没有「模型列表」那一行**——`app.js` 里那行原本带 `&& !kind`，而 `connectKind` 对「能接入但还没接入」的 Agent 返回 "ok"，于是 21 个 Agent 全是「未接入」时这行整行不画，范围入口也就无从点。现存 21 个 Agent 全被判定未接入，是因为交接文档里 3425 那次端口改动：`.codex/config.toml` 等仍指向开发实例端口 3436。
  - 改法：去掉 `!kind`，改为「凡是有模型目录的 Agent 都画这一行」（`mode !== "panel" && a.models`）；真正不能接入的（Cursor、Copilot CLI）本来就没有 `a.models`，不受影响。
  - 实测：开发实例（3425/3437）上 15 个「未接入」的 Agent 行现在都显示「全部 93 个模型 ›」；点开进「范围」面板实测到 `范围：全部模型` → `41 / 41`，供应商 9 个 + 路由组 32 个，全部带勾。
- 下一步：用户在开发实例里实际点一遍「范围」；若嫌逐个名字太细，可再加「只看路由组 / 只看供应商」的快捷段；`i18n.js` 要不要补一条 `.gitattributes`（`text eol=lf`）以免以后再出整文件 diff，等用户定。用户另报「窗口最顶上边框变白」，已抓取真实窗口截图（title bar 与页面同为 `#151515`，未见白条），待其指认是 DWM 边框、标题栏还是页面内的哪一处。

## 2026-10-11 02:05 +08:00 | deepseek-flash | 路由组改成开关、默认不启用；一键对所有 Agent 关掉路由组
- 改了什么（用户要求：「接入网关，默认都不启用其他路由组，都是默认使用原本 Agent 的供应商，Agent 可以选择启动可用的路由组」+「用启动的丝滑按钮，不想打勾」）：
  - **路由组改成开关**：`app.js` 的范围面板里，路由组那一行由勾选框改为开关（复用 `library.css` 的 `.lib-switch`，所以动画和全站其它开关一致）；`role="switch"` + `aria-checked`，关闭时行名变灰。家族与供应商仍是勾选——它们关掉的是「模型本身」，路由组关掉的是「一条经 magpie 走的通道」，两者语义不同（已在代码注释与子系统文档写明）。
  - **接入不再挑路由组**：`applied.go` 的 `connect()` 本来就只在「除了路由组没有别的模型」时才回退到组（`pick == "" && group != ""`，即 #939），所以本轮没有改这段逻辑，而是把它固定成契约并补测试：新增 `TestConnectPrefersAProviderOverARoutingGroup`（有供应商模型时必定挑模型；把该供应商的模型全部隐藏后，唯一剩下的组才被选中），既有的 `TestConnectOnARoutingGroupAlone` 继续通过。**注意**：如果某 Agent 的模型列表里只有路由组（例如它的模型被逐条隐藏过），接入仍会落在组上——这是有意的兜底，否则接入会报「magpie 没有可用模型」。
  - **一键关掉所有 Agent 的路由组**：新增 `POST /api/agents/routing-groups-off`（`internal/gui/agent_models.go`）。它取 `provider.ScopeNames()` 里非路由组的名字，把它们写成每个 Agent 的 `settings.Visible`（即范围）——于是那些 Agent 的列表里不再有 `group/…`，而每个供应商自己的模型照旧。**范围里只剩路由组的 Agent 跳过不动**（否则它会被显示为空，下次接入就会报错）；范围里已经没有组的也跳过。Agents 页顶部说明行随之多出一个按钮「一键关掉所有 Agent 的路由组」，只在「还有 Agent 可能被显示路由组」时出现，点完按 claude 的说法给一条状态提示。
  - i18n：4 条新文案的 zh / zh-TW / ja / de。
  - 顺手清掉一处死代码：`app.js` 里范围那一行原先加过的 `who.classList.add("with-models")` 已无必要（真正需要它的是 `connectRow`，仍在），去掉。
- 验证：
  - `go test -tags nogui ./internal/provider`（211s）、`./internal/settings` 全过；`./internal/gui` 全过（除 4 个既有环境失败：`TestGatewayHeldByAContainer`、`TestGatewayFixQuitsOnlyAMagpie`、`TestPurposeAssetMatchesUsage`、`TestUpdateThatWontStart`）。
  - 新增 Go 测试：`TestConnectPrefersAProviderOverARoutingGroup`、`TestRoutingGroupsOffEverywhere`；浏览器新增 `internal/gui/tests/routing-groups-off.test.cjs`（Chromium + WebKit × en/zh，4 跑全过），`agent-scope.test.cjs` 更新为断言开关（`role="switch"`、`.lib-switch.on`、供应商仍有 `.ck`），4 跑全过；`agent-models*`、`i18n-keys`、`gui-ja`、`gui-de` 全过。
  - 真实实例实测（重启到含新接口的构建后，pid 变更；网关 3425 / 预览 3437）：`POST /api/agents/routing-groups-off` → `changed=48`，`settings.visible` 里每个 Agent 只剩 9 个供应商；Codex 的模型列表由 93 个降到 **78 个、其中路由组 0 个**，而范围面板仍列出 **32 个路由组**（可随时打开某一个）。
- 影响文件：`internal/gui/agent_models.go`、`internal/gui/assets/app.js`、`internal/gui/assets/app.css`、`internal/gui/assets/i18n.js`、`internal/agent/connect_group_preferred_test.go`（新）、`internal/gui/routing_groups_off_test.go`（新）、`internal/gui/tests/routing-groups-off.test.cjs`（新）、`internal/gui/tests/agent-scope.test.cjs`、`docs/subsystems/gui-shell.md`、`docs/subsystems/agent-wiring.md`。
- 下一步：用户在窗口里看一眼开关与那个一键按钮是否合意；「系列」段仍是空的（没有任何供应商/路由组打过 `family=` 标签），要不要顺手给订阅类供应商打标签；`.gitattributes` 那件事仍未定。

## 2026-10-11 13:30 +08:00 | deepseek-v4.1-flash | 按用户两层重做：路由组开关独立于模型显隐；原厂淘汰的模型不再显示
- 改了什么（用户原话：「各个供应商管自己家的模型」「没必要弄那么复杂，不就是两个：Agent 选不选该路由；Agent 选择了该路由，但是该路由某些模型显不显示」）：
  - **把上一轮的白名单撤掉**：上一轮「一键关掉路由组」写的是 `settings.Visible`（白名单），副作用是**以后新加的供应商会被永久挡住**，而且面板只留路由组后没地方改回来。已从用户的 `settings.json` 移除该字段（备份 `settings.json.bak-20261011-0300`），回到会话开始时的状态。
  - **路由开关独立成一份状态**：新增 `settings.GroupsOn`（agent id → 允许走的路由组 id）。**默认没有 = 该 Agent 一个路由组都不走**，这正是「路由组默认不启用」。`provider.ListedFor` 据此把没开的路由组从该 Agent 的目录里去掉 → 它的模型选择器、magpie 写进它配置文件的模型清单、网关 `/models` 三处一起收窄；`provider.SetGroupOn` 单独开/关一个，`provider.SetGroupsOff` 全部关掉。**普通供应商的模型完全不受影响**，那是一层独立的逐条勾选（`settings.HiddenModels`）。
  - **范围面板改成「Routing」开关面板**：只列路由组，每个一行开关（复用 `.lib-switch`），打开即写、即时把该组的模型带进列表；按钮显示「路由：N」/「路由：全关」。不再有供应商/系列的勾选——那属于「模型显不显示」，就是列表里逐条的勾。
  - **原厂淘汰的模型不再显示**：`catalog` 开始读 models.dev 的 `status` 字段，新增 `catalog.DeprecatedBy(makers, id)`——**只认「造它的厂商」的话**：某模型的原厂（`provider.makerCatalogs()`，与定价同一套「谁造它」）标了 deprecated，且没有任何原厂仍在售它，才算淘汰。`provider.Retired` → `Provider.Exposed` 不再提供它（所以不进任何 Agent 的列表），但按 id 点名请求仍可解析（已在用该模型的 Agent 不受影响）。实测：用户可见的 92 个模型里去掉 2 个（DeepSeek 自家淘汰的 `deepseek-v4-flash` 与 `-vision-exp`）；只有 nvidia/neuralwatt 标淘汰的 `deepseek-v4-pro` **保留**（这正是用户要的「别人家的就显示」）。
- 验证：
  - `go test -tags nogui ./internal/provider`（251s）、`./internal/catalog`、`./internal/settings` 全过；`./internal/gui` 只剩 4 个既有环境失败（`TestGatewayHeldByAContainer`、`TestGatewayFixQuitsOnlyAMagpie`、`TestPurposeAssetMatchesUsage`、`TestUpdateThatWontStart`）。
  - 新增测试：`TestDeprecatedBy`（catalog）、`TestRetiredModelsAreNotOffered`、`TestAgentScopeAPI`（重写为路由开关）、`TestRoutingGroupsOffEverywhere`（重写）、`groups_on_test.go` 的 `routingGroupsOn` 辅助；受「路由组默认关闭」影响的既有测试（`TestPlainNames`、`TestSuffixMode`、`TestPlainOwnNamesGroups`、`TestHiddenModels`、`TestSetVisibleNarrows`）按其本意显式开组后全过；`TestSettingsSaveKeepsWhatItDoesNotSend` 补上 `GroupsOn`（它守护「设置页不发也要保留」的字段），`api.go` 相应保留该字段。
  - 浏览器：新增 `internal/gui/tests/agent-routing-sheet.test.cjs`（开关、即时生效、两组、关掉即退出列表；Chromium + WebKit × en/zh 全过），`routing-groups-off.test.cjs`、`agent-models*`、`i18n-keys`、`gui-ja`、`gui-de` 全过；i18n 补 6 条 × 4 语。
  - 真实实例（重启后，网关 3425 / 预览 3437）：`/api/agent-scope/codex` → 开着 **0** 个组、可选 **16** 个、列表 75/92；打开 `group/auto-claude-opus-5-5` → 76/92 且该组在列表里；关掉 → 回到 75/92 且退出列表。`settings.json` 里没有 `groupsOn`（全默认关闭）、没有 `visible`（白名单已清）。
- 影响文件：`internal/settings/settings.go`、`internal/catalog/catalog.go`、`internal/provider/visible.go`、`internal/provider/models.go`、`internal/gui/agent_models.go`、`internal/gui/api.go`、`internal/gui/assets/app.js`、`internal/gui/assets/i18n.js`、`internal/catalog/catalog_test.go`、`internal/provider/retired_test.go`(新)、`internal/provider/groups_on_test.go`(新)、`internal/gui/agent_scope_test.go`、`internal/gui/routing_groups_off_test.go`、`internal/gui/settings_keep_test.go`、`internal/gui/tests/agent-routing-sheet.test.cjs`(新)、若干 provider 测试、`docs/subsystems/gui-shell.md`、`docs/subsystems/agent-wiring.md`、`.gitignore`（`backups/*` 与 `!backups/INDEX.md`）、`backups/INDEX.md`(新)。
- 下一步：用户在窗口里试一遍路由开关是否合意；`.gitattributes`（`text eol=lf`，防 i18n.js 整文件 diff）仍未定。
