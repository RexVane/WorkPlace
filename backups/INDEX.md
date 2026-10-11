# 备份索引

从工作区移除的东西记在这里,只追加不改。`backups/` 里的实体不进 git(见 .gitignore),清理只由用户手动做。

| 时间 | 原路径 | HEAD号 / 存放位置 | 原因 |
| --- | --- | --- | --- |
| 2026-10-11 13:25:14 | internal/gui/tests/agent-scope.test.cjs | 99e6d69(HEAD 有它，可 git restore 恢复) | 范围面板由「按名字勾选」改成「路由组开关」，用例重写为 agent-routing-sheet.test.cjs |
