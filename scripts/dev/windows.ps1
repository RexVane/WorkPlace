param(
    [ValidateSet('usage', 'routing', 'agents', 'providers', 'gateway', 'sessions', 'library', 'plugins', 'settings')]
    [string]$View = 'usage',
    # 23436/23437, not 3436/3437: Windows keeps ranges of ports out of every
    # program's reach for Hyper-V, WSL and Docker (a bind inside one fails as
    # "forbidden by its access permissions", WSAEACCES), and on this machine
    # that holds 3390-3589 and more — both old defaults are unusable. These
    # sit above the dynamic port range (1024-15000), which winnat reserves
    # from, so they stay usable. Check with:
    #   netsh interface ipv4 show excludedportrange protocol=tcp
    [ValidateRange(1024, 65535)]
    [int]$GatewayPort = 23436,
    [ValidateRange(1024, 65535)]
    [int]$UIPort = 23437
)

$ErrorActionPreference = 'Stop'
$devProject = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$devGo = (Get-Command go -ErrorAction Stop).Source
$devPrevious = @{}
foreach ($devVariable in @('MAGPIE_ADDR', 'MAGPIE_DEV_UI', 'MAGPIE_DEV_ROLE')) {
    $devPrevious[$devVariable] = [Environment]::GetEnvironmentVariable($devVariable, 'Process')
}

Push-Location -LiteralPath $devProject
try {
    $env:MAGPIE_ADDR = "127.0.0.1:$GatewayPort"
    $env:MAGPIE_DEV_UI = "127.0.0.1:$UIPort"
    [Environment]::SetEnvironmentVariable('MAGPIE_DEV_ROLE', $null, 'Process')
    Write-Host "WorkPlace source: $devProject"
    Write-Host "Page preview: http://127.0.0.1:$UIPort (reloads on save)"
    & $devGo run -tags dev . app $View
    if ($LASTEXITCODE -ne 0) { throw "Development app exited with code $LASTEXITCODE" }
} finally {
    foreach ($devVariable in $devPrevious.Keys) {
        [Environment]::SetEnvironmentVariable($devVariable, $devPrevious[$devVariable], 'Process')
    }
    Pop-Location
}
