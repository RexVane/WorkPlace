# WorkPlace 项目文档

WorkPlace 是基于 Magpie 持续开发的个人 AI 编程工作台。本机 Windows 应用已接入 A「工坊榫接」图标；当前状态与验证记录以[进度](state/progress.md)为准。

## 常用入口

| 内容 | 入口 |
| --- | --- |
| 本地构建、图标更新、清理与恢复 | [维护指南](workplace/maintenance.md) |
| 当前工作与历史记录 | [进度](state/progress.md)、[归档](state/archive/) |
| 正式图标与生成方式 | [品牌资源](assets/branding/README.md)、[预览](assets/branding/workplace/index.html) |
| 设计调研与候选留档 | [调研](assets/branding/research/2026-10-09.md)、[候选](assets/branding/candidates/index.html) |
| 子系统职责和代码入口 | [设计参考索引](subsystems/README.md) |
| 命令与接口参考 | [完整参考](reference.md)、[集成](integrating.md) |
| 代码与验证要求 | [代码标准](code-standards.md)、[经验记录](../LESSONS.md) |
| 浏览器回归环境与用例 | [GUI 测试说明](../internal/gui/tests/README.md) |

## 目录约定

| 目录 | 用途 |
| --- | --- |
| 根部 Go 文件 | CLI 主包、入口及同包测试；保留 Go 包的现有编译结构 |
| `internal/` | 按 Go 包划分的业务代码；测试与包同目录 |
| `internal/gui/assets/` | 程序实际嵌入的 HTML、CSS、JavaScript 和界面资源 |
| `build/` | 平台构建配置、清单与资源；源文件中保留上游平台工具 |
| `scripts/build/` | WorkPlace 本地构建入口 |
| `scripts/branding/` | 正式图标、研究图和候选图的生成工具 |
| `scripts/maintenance/` | 保留旧产物的归档工具 |
| `docs/assets/` | 文档配图、品牌设计和[字体设置截图](assets/screenshots/font-settings.png) |
| `docs/state/` | 当前进度和按月归档的历史 |
| `site/` | 原项目网站源码及其框架规定的资源位置 |
| `dist/` | 本机构建输出与验证产物，Git 和 Docker 均忽略 |
| `backups/` | 旧文件与恢复记录，Git 和 Docker 均忽略 |

配置、命令、网关和协议继续采用兼容的 `magpie` 标识。显示品牌与平台适配边界见 [GUI app shell](subsystems/gui-shell.md#display-name-and-icons)。
