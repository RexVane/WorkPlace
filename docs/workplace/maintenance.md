# WorkPlace 本地维护

本指南面向这个工作区的 Windows 应用。程序继续安装到 `%LOCALAPPDATA%\Programs\magpie\magpie.exe`，开始菜单显示 WorkPlace。已安装版本和验证结果见[进度](../state/progress.md)，正式资源见[品牌说明](../assets/branding/README.md)。

## 本地开发与上游更新

用户明确约定：WorkPlace 在本地独立开发，继续按需吸收 Magpie 上游更新；改动保存在本地 Git，不向上游推送或发起 PR。原项目文档中的推送、PR 和发布流程不代表用户授权执行这些操作。

当前远端 `origin` 指向 `https://github.com/yetone/magpie`，是上游更新来源；推送地址为 `no_push`，保持禁用。`main` 跟踪 `origin/main`，获取更新与禁止推送可以同时保留。

收到更新请求后，先保存本地工作，再获取并查看上游新增提交：

```powershell
git fetch origin
git log --oneline HEAD..origin/main
```

`fetch` 只更新本地的远端记录，不会合并或覆盖工作文件。阅读差异后，将需要的上游改动合并到本地开发分支，保留 WorkPlace 的品牌与定制功能；解决冲突、完成相应验证，再保存为本地提交并重新构建。只需要个别修复时，可选择对应提交。后续 Agent 遵守同一约定。

## 开发阶段约定（2026-10-09 起）

当前项目处于开发阶段，**日常不构建、不保留 exe**：

- 预览和验证一律用源码启动桌面程序：
  ```powershell
  powershell -NoProfile -File scripts/dev/windows.ps1          # 默认打开用量页
  powershell -NoProfile -File scripts/dev/windows.ps1 -View routing
  ```
  脚本以 `go run -tags dev` 启动，页面文件保存即重载；页面预览在 `http://127.0.0.1:3437`，独立网关端口 3436，不占用正式实例的网关端口（本机为 23425，见「验证与提交」一节）。
- 修改敲定后再运行 `scripts/build/windows.ps1` 构建 exe 并安装（见下节）。
- **旧 exe 一律删除不留档**：任何版本都能按 `build.json` 记录的源码版本从 Git 重建，归档 exe 只浪费磁盘（2026-10-09 已清理约 515 MB）。`scripts/build/windows.ps1` 现在直接删掉上一次的输出与 `rsrc_windows_*.syso`——它此前调用 `scripts/maintenance/archive.py` 归档，与这条规则相反，2026-10-14 改正。上游 Makefile 的各目标仍用 `archive.py`（上游约定，本机不用那些目标）。
- `dist/` 只放当前有效产物；验证日志和审阅截图确认后及时清理，不长期堆积。

## 构建

需要 Go（版本要求见根部 `go.mod`）、Git、Python 3.10+ 和 PowerShell。从项目根目录执行：

```powershell
powershell -NoProfile -File scripts/build/windows.ps1
```

输出为 `dist/workplace-windows-amd64/magpie.exe`，同目录 `build.json` 记录源码版本、时间、架构和 SHA-256。脚本先保存旧产物，再生成 Windows 图标资源，检查编译结果的 WorkPlace 产品信息；任一步失败都会停止。环境变量和当前目录在结束时恢复。

ARM64 输出可加 `-Architecture arm64`。这只构建程序；安装是独立操作。安装前核对路径与运行进程，关闭应用，将旧 exe 保留到项目 `backups/`，再替换并核验网关和窗口。

本地版本采用 `<commit>-workplace`,工作区有未提交改动时再加 `-dirty`(即 `<commit>-workplace-dirty`);两种形态都继续使用项目对源码构建的更新规则,避免自动安装上游发行版覆盖本地修改——`internal/update` 的 `Released` 只认三段点分数字的版本，`-workplace` 让本地构建永远不是发行版。命令、数据目录、登录状态和 `magpie://` 导入协议沿用兼容标识。

## 更新图标

已选定资源在 `docs/assets/branding/workplace/`。只需把现有正式资源重新接入应用并构建时：

