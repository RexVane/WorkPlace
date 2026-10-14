# 备份索引

从工作区移除的东西记在这里,只追加不改。`backups/` 里的实体不进 git(见 .gitignore),清理只由用户手动做。

| 时间 | 原路径 | HEAD号 / 存放位置 | 原因 |
| --- | --- | --- | --- |
| 2026-10-11 13:25:14 | internal/gui/tests/agent-scope.test.cjs | 99e6d69(HEAD 有它，可 git restore 恢复) | 范围面板由「按名字勾选」改成「路由组开关」，用例重写为 agent-routing-sheet.test.cjs |

## 2026-10-14 12:55 清理旧物(用户要求「旧的没用的都可以清，数据配置不用清」)

共释放 297.0 MB。删除前逐项 `Resolve-Path` 确认落在仓库内、且不含 `.config` / `.cache`,未触碰用户数据与配置(`~/.config/magpie` 8.9 MB、`~/.cache/magpie` 191.8 MB 原样保留)。

| 时间 | 原路径 | HEAD号 / 存放位置 | 原因 |
| --- | --- | --- | --- |
| 2026-10-14 12:55 | dist/dev-session-20261009-184500、dist/publish-check、dist/restart-20261009-182434、dist/routing-icon-verify、dist/tidy-checks、dist/usage-source-review-20261009、dist/verification-20261009-1638、dist/verify-tabs-20261009、dist/workplace-windows-arm64 | 无(构建/核验产物，均已 gitignore，可重新生成) | 历次构建与核验的临时目录，与当前版本无关 |
| 2026-10-14 12:55 | dist/verify-numbers-20261014/ 下的 magpie-frozen.exe、frozen/、assets-head/、assets-parent/、probe/、_probe/、chrome-tests/、prices.json、prices-quiet.json | 无(可重新生成) | 冻结实例、旧版资源对照与价格快照等可再生副本；**同目录下的脚本与文本/图片证据全部保留**(61 个文件 0.7 MB) |
| 2026-10-14 12:55 | backups/files/magpie-旧正式版-20261014-125040.exe、backups/archive-20261014-124917-737246/ | a7862bb7(旧正式版 d2ceefa1 之前，可由该提交重新编译) | 同一份旧正式版 exe 的两份拷贝，新版已装入 `%LOCALAPPDATA%\Programs\magpie` 并核对 SHA256 |

**未删(有意保留)**:`backups/` 下 branding / workplace-candidates 等 38 MB——经核对,其中 73/74、63/63、88/88 个文件**不在 git 里**,是 WorkPlace 图标的设计原始素材,删掉不可恢复。

## 2026-10-14 13:50 清掉上面保留的 38 MB(用户明确要求「清理吧」→ 选「全删」)

删除前把核对方法从**按路径**改成**按内容 SHA256** 与 git 的 3900 个已跟踪内容比对(按路径比对会漏判:同一文件在 git 里的位置可能不同),结论:

- 设计类备份共 **313 个文件,其中 281 个的内容不在 git**(32 个在)。
- 38 MB 里约 **32 MB 与 git 重复**(如 `project-tidy` 244/255 在 git、`ui-baseline` 201/202 在 git),**真正独有的只有约 6 MB**,全是被淘汰的候选图标(`qixu`/`xuwu`/`yanting`/`kernyard` 等)与中间导出。
- 已确认 `docs/assets/branding/`(git 跟踪 178 文件 7.2 MB)是**自包含**的——其 `index.html` 引用的 5 个本地资源 0 缺失;已发布的成品图标在 `build/windows/icon-*.png`、`internal/gui/assets/icons/` 里。故删除不影响文档与成品。

共释放 38.0 MB,删除 30 个目录(逐项 `Resolve-Path` 确认落在 `backups/` 下)。

| 时间 | 原路径 | HEAD号 / 存放位置 | 原因 |
| --- | --- | --- | --- |
| 2026-10-14 13:50 | backups/archive-20261009-020002-627872、archive-20261009-020417-738045、archive-20261009-170648-100081、archive-20261009-172300-013418、archive-20261009-172427-824256、archive-20261012-135117-522882(共 2.0 MB) | 各自内容多已入 git;构建自动归档 | 构建/整理时的自动归档，与当前版本无关 |
| 2026-10-14 13:50 | backups/branding-20261008-232456、branding-20261009-000545、branding-exports-20261008-233308-225824、branding-workplace-draft-20261009-002237(共 2.9 MB) | 无(内容经哈希核对确认不在 git,已永久删除) | 图标设计早期候选(被淘汰的 qixu/xuwu/yanting/kernyard)与导出 |
| 2026-10-14 13:50 | backups/workplace-20261009-001335、workplace-apply-20261009-012052、workplace-build-20261009-013634、workplace-candidate-refinement-20261009-004434、workplace-candidates-20261009-004505-350891、workplace-candidates-20261009-005226-344280、workplace-install-20261009-014105、workplace-runtime-icons-20261009-012254-849210、workplace-selected-20261009-005814、workplace-selected-20261009-010330-686679(共 6.2 MB) | 无(同上,已永久删除) | WorkPlace 品牌落地各阶段的候选/中间产物;入选设计与最终资源已在 `docs/assets/branding` 与 `build/` |
| 2026-10-14 13:50 | backups/project-tidy-20261009-015714(12.3 MB)、ui-baseline-20261009-1647(8.2 MB) | 244/255、201/202 个文件的内容已在 git | 目录整理与界面基线快照,与 git 重复 |
| 2026-10-14 13:50 | backups/usage-layout-20261009-184845、usage-motion-20261009-161243、usage-fx-tabs-20261009-205110、usage-verification-20261009-171254、routing-motion-20261009-154316、quota-trend-removal-20261009-211335、progress-archive-20261009-163430、files/(空目录)(共 6.4 MB) | 内容多已在 git(改动早已提交) | 用量页/路由页动效与版式迭代期的留底 |
| 2026-10-14 17:55 | backups/archive-20261014-172440-745325、archive-20261014-175124-646317(共 89.1 MB) | 两份 `build.json` 分别记明源码版本 `d2ceefa1` 与 `47812068`，两者都在 git 里，可按该提交重建 | 构建脚本每次编译自动归档的旧 exe（`magpie.exe` 各 44.5 MB，SHA256 分别以 `9769300F`、`A8B6880B` 开头）。用户确认「脚本改成删除旧 exe，并清掉现有 89 MB」；同一个提交把 `scripts/build/windows.ps1` 的归档改成删除，与文档「旧 exe 一律删除不留档」一致 |

**保留**:`backups/INDEX.md`(git 跟踪)、以及 `go.mod`、`README.md`、`magpie-app-paths.reg`、`magpie-url-scheme.reg`、`Magpie.lnk`(共约 4 KB,是更早从工作区移出的记录,本身不占空间)。
