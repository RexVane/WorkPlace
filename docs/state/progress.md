# 进度

## 2026-10-08 18:56 +08:00 | claude-opus-5-5 | Windows 下跑通桌面 app 的 dev 热重载
- 现状快照：
  - `origin` = `https://github.com/yetone/magpie`（上游仓库，不是 fork），浅克隆，HEAD `67329b8`；已执行 `git remote set-url --push origin no_push`，防止误推上游
  - 本机装有正式版 magpie：`D:\edge download projects\magpie-windows-amd64.exe`，网关在 3425，配置在 `~/.config/magpie`
  - 本机没有 `make`、`fswatch`、`lsof`，项目自带的 `make dev` / `build/dev.sh` 在 Windows 上跑不起来
- 改了什么：
  - 新增 `build/dev-windows.sh`（Git Bash 跑）：和 `build/dev.sh` 一样拆成外壳（窗口和托盘）+ 后端（API 和网关）。用 PowerShell 的 `FileSystemWatcher` 代替 fswatch；Go 改动只重编译并重启后端，窗口不关；`internal/gui/app.go`、`dev_on.go` 改动才重开窗口；前端 `internal/gui/assets` 改动由页面长轮询自动刷新。Windows 后端没有 handover，重启时用 `taskkill /T` 连插件宿主子进程一起结束
  - 修 dev 外壳和正式版冲突：两者配置目录相同，单实例 `UniqueID` 也相同，dev 外壳一启动就把参数交给正式版然后退出。dev 构建的 ID 加 `.dev` 后缀
  - 修 dev 外壳抢正式版的系统注册：`registerScheme` / `shortcut.Ensure` / `autostart.Refresh` 都写入当前 exe 路径，试启动时 `HKCU\Software\Classes\magpie` 和 `App Paths\magpie.exe` 已实际被改成指向 `magpie-dev.exe`（已手动改回正式版路径）。dev 构建现在跳过这三项
  ```go
  // internal/gui/app.go:295
  go func() {
  	// these point at the running exe: magpie-dev's would take them from
  	// the installed magpie
  	if devBuild {
  		return
  	}
  	if err := registerScheme(); err != nil {
  ...
  // internal/gui/app.go:533
  id := "ai.usemagpie.app.i" + hex.EncodeToString(sum[:6])
  if devBuild {
  	id += ".dev"
  }
  ```
  - `devBuild` 常量：`dev_on.go` 为 true，`dev_off.go` 为 false，正式构建行为不变
  - `.gitignore` 补上 Windows 的 `magpie-dev.exe`、`magpie-dev-backend.exe`、`magpie-dev.new.exe`
- 验证：
  - `go vet -tags dev ./internal/gui/` 和 `go vet ./internal/gui/` 通过
  - 实机跑 `bash build/dev-windows.sh`：dev 外壳和正式版并存（端口 3426-3429 vs 3425）；touch 一个 Go 文件后 12 秒内后端 PID 换新、外壳 PID 不变；touch `assets/app.css` 后 `/api/dev/wait` 2 秒内返回新 stamp；TERM 脚本后 dev 进程和端口全部释放，正式版不受影响
  - 没跑 `go test ./internal/gui/`
- 影响文件：`build/dev-windows.sh`, `internal/gui/app.go`, `internal/gui/dev_on.go`, `internal/gui/dev_off.go`, `.gitignore`
- 下一步：等用户给出自己的 fork 地址，再把远端改成 `origin`=fork、`upstream`=yetone/magpie；代码改动尚未提交
