$ErrorActionPreference = 'Stop'
$taskPidFile = Join-Path $PSScriptRoot '.local-server.pid'
if (-not (Test-Path -LiteralPath $taskPidFile)) { Write-Host 'No recorded background server.'; exit }
$taskServerPid = [int](Get-Content -LiteralPath $taskPidFile -Raw)
$taskProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $taskServerPid)
if ($taskProcess -and $taskProcess.CommandLine -like '*amaravati-observatory*server.mjs*') {
    Stop-Process -Id $taskServerPid
    Write-Host 'Stopped the Amaravati local server.'
} else { Write-Host 'The recorded process is no longer this project server. Nothing stopped.' }
