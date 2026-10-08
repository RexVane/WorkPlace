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

## 2026-10-08 19:06 +08:00 | claude-opus-5-5 | 卸掉正式版 magpie，修 Agent 页内容区的白框
- 改了什么：
  - 按用户要求卸掉正式版 magpie（3425）。卸之前确认过没有 agent 指向 3425：`~/.config/magpie/stash.json` 里 claude/codex/pi/agy 只剩 `*.reconnect`（已断开），agent 配置里也没有 3425
    - 结束进程：先 `taskkill /T`，没退出再加 `/F`
    - `magpie-windows-amd64.exe`、待安装的 `.exe.new`、开始菜单 `Magpie.lnk` 移进 `backups/`（`backups/` 已加入 `.gitignore`）
    - 注册表 `HKCU\Software\Classes\magpie` 和 `App Paths\magpie.exe` 先导出成 `backups/*.reg`，再删除
    - `~/.config/magpie` 保留，dev 版继续用这份数据
  - 用户截图里内容区外面有一圈白框：每个 `.view` 都被设成 `tabIndex = -1`（`app.js` 中 `for (const v of document.querySelectorAll(".view"))`），鼠标点击空白处后焦点落在 `.view` 上；之后一按键，Chromium/WebView2 就给它画上默认的 `:focus-visible` 焦点环，把整页围起来。`tabIndex` 保留，只去掉 `.view` 自己的焦点环
  ```css
  /* internal/gui/assets/app.css:300 */
  .view:focus { outline: none; }
  ```
- 验证：用无头 Edge 154.0.4258.62（和 WebView2 同版本）+ CDP 在 dev UI 上复现。点击内容区空白再按 ArrowDown：修复前 `focusVisible: true`、`outline: auto`，截图和用户看到的框一致；修复后 `outline: none`、截图无框；按 Tab 移到 `.ag-handle` 仍有焦点环。没跑 `internal/gui/tests`（本机没装 Playwright），也没在 WebKit 上验证
- 影响文件：`internal/gui/assets/app.css`, `.gitignore`
- 下一步：用户给 fork 地址后整理远端；代码改动尚未提交

## 2026-10-08 19:41 +08:00 | claude-opus-5-5 | 重装正式版 magpie 到 3425，配好 claude-mix 多模型启动命令
- 改了什么：
  - 用户要在 Claude Code 里让子代理用 magpie 其他路由组的模型，需要常驻网关，所以重新装回正式版（上一条卸掉的是下载版）
    - 本仓库源码自编：`CGO_ENABLED=0 go build -tags production -trimpath -ldflags="-s -w -X main.version=d85c250-dirty -H windowsgui"`，装到 `%LOCALAPPDATA%\Programs\magpie\magpie.exe`，以 `tray` 参数运行，网关 3425
    - 它自己把 `HKCU\Software\Classes\magpie` 和 `App Paths\magpie.exe` 注册到这个路径（已核对）；dev 版（3426-3429）照常并存，所以托盘有两个图标
  - 新增启动命令 `claude-mix`（都在仓库外，不进 git）：普通 `claude` 和 `~/.claude/settings.json` 不动
    - `~/.local/bin/claude-mix`（Git Bash）和 `claude-mix.cmd`（cmd/PowerShell）：先探 3425，不通就拉起正式版，再执行 `claude --settings ~/.claude/mix/settings.json --append-system-prompt-file ~/.claude/mix/prompt.md "$@"`
    - `~/.claude/mix/settings.json`：主模型和 opus 档 `claude/claude-opus-5-5`（Claude 订阅），sonnet 档和子代理默认 `group/auto-gpt-6-astra`，haiku 档和 small-fast `group/auto-grok-4-7`，fable 档 `deepseek/deepseek-flash`
    - `~/.claude/mix/prompt.md`：告诉主模型各档对应的实际模型和分工（主模型搭框架，sonnet 执行，haiku/fable 调研）
  - magpie 配置里新增 DeepSeek 供应商（id `deepseek`，官方 key），模型 `deepseek-flash`、`deepseek-v4-pro`
- 注意：
  - `group/auto-grok-4-7` 的成员只有 `cursor/grok-4.7`、`grok/grok-4.7`，两个都是已弃用的内置订阅（用户说先不迁插件）；small-fast 也指向它，所以后台小任务同样会走这两家
  - `group/auto-gpt-6-astra` 成员依次是 `laoban`、`openai`、`copilot`
- 验证：settings.json 能被解析；3425 的 `/v1/models` 含上述四个 id；`--append-system-prompt-file` 是 2.1.293 的隐藏参数（二进制里有说明）；Git Bash、cmd、PowerShell 都能找到 `claude-mix`。没跑真实对话，留给用户自测
- 影响文件：仓库内无；仓库外 `~/.local/bin/claude-mix{,.cmd}`、`~/.claude/mix/*`、`%LOCALAPPDATA%\Programs\magpie\magpie.exe`
- 下一步：用户实测 claude-mix；代码改动（导航栏、白框、dev 脚本）尚未提交