```powershell
powershell -NoProfile -File scripts/build/windows.ps1 -RefreshIcons
```

刷新图标需要 Pillow、Python Playwright 和已安装的 Chromium。单独接入可运行 `python -B scripts/branding/apply_icons.py`，或 `make icons PYTHON=python`。相同素材再次应用不会重复归档托盘动画。

修改几何后，先运行 `python -B scripts/branding/workplace.py` 重新生成正式资源，再接入。它依赖保留的 A 候选几何以及本机 Windows 字体；候选目录是图源的一部分。三套候选、研究来源和正式资源的用途分别写在品牌说明中。

`make icons` 现在接入 WorkPlace 的共享界面与 Windows 素材。macOS 的 `.icns`、`Assets.car` 和网站仍需单独适配；原鸟形生成器作为上游源码保存在 `build/icon/gen.go`。

## 清理与恢复

```powershell
python -B scripts/maintenance/archive.py magpie magpie.exe magpie.app dist 'rsrc_windows_*.syso'
```

这也是 `make clean PYTHON=python` 的行为。匹配到的产物移入 `backups/archive-时间戳/files/`，保留相对路径和文件名，目录整体搬入。`manifest.json` 记录已移动的路径；没有匹配项时直接结束。工具会拒绝项目外路径、项目根、`.git` 和 `backups` 自身。它不会清空回收站。

恢复时根据清单把需要的文件移回原相对位置。目标已有文件时，先将其另行归档。`backups/go.mod` 让 Go 的 `./...` 搜索跳过备份中的旧源码，Docker 构建也排除了整个备份目录。

根部 `magpie-dev*.exe` 是旧开发启动器的输出，开发脚本会按需重建；整理时可在确认没有进程使用它们后归档。根部 `.syso` 是 Go 在 Windows 链接资源的约定位置，由构建脚本生成并忽略。

## 行尾约定

根部 `.gitattributes` 声明 `* text=auto eol=lf`：文本文件在索引与工作区都存成 LF，`*.bat`、`*.cmd` 例外（cmd.exe 读不了纯 LF 的批处理）。这样在一台机器上改一行，不会在另一台机器上读成整文件改动——界面源码（`internal/gui/assets/*`）改得最多，也是最早出现这种漂移的（`i18n.js` 曾整文件 diff）。

本机 `core.autocrlf` 为 `true`，若不声明属性，签出会写成 CRLF 并在每次编辑时提示「LF will be replaced by CRLF」；有了这份属性就由它决定，且各平台一致。索引里已经是 LF，所以加这份文件不触发重写；工作区里此前为 CRLF 的文件会在下次签出时变成 LF。

## 验证与提交

代码检查和浏览器回归方式分别见[代码标准](../code-standards.md)与[GUI 测试说明](../../internal/gui/tests/README.md)。字体、主题、布局和品牌改动按各自行为验证并分开提交；仅移动图片或修改文档时，检查本地引用和构建入口即可。

本机程序可通过 `http://127.0.0.1:23425/api/hello` 核对实际运行的版本，`/v1/models` 检查模型目录。检查本身不需要发送模型生成请求。

**本机的网关端口是 23425，不是默认的 3425**（2026-10-14 改，见下）。默认端口在
`internal/settings` 的 `DefaultPort`；本机用 `~/.config/magpie/settings.json` 的 `port` 覆盖。

换端口的原因：Windows 把 3425 划进了为 Hyper-V/WSL（`winnat`）保留的区间 `3390-3489`
（`netsh interface ipv4 show excludedportrange protocol=tcp`），**任何**程序 bind 它都返回
`WSAEACCES 10013`（用 Python 的 `socket.bind` 独立复现过），magpie 因此每 15 秒重试失败一次，
界面却报「端口 3425 被其他程序占用：请退出它」——**这条文案是误导的**，端口上没有进程。
23425 落在动态端口范围 `1024-15000` **之外**，`winnat` 不会预占，可长期使用。

**换端口要同时改已接好的 agent 配置**：magpie 只重写 dsh 的 profile（每次启动都写），
**不会**重指向其它已接好的 agent。本机当时改了 `~/.codex/config.toml`（3 处）与
`~/.claude/mix/settings.json`（1 处）里的 `127.0.0.1:3425`。

