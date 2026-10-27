# Runs a Blender script headless at below-normal priority, after any other session's Blender has finished.
# Usage: pwsh blender/run.ps1 blender/build_office.py
param([Parameter(Mandatory = $true)][string]$Script)

$blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
while (Get-Process -Name blender -ErrorAction SilentlyContinue) {
    Write-Host 'Another Blender is running; waiting 20 s'
    Start-Sleep -Seconds 20
}
$logFile = Join-Path $PSScriptRoot 'build/blender.log'
New-Item -ItemType Directory -Force (Split-Path $logFile) | Out-Null
$process = Start-Process -FilePath $blender -ArgumentList @('--background', '--factory-startup', '--python', (Resolve-Path $Script).Path) `
    -NoNewWindow -PassThru -RedirectStandardOutput $logFile -RedirectStandardError "$logFile.err"
$process.PriorityClass = 'BelowNormal'
$process.WaitForExit()
Get-Content $logFile | Select-String -Pattern 'exported|Error|Traceback|line \d+' | ForEach-Object { $_.Line }
Get-Content "$logFile.err" -Tail 20
exit $process.ExitCode
