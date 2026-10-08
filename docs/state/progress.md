# 进度

> 更早的条目已归档到 [archive/](archive/)，按月份分文件（如 `archive/2026-10.md`）。

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

## 2026-10-08 21:44 +08:00 | claude-opus-5-5 | 测试替身在 Windows 上找不到，gateway 测试跑了本机真装的 CLI
- 现象：整包 `go test ./internal/gateway/` 在本机 895s，3 个失败。上一条把其中两个代理测试归因于 Windows 系统代理，**这个判断是错的**，实际原因如下
- 查到的原因（都实际复现过）：
  1. `TestKeyProxy`：假的全局代理收到 3 个 `CONNECT api2.cursor.sh:443`。抓调用栈：`provider.Save` → `Accounts()` → `cursorAccount()` → `askCursorStatus()`（`provider/cursor.go:91`）启动了本机真装的 `C:\Users\guica\AppData\Local\cursor-agent\cursor-agent.cmd`，它继承测试的代理设置去连 Cursor。根因：`testenv.StandIns` 只写无扩展名的 `#!/bin/sh` 替身，Windows 的 `exec.LookPath` 按 PATHEXT 找，跳过它找到 PATH 后面的真程序。`inertTools` 早已为 Windows 补写 `.bat`，但 `gateway/main_test.go:65` 直接调 `StandIns`，没补。本机受影响的真程序：`claude.exe`、`codex.cmd`、`cursor-agent.cmd`、`grok.exe`；CI 的 Windows 机器上没装这些，所以看不出来
  2. `TestPluginModelListThroughAccountProxy`：测试用 PATH 里的 bun（本机 1.3.11，低于 magpie 要求的最低版本 1.4.2，CI 也用 1.4.2）。1.3.11 发给代理的请求行是 `GET http://models.invalid:80/list`，1.4.2 是 `GET http://models.invalid/list`；测试的假代理只认不带端口的主机名。下载官方 1.4.2（按 `plugin/bun.go` 里的 SHA-256 校验）放到 PATH 前面后测试通过
  3. `TestSweepBridgeProjectsTakesOnlyTheBridgesFolders`：本机没开开发者模式，当前用户没有 `SeCreateSymbolicLinkPrivilege`，`os.Symlink` 失败；仓库里至少 5 个同类测试在这种情况下 `t.Skip`，只有它 `t.Fatal`
  4. 另发现 `testenv` 的 `TestOffline` 在本机失败：`HTTPS_PROXY=http://127.0.0.1:<port>`，`Offline()` 只拦非本机的连接，请求经本机代理照样出网。即开着本机代理时「测试不连外网」的保证失效。去掉代理变量后通过
- 改了什么（只修第 1 个）：Windows 补写 `.bat` 替身从 `inertTools` 挪进 `StandIns` 本身，所有调用方都用上
  ```go
  // internal/testenv/testenv.go:200（StandIns 内）
  if runtime.GOOS == "windows" {
  	if err := os.WriteFile(p+".bat", []byte("@exit /b 1\r\n"), 0o755); err != nil {
  		return err
  	}
  }
  ```
- 验证：
  - 新增 `TestStandInsComeFirstOnPath`（`testenv_test.go:38`）：改之前在本机失败（4 个名字找到真程序，4 个找不到），改之后通过
  - `TestKeyProxy` 通过，单个耗时 1.45s → 0.31s
  - 整包 `go test ./internal/gateway/ -timeout 30m`：895s → 486s，剩 2 个失败就是上面的第 2、3 个
  - `go vet ./internal/testenv/` 通过；`go test ./internal/testenv/` 去掉代理变量后全过（带着代理变量时只有 `TestOffline` 失败，即第 4 个）
- 影响文件：`internal/testenv/testenv.go`, `internal/testenv/testenv_test.go`
- 下一步：第 2、3、4 个待用户决定是否修；所有代码改动都还没提交

