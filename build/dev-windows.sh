#!/usr/bin/env bash
# `make dev` on Windows, run from Git Bash: build/dev.sh needs fswatch, lsof
# and USR2, none of which Windows has. The same split: the windows and the
# tray (the shell) stay up while a Go change rebuilds and restarts only the
# backend behind them — the API and the gateway. The shell's requests wait
# for the new backend to listen, and the page refreshes what it shows in
# place; UI files under internal/gui/assets reload the page as before. A
# build that fails leaves the running backend alone. A change to the shell's
# own code (internal/gui/app.go, dev_on.go) restarts the windows too.
# Quitting magpie from the tray, or Ctrl-C, ends it all.
#
# A Windows backend has no handover (dev_handover_windows.go): a restart
# ends the old one, with what it had in flight, before the new one starts.
#
# The ports are `make dev`'s, so the installed magpie keeps serving the
# agents on its own.
set -u
cd "$(dirname "$0")/.." || exit 1

export MAGPIE_ADDR=${MAGPIE_ADDR:-127.0.0.1:3426}
export MAGPIE_DEV_UI=${MAGPIE_DEV_UI:-127.0.0.1:3427}
export MAGPIE_DEV_BACKEND=${MAGPIE_DEV_BACKEND:-127.0.0.1:3428}
export MAGPIE_DEV_CONTROL=${MAGPIE_DEV_CONTROL:-127.0.0.1:3429}

shell='' backend='' watch='' fsw=''

# stop ends process $1 and all it started (the plugin host…): a Windows
# process has no signal to finish on, so the whole tree goes at once
stop() {
	[ -n "$1" ] || return 0
	local win
	win=$(cat "/proc/$1/winpid" 2>/dev/null) && taskkill //F //T //PID "$win" >/dev/null 2>&1
	kill "$1" 2>/dev/null
	wait "$1" 2>/dev/null
}

start_backend() { MAGPIE_DEV_ROLE=backend ./magpie-dev-backend.exe app & backend=$!; }

# up waits (up to 30s) for the backend to listen on its port; no, once it
# has exited. Its Windows pid is read each time: just started, it is still
# the forked bash's, until that has run the exe.
up() {
	local i win
	for ((i = 0; i < 150; i++)); do
		kill -0 "$backend" 2>/dev/null || return 1
		win=$(cat "/proc/$backend/winpid" 2>/dev/null) &&
			netstat -ano -p tcp | grep -qE ":${MAGPIE_DEV_BACKEND##*:} +[^ ]+ +LISTENING +$win\b" && return 0
		sleep 0.2
	done
	return 1
}

# the shell, and a watcher that ends everything once it is quit
start_shell() {
	MAGPIE_DEV_ROLE=shell ./magpie-dev.exe app & shell=$!
	{ while kill -0 "$shell" 2>/dev/null; do sleep 1; done; kill -TERM $$; } & watch=$!
}

stop_shell() {
	kill "$watch" 2>/dev/null; wait "$watch" 2>/dev/null
	stop "$shell"
}

cleanup() {
	trap - INT TERM
	stop_shell; stop "$backend"; stop "$fsw"
	exit 0
}
trap cleanup INT TERM

# what the build reads: Go, and the one Markdown file embedded
relevant() {
	case $1 in
	site/* | .git/* | *_test.go) return 1 ;;
	*.go | internal/agent/codex_prompt.md) return 0 ;;
	esac
	return 1
}

# changes prints, one per line, each file under here that is written,
# made or renamed, relative and with forward slashes: fswatch's job
changes() {
	powershell -NoProfile -NonInteractive -Command '
		$w = New-Object IO.FileSystemWatcher (Get-Location).Path
		$w.IncludeSubdirectories = $true
		$w.InternalBufferSize = 65536
		$w.NotifyFilter = "FileName, LastWrite"
		foreach ($e in "Changed", "Created", "Renamed") { Register-ObjectEvent $w $e | Out-Null }
		$w.EnableRaisingEvents = $true
		while ($true) {
			$e = Wait-Event
			Remove-Event -EventIdentifier $e.EventIdentifier
			# "`n", not WriteLine: its "`r`n" would end every path in bash
			[Console]::Out.Write($e.SourceEventArgs.Name.Replace("\", "/") + "`n")
			[Console]::Out.Flush()
		}'
}

# builds to a new file: a running exe can't be written over
build() { go build -tags dev -o magpie-dev.new.exe .; }

build || exit 1
cp magpie-dev.new.exe magpie-dev.exe || { echo "  magpie-dev.exe is in use · quit the magpie-dev still running first"; exit 1; }
mv -f magpie-dev.new.exe magpie-dev-backend.exe || exit 1
start_backend
start_shell
exec 3< <(changes)
fsw=$!
up || echo "  the backend didn't come up · see its log above"
echo "  magpie-dev · UI from internal/gui/assets, reload on save · Go changes restart the backend only · gateway $MAGPIE_ADDR · dev UI http://$MAGPIE_DEV_UI"

while read -r -u 3 path; do
	relevant "$path" || continue
	changed=" $path"
	# let a burst of saves settle into one build
	while read -r -u 3 -t 0.3 more; do relevant "$more" && changed="$changed $more"; done
	echo "  go changed ·$changed · rebuilding"
	if ! build; then
		echo "  build failed · the backend before it keeps running"
		continue
	fi
	stop "$backend"
	mv -f magpie-dev.new.exe magpie-dev-backend.exe
	start_backend
	if up; then
		echo "  backend restarted"
	else
		echo "  the new backend didn't come up · see its log above"
	fi
	case $changed in
	*" internal/gui/app.go"* | *" internal/gui/dev_on.go"*)
		echo "  window code changed · reopening the windows"
		stop_shell
		cp magpie-dev-backend.exe magpie-dev.exe
		start_shell
		;;
	esac
done