## 2026-10-08 20:31 +08:00 | claude-opus-5-5 | 翻译后发往 GPT 的请求补上 prompt_cache_key，装进正式版
- 现象：claude-mix 的 sonnet 子代理（`group/auto-gpt-6-astra` → `laoban`，即 sub2api.camrecipes.com）缓存命中率只有 7.5%（23 次调用，71.2 万新输入、5.7 万缓存读取）；同一会话里 Claude 订阅 99.9%、DeepSeek 95.6%、Grok 92.9%
- 原因：
  - Claude Code 发 Anthropic 的 `/v1/messages`，请求里没有 `prompt_cache_key`；`parseAnthropic` 不生成 `CacheKey`，翻译成 `/v1/responses` 时（`responses.go:753`）也就不写这个字段，magpie 也不给 API key 类上游带会话头（只有内置 ChatGPT 订阅在 `provider/codex_request.go:263` 自己补）
  - OpenAI 系的缓存靠 `prompt_cache_key` 把同一对话送到同一台机器。sub2api 自己的 `/v1/messages` 入口会补这个 key（其源码 `openai_gateway_messages.go:123-137`），magpie 先翻译了就没了
  - 实验（经 3425 发 `laoban/gpt-6-astra`，约 4.4k token 的同一前缀）：不带 key 连发 3 次命中 0/0/0；带 key 连发 2 次，第 2 次命中 4224/4466
- 改了什么：
  - `forwardTranslated` 里，客户端没给 key、且模型属于 OpenAI 自家（`modelFamily` 为 Chat：GPT、Codex、o 系列）时，用 `madeCacheKey` 生成一个；按用户要求只对 GPT 这类模型生效，DeepSeek、Grok 等不变
  - key 的做法照搬 `cursorConversation`：agent 会话头（`nativeSessionOf`，Claude Code 的 `x-claude-code-session-id`）+ 对话第一条用户消息，同一会话里并行的子代理各自分开；没有会话头时不生成
  - 上游不认这个字段时走原有逻辑：400 后去掉 key 重发，并记住不再带（`TestPromptCacheKeyRefused`）
  ```go
  // internal/gateway/gateway.go:3358
  if req.CacheKey == "" && modelFamily(model) == provider.Chat {
  	if k := madeCacheKey(in, req); k != "" {
  		r := *req
  		r.CacheKey, req = k, &r
  	}
  }
  // internal/gateway/gateway.go:3589
  func madeCacheKey(in http.Header, req *Request) string {
  	session := nativeSessionOf(in)
  	if session == "" {
  		return ""
  	}
  	... // 第一条 user 消息 json.Marshal
  	sum := sha256.Sum256([]byte("prompt cache key\x00" + session + "\x00" + string(first)))
  	return uuidOf(sum[:])
  }
  ```
- 验证：
  - 新增 `TestMadeCacheKeyForOpenAIModels`（`prompt_cache_test.go:217`）：同一对话各轮 key 相同；同会话另一子代理、另一会话 key 不同；DeepSeek 模型、无会话头不带；Codex 自带的 key 原样保留。把调用处改成 `if false &&` 时该测试失败，恢复后通过
  - 用改动后的代码临时起 `magpie serve`（3431），按 Claude Code 格式带会话头发 `laoban/gpt-6-astra` 3 次：命中 0 / 4352 / 4352（输入 4467），已关掉
  - `go vet ./internal/gateway/` 通过；整包 `go test ./internal/gateway/ -timeout 30m` 跑完（895s；默认 10 分钟会超时），3 个失败在关掉改动后同样失败，属本机环境：`TestKeyProxy`、`TestPluginModelListThroughAccountProxy`（本机开了 Windows 系统代理 ProxyEnable=1，去掉 HTTP(S)_PROXY 仍失败），`TestSweepBridgeProjectsTakesOnlyTheBridgesFolders`（Windows 建符号链接需要特权）
  - 三次实验共约 3.5 万输入 token
- 正式版：重新编译（`main.version=e6c7bd9-dirty`）装到 `%LOCALAPPDATA%\Programs\magpie\magpie.exe` 并以 `tray` 启动，3425 恢复；旧 exe 移到 `backups/magpie.exe-20261008-2019`
- 影响文件：`internal/gateway/gateway.go`, `internal/gateway/prompt_cache_test.go`
- 下一步：用户再跑 sonnet 子代理，从 `usage.jsonl` 看 laoban 的命中率；代码改动（导航栏、白框、dev 脚本、缓存 key）都还没提交
