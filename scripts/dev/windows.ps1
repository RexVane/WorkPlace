param(
    [ValidateSet('usage', 'routing', 'agents', 'providers', 'gateway', 'sessions', 'library', 'plugins', 'settings')]
    [string]$View = 'usage',
    [ValidateRange(1024, 65535)]
    [int]$GatewayPort = 3436,
    [ValidateRange(1024, 65535)]
    [int]$UIPort = 3437
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
