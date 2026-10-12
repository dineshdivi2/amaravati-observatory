param([int]$Port = 4267)
$ErrorActionPreference = 'Stop'
$taskSiteRoot = Join-Path $PSScriptRoot 'site'
$taskNode = 'C:\Users\dines\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (Test-Path -LiteralPath $taskNode) {
    Write-Host "Amaravati Observatory: http://127.0.0.1:$Port"
    Write-Host 'Keep this terminal open. Press Ctrl+C to stop.'
    & $taskNode (Join-Path $PSScriptRoot 'server.mjs') $Port
    exit $LASTEXITCODE
}
$taskPythonCandidates = @(
    'C:\Users\dines\AppData\Local\Programs\Python\Python310\python.exe',
    'C:\Users\dines\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
)
$taskPython = $taskPythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $taskPython) {
    $taskPython = (Get-Command python -ErrorAction Stop).Source
}
Write-Host "Amaravati Observatory: http://127.0.0.1:$Port"
Write-Host 'Keep this terminal open. Press Ctrl+C to stop.'
& $taskPython -m http.server $Port --bind 127.0.0.1 --directory $taskSiteRoot