### 本机浏览器回归的基线（2026-10-14 实测）

本机没有 Playwright 自带的 Chromium/WebKit，只有系统 Chrome，跑法是把用例里的
`channel: "chromium"` 改成 `"chrome"`、引擎列表收成 `["chromium"]`（`node_modules` 是
`npm install playwright --no-save` 装的，未进 git）。

**去掉 `channel` 的写法要一并改**：`chromium.launch()` 之外还有 `chromium.launch({ ignoreDefaultArgs: … })`
这类带参数的调用（如 `routing-idle-frame.test.cjs` 的 `routingPage` 助手），漏改的会去启动
未安装的自带浏览器并报 “Please run … npx playwright install”。这类漏改会凭空造出一批
假失败——**判断失败前先确认它不是这个原因**。

本机必然失败的 8 个文件、72 项（其余 616 项通过）——**这 72 项已于 2026-10-14 晚逐个查明并修完**，
下面是当时的清单和各自的真实原因，留作以后判断"这算不算我的回归"的参照：

| 文件 | 当时失败 | 真实原因 | 修法 |
| --- | --- | --- | --- |
| `fonts` | 8 | **不是产品问题**：用例用 `[["chromium",chromium],["webkit",webkit]].filter(...)` 这种写法，`BROWSER` 只过滤不替换，本机没装 WebKit 就全失败 | 跑时设 `BROWSER=chromium`；仓库无需改 |
| `routing-key-windows` | 18 | 显示文案的百分比是两位小数（`10.00%`），期望还是一位（`10%`） | 改期望，不动进度条宽度断言 |
| `usage-ledger` | 11 | 三件事：表头 `Requested`→`Model`、`Provider · account`→`Provider`；筛选项移进可折叠的 `<details id="ledTools">`；筛选按钮被视图底部的 `.foot` 裁掉一半，裸 `.click()` 点的是几何中心 | 改表头期望；点前先展开 `#ledTools`；改用本文件自带的 `reader.cjs` 的 `click()`（真滚轮滚进视野再点） |
| `sessions-today` | 8 | `fmtN` 用 `dp2` 出两位小数（`2.20M`），期望一位（`2.2M`） | 改期望 |
| `claude-usage-asked` | 6 | 等 `textContent.includes("25%")`，实际是 `25.00%`（`"25.00%".includes("25%")` 为假） | 改期望为 `25.00%` |
| `quota-reading-again` | 6 | 同上（等 `40%`/`100%`） | 改期望 |
| `segs-press-redraw` | 8 | **用例自己写错**：要求 `done.size >= 49`，而页面只有 46 个控件——在写下该下限的提交 `700315df` 上实测当时也只有 46、也失败 8/8 | 下限降到 40（它只是"扫到了页面"的哨兵，控件本身另有断言） |
| `header-centre` | 7 | **唯一真实缺陷**：inrow 布局下左留白比右多 8px（`.top` 左右 padding 相同，但标签右侧还有行内 `gap: 8px`），超出用例 6.5px 容差 | 改产品代码 `app.css`：inrow 时左 padding 取行内 gap |

其中 `routing-key-windows`、`usage-ledger`、`sessions-today`、`claude-usage-asked`、`quota-reading-again`
五项同出一个提交 `cb4c71a4`（2026-10-10「数字与金额精度统一」）：它改了显示精度与用量账本表头，
同步更新了 12 个测试文件，**漏了这 5 个**，于是这 49 项从那天起一直红着。

判因方法：在修复前的提交 `f28c341f` 上建 `git worktree` 跑同一批文件，**逐项结果完全相同**
（如 `fonts` 8/8、`sessions-today` 0/8 两边一致），所以这 72 项是环境缺口与过时期望、不是那时改动的回归。
这 8 个文件在本机从未跑绿过；改动后出现失败时先按这张表对照，别当成自己的改动造成的。

进度按项目规则立即记录并单独提交；超过条目或行数上限时，再以独立提交归档完整旧条目。目前远端推送地址为 `no_push`，日常整理保存为本地提交。
