$ErrorActionPreference = 'Stop'
$node = Join-Path $PSScriptRoot '.runtime\node-v24.18.0-win-x64\node.exe'

if (-not (Test-Path $node)) {
    $node = 'node'
}

Write-Host '별빛 기지 서버를 시작합니다: http://localhost:3000'
& $node (Join-Path $PSScriptRoot 'server.cjs')
