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
  脚本以 `go run -tags dev` 启动，页面文件保存即重载；页面预览在 `http://127.0.0.1:3437`，独立网关端口 3436，不占用正式实例的 3425。
- 修改敲定后再运行 `scripts/build/windows.ps1` 构建 exe 并安装（见下节）。
- **旧 exe 一律删除不留档**：任何版本都能按 `build.json` 记录的源码版本从 Git 重建，归档 exe 只浪费磁盘（2026-10-09 已清理约 515 MB）。
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

本机程序可通过 `http://127.0.0.1:3425/api/hello` 核对实际运行的版本，`/v1/models` 检查模型目录。检查本身不需要发送模型生成请求。

进度按项目规则立即记录并单独提交；超过条目或行数上限时，再以独立提交归档完整旧条目。目前远端推送地址为 `no_push`，日常整理保存为本地提交。