## 2026-10-08 22:53 +08:00 | claude-opus-5-5 | 测试的离网保护被本机代理绕过；查清 gateway 其余失败与全仓 Windows 失败
- 改了什么：
  - **第 4 个（离网保护失效）**：`testenv.Offline()` 只在拨号时拦「非本机地址」，但本机代理（这台机器的 `HTTP(S)_PROXY` 和注册表系统代理都是 `127.0.0.1:7897`）本身就在本机，请求先拨到代理再由代理出网，拦不住。测试复现：代理被问 2 次，models.dev 拿到代理的 502。现在 `Offline()` 做三件事：清掉 6 个 `*_PROXY` 变量（magpie 自己的 netproxy 和测试启动的子程序都会读它们）；拨号拦截照旧；包一层 `DefaultTransport.Proxy`，要经代理去非本机地址时直接拒绝
  ```go
  // internal/testenv/offline.go:68
  if proxy := t.Proxy; proxy != nil {
  	t.Proxy = func(req *http.Request) (*url.URL, error) {
  		p, err := proxy(req)
  		if p != nil && !local(req.URL.Host) {
  			return nil, refuse(req.URL.Host)
  		}
  		return p, err
  	}
  }
  ```
  - 系统代理那条路：magpie 自己的 transport（`mcp.go`、`update.go` 等克隆 DefaultTransport 后设 `Proxy = netproxy.Func`）会去读 Windows 注册表的系统代理。netproxy 加了可替换的 `SystemProxy`（`netproxy.go:337`，默认就是原来的 `system`），gateway 和 provider 的 TestMain 在 `Offline()` 后把它设成「无系统代理」，和 CI 上一样。testenv 不能直接 import netproxy（netproxy 的测试 import testenv，会循环）
  - **第 3 个**：`TestSweepBridgeProjectsTakesOnlyTheBridgesFolders` 建不了符号链接时改成 `t.Skip("no symlinks here:", err)`，和仓库里同类测试一致（`claude_subscription_test.go:428`）
  - **第 2 个不改代码**：曾把断言改成 `r.URL.Hostname()`，后来全仓测试发现 plugin 包 `TestPluginProxy`、`TestPluginSOCKSProxy`、`TestPluginHTTP2TakesTheProxy` 是同一根因：测试用 PATH 上的 bun（本机 1.3.11），低于 magpie 的下限 1.4.2（`plugin/bunupdate.go:8`，运行时从不用更旧的 bun；CI 装 1.4.2）。把 bun 1.4.2 放到 PATH 最前，**原版** 4 个测试全过，所以改回原样，本机升级 bun 即可
- 验证：
  - `TestOffline` 扩充后在旧代码上失败（6 个代理变量还在、代理被问 2 次），改后通过；`go vet` testenv/netproxy/gateway/provider 通过
  - 全仓 `go test ./... -count=1 -timeout 30m`：testenv、netproxy、gateway（623s）、provider（256s）全过；单跑时 gateway 日志出现 `testenv: a test asked models.dev:443, refused`，插件宿主拉 models.dev 已被拦下
  - 另有 5 个包共 22 个失败（根包、agent、gui、plugin、usage）。在 HEAD 的干净工作树（`/tmp/magpie-base`，不含任何未提交改动）重跑这 5 个包，**22 个完全相同**，不是本次改动引起
  - 上游 CI 在 Windows 上本来就不跑全量测试，只编译加跑少数指定测试（`.github/workflows/test.yml:99-104`，注释说明部分测试用 $HOME 伪造家目录、假设 Unix 文件权限）。基线提交 67329b8 的 CI 三平台都绿。这 22 个属上游已接受的 Windows 测试不兼容：Unix 权限/chmod/符号链接（Aside 6 个）、家目录走 APPDATA（VS Code Insiders、Zed）、伪造的 sh 程序不能在 Windows 执行（`TestUpdateThatWontStart`）、进程未退导致临时目录删不掉等，外加上面 3 个 bun 版本问题
- 遗留（没修）：gateway 主 client（`gateway.go:335` 新建的 transport）和包级变量里在 TestMain 之前就克隆好的 transport（如 `mcp.go` 的 `mcpClient`）不受 `Offline()` 的拨号拦截；现在它们不再走代理，但直连外网仍拦不住
- 影响文件：`internal/testenv/offline.go`, `internal/testenv/offline_test.go`, `internal/netproxy/netproxy.go`, `internal/gateway/main_test.go`, `internal/provider/kiro_main_test.go`, `internal/gateway/claude_subscription_test.go`
- 下一步：用户决定是否升级本机 bun、22 个 Windows 测试是否另行处理；然后重编正式版装到 3425；所有代码改动都还没提交

## 2026-10-08 23:06 +08:00 | claude-opus-5-5 | 本机 bun 升到 1.4.2，bun 版本导致的 4 个测试失败消失
- 改了什么：
  - 用户同意后执行 `bun upgrade`：`~/.bun/bin/bun.exe` 和 `bunx.exe` 从 1.3.11 升到 1.4.2（和 magpie 的下限 `BunVersion`、CI 版本一致）。旧版被 bun 留成 `~/.bun/bin/bun.exe.outdated`，可回退
  - 升级时有个 10-07 启动的 `bun src/console.ts` 进程（PID 47540，不是本项目的）在用旧文件，没动它，它继续跑旧版
  - 代码不改：gateway 的 `plugin_listing_proxy_test.go` 保持原样
- 验证：不加任何 PATH 处理，原版 `TestPluginModelListThroughAccountProxy`（gateway）、`TestPluginProxy`、`TestPluginSOCKSProxy`、`TestPluginHTTP2TakesTheProxy`（plugin）全部通过
- 影响文件：无（本机环境）
- 下一步：用户决定 22 个 Windows 测试失败是否另行处理；然后重编正式版装到 3425

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
