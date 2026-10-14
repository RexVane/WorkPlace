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
