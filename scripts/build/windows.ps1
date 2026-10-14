param(
    [ValidateSet('amd64', 'arm64')]
    [string]$Architecture = 'amd64',
    [switch]$RefreshIcons
)

$ErrorActionPreference = 'Stop'
$workplaceRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workplaceEnvironment = @{}
foreach ($name in @('CGO_ENABLED', 'GOOS', 'GOARCH')) {
    $workplaceEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

Push-Location -LiteralPath $workplaceRoot
try {
    if ((Get-Content -LiteralPath 'go.mod' -TotalCount 1) -ne 'module github.com/yetone/magpie') {
        throw 'This script must belong to the WorkPlace project.'
    }
    foreach ($command in @('go', 'git', 'python')) { Get-Command $command -ErrorAction Stop | Out-Null }
    $workplaceCommit = (git rev-parse --short HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $workplaceCommit -notmatch '^[0-9a-f]+$') { throw 'Cannot read the source revision.' }
    # The version says what it is: the commit, and -dirty only when the tree
    # really has uncommitted changes. It used to carry -dirty always, which
    # told the reader a fact nobody had checked and left a clean build from a
    # commit indistinguishable from one with edits in it. The "-workplace" part
    # is what keeps this a build from source for internal/update's Released:
    # a version that isn't three dot-separated numbers is never a release, so
    # this build still never replaces itself with an upstream release.
    $workplaceDirty = if ((git status --porcelain)) { '-dirty' } else { '' }
    $workplaceVersion = $workplaceCommit + '-workplace' + $workplaceDirty
    $workplaceOutput = 'dist/workplace-windows-' + $Architecture

    if ($RefreshIcons) {
        python -B scripts/branding/apply_icons.py
        if ($LASTEXITCODE -ne 0) { throw 'Could not apply WorkPlace icons.' }
    }
    # The previous build goes rather than piling up in backups/: every version
    # can be rebuilt from the commit its build.json names, and each archived
    # exe is another 44 MB of disk (see docs/workplace/maintenance.md, "旧 exe
    # 一律删除不留档"). This used to run scripts/maintenance/archive.py, which
    # kept them — the doc and the script disagreed, and the script was wrong.
    foreach ($workplaceOld in @($workplaceOutput, ('rsrc_windows_' + $Architecture + '.syso'))) {
        if (Test-Path -LiteralPath $workplaceOld) { Remove-Item -LiteralPath $workplaceOld -Recurse -Force }
    }
    New-Item -ItemType Directory -Path $workplaceOutput -Force | Out-Null

    $env:CGO_ENABLED = '0'
    $env:GOOS = 'windows'
    # The resource generator runs on the build machine, even for an ARM64 output.
    $env:GOARCH = (go env GOHOSTARCH).Trim()
    go run github.com/tc-hib/go-winres@v0.3.3 make --in build/windows/winres.json --arch $Architecture --out rsrc --file-version 0.0.0 --product-version 0.0.0
    if ($LASTEXITCODE -ne 0) { throw 'Could not generate Windows resources.' }
    $env:GOARCH = $Architecture
    $workplaceExecutable = Join-Path $workplaceOutput 'magpie.exe'
    go build -tags production -trimpath -ldflags="-s -w -X main.version=$workplaceVersion -H windowsgui" -o $workplaceExecutable .
    if ($LASTEXITCODE -ne 0) { throw 'WorkPlace build failed.' }

    $workplaceInfo = (Get-Item -LiteralPath $workplaceExecutable).VersionInfo
    if ($workplaceInfo.ProductName -ne 'WorkPlace' -or $workplaceInfo.FileDescription -ne 'WorkPlace') {
        throw 'The executable does not contain WorkPlace resources.'
    }
    $workplaceManifest = [ordered]@{
        Version = $workplaceVersion
        Architecture = $Architecture
        BuiltAt = Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'
        Executable = 'magpie.exe'
        SHA256 = (Get-FileHash -LiteralPath $workplaceExecutable -Algorithm SHA256).Hash
    }
    [IO.File]::WriteAllText(
        (Join-Path $workplaceRoot ($workplaceOutput + '/build.json')),
        ($workplaceManifest | ConvertTo-Json) + "`n",
        [Text.UTF8Encoding]::new($false)
    )
    Write-Output ('Built ' + $workplaceVersion + ': ' + (Join-Path $workplaceRoot $workplaceExecutable))
} finally {
    foreach ($name in $workplaceEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $workplaceEnvironment[$name], 'Process')
    }
    Pop-Location
}
