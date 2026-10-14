# 路由与用量页面验证记录及待查项

范围为 `D:\AIApp\magpie` 的两页交付整合。本文是本地跟踪记录，未创建远端 issue。

> **证据目录已于 2026-10-14 清理**（用户要求「旧的没用的都可以清」）。下表与第 37、52 行引用的
> `dist/verification-20261009-1638/`、`dist/verify-tabs-20261009/`、`dist/routing-icon-verify/`、
> `backups/ui-baseline-20261009-1647/`、`backups/archive-20261009-172427-824256/` 均已删除，
> 且它们不在 git 里，**无法再核对**。下表保留的是当时记录的结果，不是现在可以复查的证据；
> 需要复核请重跑当时的用例，清单见本目录与 `internal/gui/tests/README.md`。删除明细在
> `backups/INDEX.md`。

## 已验证的页面改动

| 检查 | 结果 | 本地日志（相对项目根） |
| --- | --- | --- |
| 用量图表占比、缓存隔离、刷新竞态、切换周期、卡片身份、窄窗口、隐藏与减少动态效果 | Chromium / WebKit 共 14 项通过 | `dist/verification-20261009-1638/usage-final.log` |
| 路由请求节点可读可操作、核心计数、计时、余额隔离、指标菜单 | 两引擎共 8 项通过 | `dist/verification-20261009-1638/routing-readable.log` |
| 窗口隐藏、遮挡及切换页面后只播放仍在进行的请求 | 中英文、两引擎共 12 项通过 | `dist/verification-20261009-1638/routing-flood-final.log` |
| 隐藏路由停止帧请求，恢复只播放一次 | Chromium 补跑 9 项通过 | `dist/verification-20261009-1638/routing-idle-chromium.log` |
| 用量及托盘刷新只有一个请求在途、错误释放、周期切换 | WebKit 补跑 6 项通过 | `dist/verification-20261009-1638/usage-refresh-webkit.log` |
| 数字单位切换及持久化，概览、请求、会话及托盘 | 两引擎共 6 项通过 | `dist/verification-20261009-1638/number-units-final.log` |
| Safari 15 语法、内建对象及 CSS 兼容、页面启动 | 6 项通过 | `dist/verification-20261009-1638/routing-readable.log` |

另外，资源 MIME/版本哈希 Go 测试、已有 Requests 柱图 18 项、翻译完整性 9 项、JavaScript 语法及 `git diff --check` 已通过。`go vet ./...`、Linux amd64 nogui 构建和 Windows amd64 production 构建通过。没有重新构建 Windows arm64 或 macOS。

已目视检查用量 1180px 深浅主题、390px 窄窗口，以及修复后的中文路由截图。图片在同一验证目录的 `usage-final/` 与 `routing-readable/`。

## 本次验证拦住并修复的问题

- 交付版 `busy` 与 `app.css` 全局加载状态重名，路由进行请求时，舞台和节点均 `opacity: .55; pointer-events: none`。新增可读、可操作断言先失败，改成局部 `rt-busy` 后两引擎通过；修复前日志为 `routing-busy-before.log`。保留真正保存按钮的全局加载状态。
- 概览改为分模型柱图后，旧数字单位测试还等待已不存在的 `.peak`。改为检查新图表坐标轴的数值单位、五条刻度和边界；页面、请求、会话与托盘的原有检查均保留。
- 请求恢复测试的定时器在 WebKit 尚未恢复绘制时读到 32 个排队 DOM 节点。改为逐绘制帧统计光点；最多两个仍进行请求的断言保留，且比原飞鸟的四个上限更严格。
- 路由测试夹具缺少真实接口的 `presets`、key 的 `who` 和 group 的 `name`，截图出现错误提示及 undefined。补齐这些字段后重新检查截图。

## 全仓检查未通过，不能用作发布验收

整套 GUI 与 `go test -tags nogui -p=2 -parallel=4 ./... -count=1 -timeout 30m` 已实际启动，分别从 16:38、16:39 运行。发现下列失败后，在两页专项验证和构建完成后停止，**未跑完，不能声称全仓通过**。日志为 `gui-suite.log`、`go-tests.log`。停止后未发现本轮测试的残留 Go 测试进程或临时 magpie 进程。

### GUI 待查

- `agent-disconnect-preview.test.cjs`：期望标题 `magpie`，当前已存在的品牌为 `WorkPlace`。使用 HEAD 原资源在独立备份目录重现了四项失败；标题断言应在品牌测试维护中统一处理。`menu-scroll.test.cjs` 也含该旧期望。
- `account-arrange.test.cjs`：两引擎等待 `.acc.dragging` 超时。HEAD 原资源也重现；单独诊断第一轮 Smart 拖拽成功，尚未确定后续哪个模式及动作阻止拖拽。需要逐轮标记定位，不能归为随机失败。
- `account-mask.test.cjs`：HEAD 原资源的 WebKit 重载后记录 `/api/agents/cli`、`/api/agents/install`、`/api/usage`、`/api/upstream` 的 access-control 请求异常；没有发现隐私断言失败。需要确认立即 reload 对首轮请求的中止和收尾，根因尚未证实。
- 上述三文件对照日志为 `gui-baseline.log`，10 项中 2 通过、8 失败；对照源码保留于 `backups/ui-baseline-20261009-1647/`。该对照仅用于定位，不构成忽略失败的理由。
- 全套还报告 Agents 布局、Connect、Gateway keys、Group members、Header、Library、Menu 和 Mobile desktop 对照等失败。没有逐项完成归因，不把它们全部断言为既有问题。完整名称保留在日志中；本轮不改这些模块的业务代码。

### Go 待查

- `TestPluginListSaysMiddleware` 与 `TestGatewayFixQuitsOnlyAMagpie`：Windows 临时 exe 占用导致清理 Access denied；后者另有 takeover `stuck`，仍需查明结束旧进程的行为。此前状态归档已有同类问题。
- Aside 的模式位/只读写入、创建 symlink，以及 VS Code / Zed 配置路径相关用例失败；本机不具备该 symlink 权限，部分测试只更换 HOME，而 Windows 路径仍取测试隔离的 APPDATA。不能据此声称跨平台用例通过。
- `TestInstallWithoutNodeParses` 使用当前 bash 后落入没有 `/bin/bash` 的 WSL；`TestUpdateThatWontStart` 尝试运行非 Win32 的 fixture；需要平台合适的测试替身。
- `TestPurposeAssetMatchesUsage` 使用精确的 `;\n` 尾部裁剪，Windows 检出含 CRLF；需在独立测试修复中验证标准化尾部后，解析结果确实等于生成源。
- `TestPluginStreamStalledClientKeepsOtherRequestsMoving` 报告 vendor 未产生 backlog；`TestGatewayHeldByAContainer` 及 Codex stale/suffix 用例也失败，尚未完成归因。测试环境由项目 `TestMain` / `testenv` 隔离；没有拿真实账户做请求验证。

## 本地产物与备份

- Windows：`dist/workplace-windows-amd64/magpie.exe`，版本 `51aa3bb-workplace-dirty`，2026-10-09 17:23:17 +08:00 构建。
- SHA-256：`D937CE0BA5669DB16FE53409C9BC358BC0166EDED37C8A1167AB3FC171FB4EE8`。
- 两份原交付整体位于 `backups/archive-20261009-172427-824256/files/`，原文件名与目录保留。
- 当前运行实例、安装目录和 Orca 工作区未改；本次交付为指定项目的源码与构建产物。
